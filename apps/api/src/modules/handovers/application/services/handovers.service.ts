import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  HandoverStatus,
  ParticipantType,
  Prisma,
} from "@prisma/client";
import {
  createHandoverSchema,
  receiverAmendmentSchema,
  receiverSignatureSchema,
  receiverSupplementSchema,
  signatureSchema,
  transitionReasonSchema,
} from "@a25/validation";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../../../../infrastructure/database/prisma/prisma.service";

type RequestEvidence = {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
};

type VerifiedEmployee = {
  id: string;
  fullName: string;
  employeeCode: string | null;
};

@Injectable()
export class HandoversService {
  private readonly logger = new Logger(HandoversService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async context(userId: string, branchId: string) {
    const membership = await this.prisma.branchMembership.findFirst({
      where: { profileId: userId, branchId, isActive: true },
      include: { branch: true, role: true, profile: true },
    });
    if (!membership)
      throw new ForbiddenException("Bạn không có quyền tại chi nhánh này");
    return membership;
  }

  private normalizeName(value: string) {
    return value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("vi");
  }

  private assertSignatureName(fullName: string, signatureText: string) {
    if (this.normalizeName(fullName) !== this.normalizeName(signatureText))
      throw new BadRequestException("Họ tên ký xác nhận chưa khớp với tài khoản");
  }

  private signatureHash(
    handoverId: string,
    userId: string,
    signatureText: string,
    signedAt: Date,
  ) {
    return createHash("sha256")
      .update(
        [
          handoverId,
          userId,
          this.normalizeName(signatureText),
          signedAt.toISOString(),
        ].join(":"),
      )
      .digest("hex");
  }

  private signatureData(
    handoverId: string,
    userId: string,
    signatureText: string,
    signedAt: Date,
    evidence: RequestEvidence,
    method: "AUTHENTICATED_SESSION" | "TEMPORARY_EMPLOYEE_LOGIN",
  ) {
    return {
      assignmentStatus: "CONFIRMED",
      acknowledgedAt: signedAt,
      confirmedAt: signedAt,
      signatureText,
      signatureHash: this.signatureHash(
        handoverId,
        userId,
        signatureText,
        signedAt,
      ),
      signatureMethod: method,
      ipAddress: evidence.ipAddress,
      userAgent: evidence.userAgent,
    };
  }

  private async audit(
    tx: Prisma.TransactionClient,
    handover: {
      id: string;
      organizationId: string;
      branchId: string;
      status: HandoverStatus;
      version: number;
    },
    actorId: string,
    action: string,
    nextStatus: HandoverStatus,
    evidence: RequestEvidence,
    role?: string,
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: handover.organizationId,
        branchId: handover.branchId,
        actorId,
        actorRole: role,
        action,
        entityType: "HANDOVER",
        entityId: handover.id,
        oldValues: { status: handover.status },
        newValues: { status: nextStatus },
        requestId: evidence.requestId,
        ipAddress: evidence.ipAddress,
        userAgent: evidence.userAgent,
      },
    });
    await tx.outboxEvent.upsert({
      where: {
        idempotencyKey: `${action.toLowerCase()}:${handover.id}:${handover.version + 1}`,
      },
      create: {
        aggregateType: "HANDOVER",
        aggregateId: handover.id,
        eventType: action.toLowerCase().replaceAll("_", "."),
        payload: {
          handoverId: handover.id,
          branchId: handover.branchId,
          status: nextStatus,
        },
        idempotencyKey: `${action.toLowerCase()}:${handover.id}:${handover.version + 1}`,
      },
      update: {},
    });
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
      : memberships.map((item) => item.branchId);
    return this.prisma.handover.findMany({
      where: { branchId: { in: branchIds }, status: query.status },
      select: {
        id: true,
        code: true,
        status: true,
        branchId: true,
        createdAt: true,
        submittedAt: true,
        lockedAt: true,
        participants: {
          select: {
            participantType: true,
            confirmedAt: true,
            user: { select: { id: true, fullName: true } },
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
      include: {
        participants: { include: { user: true } },
        items: true,
        checklistResults: true,
        amendments: { orderBy: { createdAt: "asc" } },
      },
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

    const handoverId = randomUUID();
    const code = `BG-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
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
          actorRole: membership.role.code,
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
        "Chỉ được cập nhật kiểm kê khi phiếu còn nháp",
      );
    if (handover.createdBy !== userId)
      throw new ForbiddenException("Chỉ người giao được xác nhận kiểm kê đầu tiên");
    return this.prisma.checklistResult.update({
      where: { handoverId_itemCode: { handoverId: id, itemCode } },
      data: {
        isCompleted: true,
        completedBy: userId,
        completedAt: new Date(),
      },
    });
  }

  async submit(
    userId: string,
    id: string,
    input: unknown,
    evidence: RequestEvidence = {},
  ) {
    const { signatureText } = signatureSchema.parse(input);
    const handover = await this.get(userId, id);
    const membership = await this.context(userId, handover.branchId);
    if (
      handover.status !== HandoverStatus.DRAFT &&
      handover.status !== HandoverStatus.RESUBMITTED &&
      handover.status !== HandoverStatus.SUPPLEMENT_REQUESTED
    )
      throw new BadRequestException("Phiếu không ở trạng thái có thể gửi");
    if (handover.createdBy !== userId)
      throw new ForbiddenException("Chỉ người giao được ký và gửi phiếu");

    const giver = handover.participants.find(
      (item) => item.participantType === ParticipantType.GIVER,
    );
    if (!giver) throw new BadRequestException("Phiếu chưa có người giao");
    this.assertSignatureName(giver.user.fullName, signatureText);
    if (
      !handover.checklistResults.length ||
      handover.checklistResults.some((item) => !item.isCompleted)
    )
      throw new BadRequestException("Vui lòng hoàn thành kiểm kê bắt buộc");

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.handover.update({
        where: { id, version: handover.version },
        data: {
          status: HandoverStatus.PENDING_RECEIVER_CONFIRMATION,
          version: { increment: 1 },
          submittedAt: now,
        },
      });
      await tx.handoverParticipant.update({
        where: {
          handoverId_participantType: {
            handoverId: id,
            participantType: ParticipantType.GIVER,
          },
        },
        data: this.signatureData(
          id,
          userId,
          signatureText,
          now,
          evidence,
          "AUTHENTICATED_SESSION",
        ),
      });
      await this.audit(
        tx,
        handover,
        userId,
        "HANDOVER_GIVER_SIGNED",
        HandoverStatus.PENDING_RECEIVER_CONFIRMATION,
        evidence,
        membership.role.code,
      );
      return updated;
    });
  }

  private async verifyTemporaryReceiver(
    branchAccountId: string,
    branchId: string,
    username: string,
    password: string,
  ) {
    const account = await this.prisma.branchMembership.findFirst({
      where: {
        profileId: branchAccountId,
        branchId,
        isActive: true,
        role: { code: "BRANCH_ACCOUNT" },
      },
    });
    if (!account)
      throw new ForbiddenException("Tài khoản chi nhánh không hợp lệ");

    const rows = await this.prisma.$queryRaw<VerifiedEmployee[]>(Prisma.sql`
      select profile.id,
             profile.full_name as "fullName",
             profile.employee_code as "employeeCode"
      from employee_credentials credential
      join profiles profile on profile.id=credential.profile_id
      join branch_memberships membership
        on membership.profile_id=profile.id
       and membership.branch_id=${branchId}::uuid
       and membership.is_active
      where profile.is_active
        and credential.username=lower(trim(${username}))
        and credential.password_hash=extensions.crypt(${password},credential.password_hash)
      limit 1
    `);
    if (!rows[0])
      throw new UnauthorizedException(
        "Tài khoản hoặc mật khẩu người nhận chưa chính xác",
      );
    return rows[0];
  }

  async receiverSignAndTransfer(
    branchAccountId: string,
    currentWorkSessionId: string | undefined,
    id: string,
    input: unknown,
    evidence: RequestEvidence = {},
  ) {
    const data = receiverSignatureSchema.parse(input);
    const handover = await this.prisma.handover.findUnique({
      where: { id },
      include: {
        participants: { include: { user: true } },
        checklistResults: true,
      },
    });
    if (!handover) throw new NotFoundException("Không tìm thấy phiếu bàn giao");
    if (
      handover.status !== HandoverStatus.PENDING_RECEIVER_CONFIRMATION &&
      handover.status !== HandoverStatus.OVERDUE
    )
      throw new BadRequestException("Phiếu chưa sẵn sàng để người nhận ký");
    if (!currentWorkSessionId)
      throw new UnauthorizedException("Không tìm thấy phiên của người giao");

    const employee = await this.verifyTemporaryReceiver(
      branchAccountId,
      handover.branchId,
      data.username,
      data.password,
    );
    const receiver = handover.participants.find(
      (item) => item.participantType === ParticipantType.RECEIVER,
    );
    if (receiver?.userId !== employee.id)
      throw new ForbiddenException(
        "Chỉ người nhận được phân công mới có thể ký phiếu",
      );
    this.assertSignatureName(employee.fullName, data.signatureText);
    if (handover.createdBy === employee.id)
      throw new ForbiddenException("Người giao không được tự nhận phiếu");
    if (
      !handover.checklistResults.length ||
      handover.checklistResults.some((item) => !item.isCompleted)
    )
      throw new BadRequestException("Người giao chưa hoàn tất kiểm kê");

    const giverSession = await this.prisma.workSession.findFirst({
      where: {
        id: currentWorkSessionId,
        authenticatedBy: branchAccountId,
        profileId: handover.createdBy,
        branchId: handover.branchId,
        status: "ACTIVE",
        endedAt: null,
      },
    });
    if (!giverSession)
      throw new UnauthorizedException("Phiên làm việc của người giao đã hết hạn");

    const now = new Date();
    const oneHourAhead = new Date(now.getTime() + 60 * 60 * 1000);
    let receiverSession = await this.prisma.workSession.findFirst({
      where: {
        profileId: employee.id,
        branchId: handover.branchId,
        status: "ACTIVE",
        endedAt: null,
      },
    });
    const receiverShift = receiverSession
      ? null
      : await this.prisma.shiftInstance.findFirst({
          where: {
            branchId: handover.branchId,
            startsAt: { lte: oneHourAhead },
            endsAt: { gte: now },
          },
          orderBy: { startsAt: "desc" },
        });
    if (!receiverSession && !receiverShift)
      throw new BadRequestException(
        "Không tìm thấy ca phù hợp để chuyển phiên cho người nhận",
      );

    try {
      return await this.prisma.$transaction(async (tx) => {
      await tx.workSession.update({
        where: { id: giverSession.id },
        data: { status: "TRANSFERRED", endedAt: now },
      });

      if (receiverSession) {
        receiverSession = await tx.workSession.update({
          where: { id: receiverSession.id },
          data: {
            authenticatedBy: branchAccountId,
            transferredFromSessionId: giverSession.id,
          },
        });
      } else {
        await tx.shiftAssignment.upsert({
          where: {
            shiftInstanceId_profileId: {
              shiftInstanceId: receiverShift!.id,
              profileId: employee.id,
            },
          },
          create: {
            shiftInstanceId: receiverShift!.id,
            profileId: employee.id,
            assignmentType: "RECEPTIONIST",
          },
          update: {},
        });
        const differenceMinutes = Math.round(
          (now.getTime() - receiverShift!.startsAt.getTime()) / 60000,
        );
        receiverSession = await tx.workSession.create({
          data: {
            organizationId: receiverShift!.organizationId,
            profileId: employee.id,
            authenticatedBy: branchAccountId,
            branchId: handover.branchId,
            shiftInstanceId: receiverShift!.id,
            scheduleMatch:
              Math.abs(differenceMinutes) <= 15
                ? "ON_TIME"
                : differenceMinutes < 0
                  ? "EARLY"
                  : "LATE",
            scheduledStart: receiverShift!.startsAt,
            actualStart: now,
            transferredFromSessionId: giverSession.id,
          },
        });
      }

      await tx.checklistResult.updateMany({
        where: { handoverId: id, isCompleted: true },
        data: {
          receiverCheckedBy: employee.id,
          receiverCheckedAt: now,
        },
      });
      await tx.handoverParticipant.update({
        where: {
          handoverId_participantType: {
            handoverId: id,
            participantType: ParticipantType.RECEIVER,
          },
        },
        data: this.signatureData(
          id,
          employee.id,
          data.signatureText,
          now,
          evidence,
          "TEMPORARY_EMPLOYEE_LOGIN",
        ),
      });
      await tx.handover.update({
        where: { id, version: handover.version },
        data: {
          status: HandoverStatus.PENDING_MANAGEMENT_APPROVAL,
          version: { increment: 1 },
          confirmedAt: now,
          operationalLockedAt: now,
        },
      });
      await this.audit(
        tx,
        handover,
        employee.id,
        "HANDOVER_RECEIVER_SIGNED_AND_SESSION_TRANSFERRED",
        HandoverStatus.PENDING_MANAGEMENT_APPROVAL,
        evidence,
        "RECEIVER",
      );

      return {
        workSession: {
          id: receiverSession.id,
          branchId: receiverSession.branchId,
        },
        employee,
        status: HandoverStatus.PENDING_MANAGEMENT_APPROVAL,
      };
      });
    } catch (error) {
      this.logger.error(
        `Receiver signature transfer failed [handoverId=${id}, requestId=${evidence.requestId ?? "n/a"}]`,
        error instanceof Error ? error.stack : String(error),
      );
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException(
          "Người nhận đã có một phiên làm việc đang hoạt động. Vui lòng tải lại.",
        );
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      )
        throw new ConflictException(
          "Phiếu hoặc phiên làm việc vừa được thay đổi. Vui lòng tải lại.",
        );
      throw error;
    }
  }

  async receiverRequestSupplement(
    branchAccountId: string,
    id: string,
    input: unknown,
    evidence: RequestEvidence = {},
  ) {
    const data = receiverSupplementSchema.parse(input);
    const handover = await this.prisma.handover.findUnique({
      where: { id },
      include: { participants: true },
    });
    if (!handover) throw new NotFoundException("Không tìm thấy phiếu bàn giao");
    if (
      handover.status !== HandoverStatus.PENDING_RECEIVER_CONFIRMATION &&
      handover.status !== HandoverStatus.OVERDUE
    )
      throw new BadRequestException("Phiếu không ở bước yêu cầu bổ sung");
    const employee = await this.verifyTemporaryReceiver(
      branchAccountId,
      handover.branchId,
      data.username,
      data.password,
    );
    const receiver = handover.participants.find(
      (item) => item.participantType === ParticipantType.RECEIVER,
    );
    if (receiver?.userId !== employee.id)
      throw new ForbiddenException(
        "Chỉ người nhận được phân công mới có thể yêu cầu bổ sung",
      );
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.handover.update({
        where: { id, version: handover.version },
        data: {
          status: HandoverStatus.SUPPLEMENT_REQUESTED,
          version: { increment: 1 },
        },
      });
      await tx.handoverAmendment.create({
        data: {
          handoverId: id,
          reason: data.reason,
          content: { requestedAt: new Date().toISOString() },
          createdBy: employee.id,
        },
      });
      await this.audit(
        tx,
        handover,
        employee.id,
        "HANDOVER_SUPPLEMENT_REQUESTED",
        HandoverStatus.SUPPLEMENT_REQUESTED,
        evidence,
        "RECEIVER",
      );
      return updated;
    });
  }

  private async approvalSign(
    userId: string,
    id: string,
    input: unknown,
    evidence: RequestEvidence,
    participantType: "SUPERVISOR" | "APPROVER",
  ) {
    const { signatureText } = signatureSchema.parse(input);
    const handover = await this.get(userId, id);
    const management = participantType === ParticipantType.SUPERVISOR;
    const expected = management
      ? HandoverStatus.PENDING_MANAGEMENT_APPROVAL
      : HandoverStatus.PENDING_ACCOUNTING_APPROVAL;
    const next = management
      ? HandoverStatus.PENDING_ACCOUNTING_APPROVAL
      : HandoverStatus.COMPLETED;
    if (handover.status !== expected)
      throw new BadRequestException("Phiếu chưa đến bước ký duyệt này");

    const membership = await this.context(userId, handover.branchId);
    const allowedRoles = management
      ? [
          "BRANCH_DIRECTOR",
          "DEPUTY_BRANCH_DIRECTOR",
          "BRANCH_MANAGER",
          "ADMIN",
        ]
      : ["ACCOUNTANT", "CHIEF_ACCOUNTANT", "ADMIN"];
    if (!allowedRoles.includes(membership.role.code))
      throw new ForbiddenException(
        management
          ? "Chỉ BGĐ hoặc Phó BGĐ cơ sở được ký bước này"
          : "Chỉ kế toán được ký bước này",
      );
    if (
      handover.participants.some(
        (item) =>
          item.userId === userId &&
          item.participantType !== participantType,
      )
    )
      throw new ForbiddenException(
        "Một người không được ký thay cho nhiều vai trò trên cùng phiếu",
      );
    this.assertSignatureName(membership.profile.fullName, signatureText);

    const requiredBefore = management
      ? [ParticipantType.GIVER, ParticipantType.RECEIVER]
      : [
          ParticipantType.GIVER,
          ParticipantType.RECEIVER,
          ParticipantType.SUPERVISOR,
        ];
    if (
      requiredBefore.some(
        (type) =>
          !handover.participants.some(
            (item) => item.participantType === type && item.confirmedAt,
          ),
      )
    )
      throw new BadRequestException("Phiếu chưa đủ chữ ký ở bước trước");

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.handoverParticipant.upsert({
        where: {
          handoverId_participantType: {
            handoverId: id,
            participantType,
          },
        },
        create: {
          organizationId: handover.organizationId,
          branchId: handover.branchId,
          handoverId: id,
          userId,
          participantType,
          createdBy: userId,
          ...this.signatureData(
            id,
            userId,
            signatureText,
            now,
            evidence,
            "AUTHENTICATED_SESSION",
          ),
        },
        update: {
          userId,
          ...this.signatureData(
            id,
            userId,
            signatureText,
            now,
            evidence,
            "AUTHENTICATED_SESSION",
          ),
        },
      });
      const updated = await tx.handover.update({
        where: { id, version: handover.version },
        data: {
          status: next,
          version: { increment: 1 },
          completedAt: next === HandoverStatus.COMPLETED ? now : undefined,
          lockedAt: next === HandoverStatus.COMPLETED ? now : undefined,
        },
      });
      await this.audit(
        tx,
        handover,
        userId,
        management
          ? "HANDOVER_MANAGEMENT_SIGNED"
          : "HANDOVER_ACCOUNTING_SIGNED_AND_LOCKED",
        next,
        evidence,
        membership.role.code,
      );
      return updated;
    });
  }

  managementSign(
    userId: string,
    id: string,
    input: unknown,
    evidence: RequestEvidence = {},
  ) {
    return this.approvalSign(
      userId,
      id,
      input,
      evidence,
      ParticipantType.SUPERVISOR,
    );
  }

  accountingSign(
    userId: string,
    id: string,
    input: unknown,
    evidence: RequestEvidence = {},
  ) {
    return this.approvalSign(
      userId,
      id,
      input,
      evidence,
      ParticipantType.APPROVER,
    );
  }

  private async reviewReturn(
    userId: string,
    id: string,
    input: unknown,
    evidence: RequestEvidence,
    stage: "MANAGEMENT" | "ACCOUNTING",
  ) {
    const { reason } = transitionReasonSchema.parse(input);
    const handover = await this.get(userId, id);
    const management = stage === "MANAGEMENT";
    const expected = management
      ? HandoverStatus.PENDING_MANAGEMENT_APPROVAL
      : HandoverStatus.PENDING_ACCOUNTING_APPROVAL;
    const next = management
      ? HandoverStatus.MANAGEMENT_CHANGES_REQUESTED
      : HandoverStatus.ACCOUNTING_CHANGES_REQUESTED;
    if (handover.status !== expected)
      throw new BadRequestException("Phiếu chưa ở bước có thể trả lại");

    const membership = await this.context(userId, handover.branchId);
    const allowedRoles = management
      ? ["BRANCH_DIRECTOR", "DEPUTY_BRANCH_DIRECTOR", "BRANCH_MANAGER", "ADMIN"]
      : ["ACCOUNTANT", "CHIEF_ACCOUNTANT", "ADMIN"];
    if (!allowedRoles.includes(membership.role.code))
      throw new ForbiddenException(
        management
          ? "Chỉ BGĐ hoặc Phó BGĐ cơ sở được trả lại phiếu"
          : "Chỉ kế toán được trả lại phiếu",
      );

    return this.prisma.$transaction(async (tx) => {
      await tx.handoverParticipant.deleteMany({
        where: {
          handoverId: id,
          participantType: {
            in: [ParticipantType.SUPERVISOR, ParticipantType.APPROVER],
          },
        },
      });
      await tx.handoverAmendment.create({
        data: {
          handoverId: id,
          reason,
          content: {
            type: "REVIEW_RETURN",
            stage,
            returnedAt: new Date().toISOString(),
          },
          createdBy: userId,
        },
      });
      const updated = await tx.handover.update({
        where: { id, version: handover.version },
        data: { status: next, version: { increment: 1 } },
      });
      await this.audit(
        tx,
        handover,
        userId,
        management
          ? "HANDOVER_MANAGEMENT_RETURNED"
          : "HANDOVER_ACCOUNTING_RETURNED",
        next,
        evidence,
        membership.role.code,
      );
      return updated;
    });
  }

  managementReturn(
    userId: string,
    id: string,
    input: unknown,
    evidence: RequestEvidence = {},
  ) {
    return this.reviewReturn(userId, id, input, evidence, "MANAGEMENT");
  }

  accountingReturn(
    userId: string,
    id: string,
    input: unknown,
    evidence: RequestEvidence = {},
  ) {
    return this.reviewReturn(userId, id, input, evidence, "ACCOUNTING");
  }

  async receiverAmend(
    branchAccountId: string,
    currentWorkSessionId: string | undefined,
    id: string,
    input: unknown,
    evidence: RequestEvidence = {},
  ) {
    const data = receiverAmendmentSchema.parse(input);
    const handover = await this.prisma.handover.findUnique({
      where: { id },
      include: { participants: true, amendments: true },
    });
    if (!handover) throw new NotFoundException("Không tìm thấy phiếu bàn giao");
    if (
      handover.status !== HandoverStatus.MANAGEMENT_CHANGES_REQUESTED &&
      handover.status !== HandoverStatus.ACCOUNTING_CHANGES_REQUESTED
    )
      throw new BadRequestException("Phiếu không chờ người nhận điều chỉnh");

    const employee = await this.verifyTemporaryReceiver(
      branchAccountId,
      handover.branchId,
      data.username,
      data.password,
    );
    const receiver = handover.participants.find(
      (item) => item.participantType === ParticipantType.RECEIVER,
    );
    if (receiver?.userId !== employee.id)
      throw new ForbiddenException(
        "Chỉ người nhận của phiếu được tạo bản điều chỉnh",
      );
    this.assertSignatureName(employee.fullName, data.signatureText);
    if (!currentWorkSessionId)
      throw new UnauthorizedException(
        "Không tìm thấy phiên làm việc của người nhận",
      );
    const receiverSession = await this.prisma.workSession.findFirst({
      where: {
        id: currentWorkSessionId,
        authenticatedBy: branchAccountId,
        profileId: employee.id,
        branchId: handover.branchId,
        status: "ACTIVE",
        endedAt: null,
      },
    });
    if (!receiverSession)
      throw new UnauthorizedException(
        "Phiên làm việc của người nhận đã hết hạn",
      );

    const now = new Date();
    const returnedFrom = handover.status;
    return this.prisma.$transaction(async (tx) => {
      await tx.handoverAmendment.create({
        data: {
          handoverId: id,
          reason: data.reason,
          content: {
            type: "RECEIVER_ADJUSTMENT",
            revision: handover.amendments.length + 1,
            scope: data.scope,
            correction: data.correction,
            returnedFrom,
            signedAt: now.toISOString(),
          },
          createdBy: employee.id,
        },
      });
      await tx.handoverParticipant.update({
        where: {
          handoverId_participantType: {
            handoverId: id,
            participantType: ParticipantType.RECEIVER,
          },
        },
        data: this.signatureData(
          id,
          employee.id,
          data.signatureText,
          now,
          evidence,
          "TEMPORARY_EMPLOYEE_LOGIN",
        ),
      });
      await tx.handoverParticipant.deleteMany({
        where: {
          handoverId: id,
          participantType: {
            in: [ParticipantType.SUPERVISOR, ParticipantType.APPROVER],
          },
        },
      });
      const updated = await tx.handover.update({
        where: { id, version: handover.version },
        data: {
          status: HandoverStatus.PENDING_MANAGEMENT_APPROVAL,
          version: { increment: 1 },
        },
      });
      await this.audit(
        tx,
        handover,
        employee.id,
        "HANDOVER_RECEIVER_AMENDED_AND_RESIGNED",
        HandoverStatus.PENDING_MANAGEMENT_APPROVAL,
        evidence,
        "RECEIVER",
      );
      return updated;
    });
  }
  async requestSupplement(
    userId: string,
    id: string,
    input: unknown,
    evidence: RequestEvidence = {},
  ) {
    const { reason } = transitionReasonSchema.parse(input);
    const handover = await this.get(userId, id);
    if (
      handover.status !== HandoverStatus.PENDING_RECEIVER_CONFIRMATION &&
      handover.status !== HandoverStatus.OVERDUE
    )
      throw new BadRequestException("Phiếu không ở bước yêu cầu bổ sung");
    const receiver = handover.participants.find(
      (item) => item.participantType === ParticipantType.RECEIVER,
    );
    if (receiver?.userId !== userId)
      throw new ForbiddenException("Chỉ người nhận được yêu cầu bổ sung");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.handover.update({
        where: { id, version: handover.version },
        data: {
          status: HandoverStatus.SUPPLEMENT_REQUESTED,
          version: { increment: 1 },
        },
      });
      await tx.handoverAmendment.create({
        data: {
          handoverId: id,
          reason,
          content: { requestedAt: new Date().toISOString() },
          createdBy: userId,
        },
      });
      await this.audit(
        tx,
        handover,
        userId,
        "HANDOVER_SUPPLEMENT_REQUESTED",
        HandoverStatus.SUPPLEMENT_REQUESTED,
        evidence,
        "RECEIVER",
      );
      return updated;
    });
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
          in: branchId ? [branchId] : memberships.map((item) => item.branchId),
        },
      },
      include: { user: true, handover: true },
      orderBy: { assignedAt: "desc" },
    });
  }
}
