import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  RoomAttentionPriority,
  RoomAttentionStatus,
  RoomAttentionTagType,
} from "@prisma/client";
import {
  cancelRoomAttentionTagSchema,
  closeRoomAttentionTagSchema,
  createRoomAttentionTagSchema,
  updateRoomAttentionTagSchema,
} from "@a25/validation";
import { PrismaService } from "../../infrastructure/database/prisma/prisma.service";

type Evidence = { requestId?: string; ipAddress?: string; userAgent?: string };
type TagQuery = {
  branchId?: string;
  active?: string;
  status?: string;
  priority?: string;
  tagType?: string;
  roomNumber?: string;
  expectedCheckOutDate?: string;
};
const activeStatuses: RoomAttentionStatus[] = [
  RoomAttentionStatus.OPEN,
  RoomAttentionStatus.IN_PROGRESS,
  RoomAttentionStatus.RESOLVED,
];
const managementRoles = new Set([
  "BRANCH_DIRECTOR",
  "DEPUTY_BRANCH_DIRECTOR",
  "BRANCH_MANAGER",
  "SHIFT_LEADER",
  "REGIONAL_MANAGER",
  "ADMIN",
]);
const writableRoles = new Set(["RECEPTIONIST", ...managementRoles]);

@Injectable()
export class RoomAttentionTagsService {
  constructor(private readonly prisma: PrismaService) {}

  private async context(userId: string, workSessionId: string) {
    const session = await this.prisma.workSession.findFirst({
      where: {
        id: workSessionId,
        profileId: userId,
        status: "ACTIVE",
        endedAt: null,
      },
      include: { branch: true, shift: true },
    });
    if (!session)
      throw new ForbiddenException(
        "Phiên làm việc không hợp lệ hoặc đã kết thúc",
      );
    const membership = await this.prisma.branchMembership.findFirst({
      where: { profileId: userId, branchId: session.branchId, isActive: true },
      include: { role: true },
    });
    if (!membership)
      throw new ForbiddenException("Bạn không có quyền tại chi nhánh này");
    if (!writableRoles.has(membership.role.code))
      throw new ForbiddenException("Bạn không có quyền xem tag phòng của chi nhánh");
    return { session, membership };
  }

  private assertWritable(role: string) {
    if (!writableRoles.has(role))
      throw new ForbiddenException(
        "Chỉ Lễ tân hoặc Quản lý được cập nhật tag phòng",
      );
  }
  private assertManagement(role: string) {
    if (!managementRoles.has(role))
      throw new ForbiddenException(
        "Chỉ Quản lý hoặc Quản trị viên được hủy tag tạo nhầm",
      );
  }

  private async audit(
    tx: Prisma.TransactionClient,
    tag: { id: string; organizationId: string; branchId: string },
    actorId: string,
    role: string,
    action: string,
    oldValues: Prisma.InputJsonValue | undefined,
    newValues: Prisma.InputJsonValue,
    evidence: Evidence,
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: tag.organizationId,
        branchId: tag.branchId,
        actorId,
        actorRole: role,
        action,
        entityType: "ROOM_ATTENTION_TAG",
        entityId: tag.id,
        oldValues,
        newValues,
        requestId: evidence.requestId,
        ipAddress: evidence.ipAddress,
        userAgent: evidence.userAgent,
      },
    });
  }

  private decorate<
    T extends {
      priority: RoomAttentionPriority;
      expectedCheckOutDate: Date;
      updatedAt: Date;
    },
  >(tag: T) {
    const now = Date.now();
    const checkout = tag.expectedCheckOutDate.getTime();
    return {
      ...tag,
      alerts: {
        urgent: tag.priority === RoomAttentionPriority.URGENT,
        nearCheckout:
          checkout - now <= 36 * 60 * 60 * 1000 &&
          checkout >= now - 24 * 60 * 60 * 1000,
        stale: now - tag.updatedAt.getTime() >= 4 * 60 * 60 * 1000,
      },
    };
  }

  async list(userId: string, workSessionId: string, query: TagQuery) {
    const { session } = await this.context(userId, workSessionId);
    if (query.branchId && query.branchId !== session.branchId)
      throw new ForbiddenException("Không được xem tag của chi nhánh khác");
    const status =
      query.status &&
      Object.values(RoomAttentionStatus).includes(
        query.status as RoomAttentionStatus,
      )
        ? (query.status as RoomAttentionStatus)
        : undefined;
    const priority =
      query.priority &&
      Object.values(RoomAttentionPriority).includes(
        query.priority as RoomAttentionPriority,
      )
        ? (query.priority as RoomAttentionPriority)
        : undefined;
    const tagType =
      query.tagType &&
      Object.values(RoomAttentionTagType).includes(
        query.tagType as RoomAttentionTagType,
      )
        ? (query.tagType as RoomAttentionTagType)
        : undefined;
    const rows = await this.prisma.roomAttentionTag.findMany({
      where: {
        branchId: session.branchId,
        status:
          status ??
          (query.active === "false" ? undefined : { in: activeStatuses }),
        priority,
        tagType,
        roomNumber: query.roomNumber
          ? { contains: query.roomNumber, mode: "insensitive" }
          : undefined,
        expectedCheckOutDate: query.expectedCheckOutDate
          ? new Date(`${query.expectedCheckOutDate}T00:00:00.000Z`)
          : undefined,
      },
      include: {
        createdBy: { select: { id: true, fullName: true, employeeCode: true } },
        createdShiftInstance: { select: { id: true, shiftCode: true } },
        updates: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { actor: { select: { fullName: true } } },
        },
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    });
    const priorityRank: Record<RoomAttentionPriority, number> = {
      NORMAL: 0,
      IMPORTANT: 1,
      URGENT: 2,
    };
    return rows
      .sort(
        (a, b) =>
          priorityRank[b.priority] - priorityRank[a.priority] ||
          b.updatedAt.getTime() - a.updatedAt.getTime(),
      )
      .map((row) => this.decorate(row));
  }

  async checkoutWarning(
    userId: string,
    workSessionId: string,
    stayReference: string,
    roomNumber?: string,
  ) {
    const { session } = await this.context(userId, workSessionId);
    if (!stayReference?.trim())
      throw new BadRequestException(
        "Vui lòng cung cấp mã booking hoặc lượt lưu trú",
      );
    const tags = await this.prisma.roomAttentionTag.findMany({
      where: {
        branchId: session.branchId,
        stayReference: { equals: stayReference.trim(), mode: "insensitive" },
        roomNumber: roomNumber
          ? { equals: roomNumber.trim(), mode: "insensitive" }
          : undefined,
        status: { in: activeStatuses },
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    });
    return {
      hasActiveTags: tags.length > 0,
      count: tags.length,
      tags: tags.map((tag) => this.decorate(tag)),
    };
  }

  async get(userId: string, workSessionId: string, id: string) {
    const { session } = await this.context(userId, workSessionId);
    const tag = await this.prisma.roomAttentionTag.findFirst({
      where: { id, branchId: session.branchId },
      include: {
        createdBy: { select: { id: true, fullName: true, employeeCode: true } },
        closedBy: { select: { id: true, fullName: true } },
        createdShiftInstance: { select: { id: true, shiftCode: true } },
        updates: {
          orderBy: { createdAt: "asc" },
          include: {
            actor: { select: { id: true, fullName: true, employeeCode: true } },
            shiftInstance: { select: { id: true, shiftCode: true } },
          },
        },
      },
    });
    if (!tag) throw new NotFoundException("Không tìm thấy tag phòng");
    return this.decorate(tag);
  }

  async create(
    userId: string,
    workSessionId: string,
    input: unknown,
    evidence: Evidence = {},
  ) {
    const data = createRoomAttentionTagSchema.parse(input);
    const { session, membership } = await this.context(userId, workSessionId);
    this.assertWritable(membership.role.code);
    if (data.branchId !== session.branchId)
      throw new ForbiddenException("Không được tạo tag cho chi nhánh khác");
    const duplicate = await this.prisma.roomAttentionTag.findFirst({
      where: {
        branchId: session.branchId,
        stayReference: { equals: data.stayReference, mode: "insensitive" },
        roomNumber: { equals: data.roomNumber, mode: "insensitive" },
        tagType: data.tagType,
        status: { in: activeStatuses },
      },
      select: { id: true, title: true, status: true },
    });
    if (duplicate)
      throw new ConflictException({
        code: "DUPLICATE_ACTIVE_TAG",
        message:
          "Đã có tag đang hoạt động cho lượt lưu trú, phòng và loại vấn đề này. Hãy cập nhật tag cũ.",
        existingTag: duplicate,
      });
    return this.prisma.$transaction(async (tx) => {
      const tag = await tx.roomAttentionTag.create({
        data: {
          organizationId: session.organizationId,
          branchId: session.branchId,
          stayReference: data.stayReference,
          roomNumber: data.roomNumber,
          guestName: data.guestName,
          checkInDate: new Date(`${data.checkInDate}T00:00:00.000Z`),
          expectedCheckOutDate: new Date(
            `${data.expectedCheckOutDate}T00:00:00.000Z`,
          ),
          tagType: data.tagType,
          priority: data.priority,
          title: data.title,
          details: data.details,
          createdById: userId,
          createdWorkSessionId: session.id,
          createdShiftInstanceId: session.shiftInstanceId,
        },
      });
      await tx.roomAttentionTagUpdate.create({
        data: {
          tagId: tag.id,
          content: data.details,
          action: "CREATED",
          actorId: userId,
          workSessionId: session.id,
          shiftInstanceId: session.shiftInstanceId,
          newValues: {
            status: tag.status,
            priority: tag.priority,
            title: tag.title,
          },
        },
      });
      await this.audit(
        tx,
        tag,
        userId,
        membership.role.code,
        "ROOM_ATTENTION_TAG_CREATED",
        undefined,
        { status: tag.status, priority: tag.priority, title: tag.title },
        evidence,
      );
      return tag;
    });
  }

  async update(
    userId: string,
    workSessionId: string,
    id: string,
    input: unknown,
    evidence: Evidence = {},
  ) {
    const data = updateRoomAttentionTagSchema.parse(input);
    const { session, membership } = await this.context(userId, workSessionId);
    this.assertWritable(membership.role.code);
    const current = await this.prisma.roomAttentionTag.findFirst({
      where: { id, branchId: session.branchId },
    });
    if (!current) throw new NotFoundException("Không tìm thấy tag phòng");
    if (!activeStatuses.includes(current.status))
      throw new BadRequestException(
        "Tag đã đóng hoặc bị hủy, không thể cập nhật",
      );
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.roomAttentionTag.update({
        where: { id },
        data: { priority: data.priority, status: data.status },
      });
      await tx.roomAttentionTagUpdate.create({
        data: {
          tagId: id,
          content: data.content,
          action: "UPDATED",
          actorId: userId,
          workSessionId: session.id,
          shiftInstanceId: session.shiftInstanceId,
          oldValues: { priority: current.priority, status: current.status },
          newValues: { priority: updated.priority, status: updated.status },
        },
      });
      await this.audit(
        tx,
        current,
        userId,
        membership.role.code,
        "ROOM_ATTENTION_TAG_UPDATED",
        { priority: current.priority, status: current.status },
        {
          priority: updated.priority,
          status: updated.status,
          content: data.content,
        },
        evidence,
      );
      return updated;
    });
  }

  async close(
    userId: string,
    workSessionId: string,
    id: string,
    input: unknown,
    evidence: Evidence = {},
  ) {
    const data = closeRoomAttentionTagSchema.parse(input);
    const { session, membership } = await this.context(userId, workSessionId);
    this.assertWritable(membership.role.code);
    const current = await this.prisma.roomAttentionTag.findFirst({
      where: { id, branchId: session.branchId },
    });
    if (!current) throw new NotFoundException("Không tìm thấy tag phòng");
    if (!activeStatuses.includes(current.status))
      throw new BadRequestException("Tag không còn hoạt động");
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (
      current.status !== RoomAttentionStatus.RESOLVED &&
      current.expectedCheckOutDate > today
    )
      throw new BadRequestException(
        "Chỉ đóng tag khi vấn đề đã xử lý hoặc khách đến ngày check-out",
      );
    return this.finish(
      session,
      membership.role.code,
      userId,
      current,
      RoomAttentionStatus.CLOSED,
      "CLOSED",
      data,
      evidence,
    );
  }

  async cancel(
    userId: string,
    workSessionId: string,
    id: string,
    input: unknown,
    evidence: Evidence = {},
  ) {
    const data = cancelRoomAttentionTagSchema.parse(input);
    const { session, membership } = await this.context(userId, workSessionId);
    this.assertManagement(membership.role.code);
    const current = await this.prisma.roomAttentionTag.findFirst({
      where: { id, branchId: session.branchId },
    });
    if (!current) throw new NotFoundException("Không tìm thấy tag phòng");
    if (!activeStatuses.includes(current.status))
      throw new BadRequestException("Tag không còn hoạt động");
    return this.finish(
      session,
      membership.role.code,
      userId,
      current,
      RoomAttentionStatus.CANCELLED,
      "CANCELLED",
      data,
      evidence,
    );
  }

  private finish(
    session: { id: string; shiftInstanceId: string },
    role: string,
    userId: string,
    current: {
      id: string;
      organizationId: string;
      branchId: string;
      priority: RoomAttentionPriority;
      status: RoomAttentionStatus;
    },
    status: RoomAttentionStatus,
    action: string,
    data: { closeReason: string; finalResult: string },
    evidence: Evidence,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.roomAttentionTag.update({
        where: { id: current.id },
        data: {
          status,
          closedById: userId,
          closedAt: now,
          closeReason: data.closeReason,
          finalResult: data.finalResult,
        },
      });
      await tx.roomAttentionTagUpdate.create({
        data: {
          tagId: current.id,
          content: data.finalResult,
          action,
          actorId: userId,
          workSessionId: session.id,
          shiftInstanceId: session.shiftInstanceId,
          oldValues: { status: current.status },
          newValues: {
            status,
            closeReason: data.closeReason,
            finalResult: data.finalResult,
          },
        },
      });
      await this.audit(
        tx,
        current,
        userId,
        role,
        `ROOM_ATTENTION_TAG_${action}`,
        { status: current.status },
        {
          status,
          closeReason: data.closeReason,
          finalResult: data.finalResult,
        },
        evidence,
      );
      return updated;
    });
  }
}
