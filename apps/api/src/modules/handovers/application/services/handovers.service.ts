import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { HandoverStatus, ParticipantType } from "@prisma/client";
import { createHandoverSchema, transitionReasonSchema } from "@a25/validation";
import { PrismaService } from "../../../../infrastructure/database/prisma/prisma.service";
const transitions: Record<HandoverStatus, HandoverStatus[]> = {
  DRAFT: [HandoverStatus.SUBMITTED, HandoverStatus.CANCELLED],
  SUBMITTED: [HandoverStatus.PENDING_RECEIVER_CONFIRMATION],
  PENDING_RECEIVER_CONFIRMATION: [
    HandoverStatus.CONFIRMED,
    HandoverStatus.SUPPLEMENT_REQUESTED,
  ],
  SUPPLEMENT_REQUESTED: [HandoverStatus.RESUBMITTED],
  RESUBMITTED: [HandoverStatus.PENDING_RECEIVER_CONFIRMATION],
  CONFIRMED: [HandoverStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
  OVERDUE: [HandoverStatus.CONFIRMED, HandoverStatus.SUPPLEMENT_REQUESTED],
};
@Injectable()
export class HandoversService {
  constructor(private readonly prisma: PrismaService) {}
  private async context(userId: string, branchId: string) {
    const membership = await this.prisma.branchMembership.findFirst({
      where: { profileId: userId, branchId, isActive: true },
      include: { branch: true },
    });
    if (!membership)
      throw new ForbiddenException("Bạn không có quyền tại chi nhánh này");
    return membership;
  }
  async list(
    userId: string,
    query: {
      branchId?: string;
      status?: HandoverStatus;
      page?: number;
      pageSize?: number;
    },
  ) {
    const memberships = await this.prisma.branchMembership.findMany({
      where: { profileId: userId, isActive: true },
      select: { branchId: true },
    });
    const branchIds = query.branchId
      ? [query.branchId]
      : memberships.map((x) => x.branchId);
    return this.prisma.handover.findMany({
      where: { branchId: { in: branchIds }, status: query.status },
      select: {
        id: true,
        code: true,
        status: true,
        branchId: true,
        createdAt: true,
        submittedAt: true,
        participants: {
          select: {
            participantType: true,
            user: {select: {id: true, fullName: true}},
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
      take: query.pageSize ?? 20,
    });
  }
  async get(userId: string, id: string) {
    const handover = await this.prisma.handover.findUnique({
      where: { id },
      include: { participants: { include: { user: true } }, items: true },
    });
    if (!handover) throw new NotFoundException("Không tìm thấy phiếu bàn giao");
    await this.context(userId, handover.branchId);
    return handover;
  }
  async create(userId: string, input: unknown, requestId?: string) {
    const data = createHandoverSchema.parse(input);
    const membership = await this.context(userId, data.branchId);
    const receiver = await this.prisma.branchMembership.findFirst({
      where: {
        profileId: data.receiverId,
        branchId: data.branchId,
        isActive: true,
      },
    });
    if (!receiver)
      throw new BadRequestException("Người nhận không thuộc chi nhánh");
    if (data.receiverId === userId)
      throw new BadRequestException("Người giao và người nhận phải khác nhau");
    const handoverId = crypto.randomUUID();
    const code = `BG-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const [handover] = await this.prisma.$transaction([
      this.prisma.handover.create({
        data: {
          id: handoverId,
          organizationId: membership.branch.organizationId,
          branchId: data.branchId,
          shiftInstanceId: data.shiftInstanceId,
          code,
          notes: data.notes,
          createdBy: userId,
          participants: {
            create: [
              {
                organizationId: membership.branch.organizationId,
                branchId: data.branchId,
                userId,
                participantType: ParticipantType.GIVER,
                createdBy: userId,
              },
              {
                organizationId: membership.branch.organizationId,
                branchId: data.branchId,
                userId: data.receiverId,
                participantType: ParticipantType.RECEIVER,
                createdBy: userId,
              },
            ],
          },
          items: { create: data.items },
        },
      }),
      this.prisma.checklistResult.createMany({
        data: ["GUEST_NOTES", "CASH", "KEYS"].map((itemCode) => ({
          handoverId,
          itemCode,
        })),
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId: membership.branch.organizationId,
          branchId: data.branchId,
          actorId: userId,
          action: "HANDOVER_CREATED",
          entityType: "HANDOVER",
          entityId: handoverId,
          newValues: { status: HandoverStatus.DRAFT },
          requestId,
        },
      }),
      this.prisma.outboxEvent.create({
        data: {
          aggregateType: "HANDOVER",
          aggregateId: handoverId,
          eventType: "handover.created",
          payload: { handoverId, branchId: data.branchId },
          idempotencyKey: `handover.created:${handoverId}`,
        },
      }),
    ]);
    return handover;
  }
  async completeChecklist(userId: string, id: string, itemCode: string) {
    const handover = await this.get(userId, id);
    if (handover.status !== HandoverStatus.DRAFT)
      throw new BadRequestException(
        "Chỉ được cập nhật checklist khi phiếu còn nháp",
      );
    return this.prisma.checklistResult.update({
      where: { handoverId_itemCode: { handoverId: id, itemCode } },
      data: { isCompleted: true, completedBy: userId },
    });
  }
  private async transition(
    userId: string,
    id: string,
    next: HandoverStatus,
    reason?: string,
    requestId?: string,
  ) {
    const handover = await this.get(userId, id);
    if (!transitions[handover.status].includes(next))
      throw new BadRequestException(
        "Không thể chuyển phiếu ở trạng thái hiện tại",
      );
    if (next === HandoverStatus.SUBMITTED) {
      const checks = await this.prisma.checklistResult.findMany({
        where: { handoverId: id },
      });
      if (!checks.length || checks.some((x) => !x.isCompleted))
        throw new BadRequestException("Vui lòng hoàn thành checklist bắt buộc");
    }
    if (next === HandoverStatus.CONFIRMED) {
      const receiver = handover.participants.find(
        (x) =>
          x.participantType === ParticipantType.RECEIVER &&
          x.assignmentStatus === "ASSIGNED",
      );
      if (receiver?.userId !== userId)
        throw new ForbiddenException(
          "Chỉ người nhận được phân công mới có thể xác nhận",
        );
      if (handover.createdBy === userId)
        throw new ForbiddenException(
          "Không được tự xác nhận phiếu của chính mình",
        );
    }
    const now = new Date();
    const nextVersion = handover.version + 1;
    const [updated] = await this.prisma.$transaction([
      this.prisma.handover.update({
        where: { id, version: handover.version },
        data: {
          status: next,
          version: { increment: 1 },
          submittedAt: next === HandoverStatus.SUBMITTED ? now : undefined,
          confirmedAt: next === HandoverStatus.CONFIRMED ? now : undefined,
        },
      }),
      this.prisma.handoverParticipant.updateMany({
        where:
          next === HandoverStatus.CONFIRMED
            ? {
                handoverId: id,
                userId,
                participantType: ParticipantType.RECEIVER,
              }
            : { id: "00000000-0000-0000-0000-000000000000" },
        data: {
          confirmedAt: now,
          acknowledgedAt: now,
          assignmentStatus: "CONFIRMED",
        },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId: handover.organizationId,
          branchId: handover.branchId,
          actorId: userId,
          action: `HANDOVER_${next}`,
          entityType: "HANDOVER",
          entityId: id,
          oldValues: { status: handover.status },
          newValues: { status: next },
          reason,
          requestId,
        },
      }),
      this.prisma.outboxEvent.upsert({
        where: {
          idempotencyKey: `handover.${next.toLowerCase()}:${id}:${nextVersion}`,
        },
        create: {
          aggregateType: "HANDOVER",
          aggregateId: id,
          eventType: `handover.${next.toLowerCase()}`,
          payload: { handoverId: id, branchId: handover.branchId },
          idempotencyKey: `handover.${next.toLowerCase()}:${id}:${nextVersion}`,
        },
        update: {},
      }),
    ]);
    return updated;
  }
  submit(u: string, id: string, r?: string) {
    return this.transition(u, id, HandoverStatus.SUBMITTED, undefined, r).then(
      () =>
        this.transition(
          u,
          id,
          HandoverStatus.PENDING_RECEIVER_CONFIRMATION,
          undefined,
          r,
        ),
    );
  }
  confirm(u: string, id: string, r?: string) {
    return this.transition(u, id, HandoverStatus.CONFIRMED, undefined, r);
  }
  requestSupplement(u: string, id: string, input: unknown, r?: string) {
    const { reason } = transitionReasonSchema.parse(input);
    return this.transition(
      u,
      id,
      HandoverStatus.SUPPLEMENT_REQUESTED,
      reason,
      r,
    );
  }
  resubmit(u: string, id: string, r?: string) {
    return this.transition(
      u,
      id,
      HandoverStatus.RESUBMITTED,
      undefined,
      r,
    ).then(() =>
      this.transition(
        u,
        id,
        HandoverStatus.PENDING_RECEIVER_CONFIRMATION,
        undefined,
        r,
      ),
    );
  }
  async history(userId: string, id: string) {
    const handover = await this.get(userId, id);
    return this.prisma.auditLog.findMany({
      where: { entityType: "HANDOVER", entityId: handover.id },
      orderBy: { createdAt: "asc" },
    });
  }
  async participants(userId: string, branchId?: string) {
    const memberships = await this.prisma.branchMembership.findMany({
      where: { profileId: userId, isActive: true },
      select: { branchId: true },
    });
    return this.prisma.handoverParticipant.findMany({
      where: {
        branchId: {
          in: branchId ? [branchId] : memberships.map((x) => x.branchId),
        },
      },
      include: { user: true, handover: true },
      orderBy: { assignedAt: "desc" },
    });
  }
}
