import { ConflictException, ForbiddenException } from "@nestjs/common";
import { RoomAttentionStatus } from "@prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma/prisma.service";
import { RoomAttentionTagsService } from "./room-attention-tags.service";

const userId = "10000000-0000-4000-8000-000000000001";
const session = {
  id: "20000000-0000-4000-8000-000000000001",
  profileId: userId,
  organizationId: "30000000-0000-4000-8000-000000000001",
  branchId: "40000000-0000-4000-8000-000000000001",
  shiftInstanceId: "50000000-0000-4000-8000-000000000001",
  status: "ACTIVE",
  endedAt: null,
  branch: { id: "40000000-0000-4000-8000-000000000001" },
  shift: { shiftCode: "CA1" },
};
const membership = { role: { code: "RECEPTIONIST" } };
const input = {
  branchId: session.branchId,
  stayReference: "BK-001",
  roomNumber: "512",
  guestName: "Nguyễn Văn A",
  checkInDate: "2026-07-27",
  expectedCheckOutDate: "2026-07-30",
  tagType: "SPECIAL_REQUEST",
  priority: "IMPORTANT",
  title: "Chuẩn bị thêm gối",
  details: "Chuẩn bị thêm hai gối trước 20:00.",
};
const tag = {
  id: "60000000-0000-4000-8000-000000000001",
  organizationId: session.organizationId,
  branchId: session.branchId,
  stayReference: input.stayReference,
  roomNumber: input.roomNumber,
  guestName: input.guestName,
  checkInDate: new Date("2026-07-27"),
  expectedCheckOutDate: new Date("2026-07-30"),
  tagType: "SPECIAL_REQUEST",
  priority: "IMPORTANT",
  title: input.title,
  details: input.details,
  status: RoomAttentionStatus.OPEN,
  createdById: userId,
  createdWorkSessionId: session.id,
  createdShiftInstanceId: session.shiftInstanceId,
  closedById: null,
  closedAt: null,
  closeReason: null,
  finalResult: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function fixture(role = "RECEPTIONIST") {
  const tx = {
    roomAttentionTag: {
      create: jest.fn().mockResolvedValue(tag),
      update: jest.fn().mockResolvedValue(tag),
    },
    roomAttentionTagUpdate: { create: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    workSession: { findFirst: jest.fn().mockResolvedValue(session) },
    branchMembership: {
      findFirst: jest.fn().mockResolvedValue({ role: { code: role } }),
    },
    roomAttentionTag: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  return {
    prisma,
    tx,
    service: new RoomAttentionTagsService(prisma as unknown as PrismaService),
  };
}

describe("RoomAttentionTagsService", () => {
  it("creates a branch-shared tag and first timeline entry", async () => {
    const { service, tx } = fixture();
    await service.create(userId, session.id, input);
    expect(tx.roomAttentionTag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          branchId: session.branchId,
          createdById: userId,
        }),
      }),
    );
    expect(tx.roomAttentionTagUpdate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tagId: tag.id,
          action: "CREATED",
          actorId: userId,
          shiftInstanceId: session.shiftInstanceId,
        }),
      }),
    );
  });
  it("rejects accounting from creating a tag", async () => {
    const { service, tx } = fixture("ACCOUNTANT");
    await expect(
      service.create(userId, session.id, input),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.roomAttentionTag.create).not.toHaveBeenCalled();
  });
  it("suggests the existing active tag instead of a duplicate", async () => {
    const { service, prisma } = fixture();
    prisma.roomAttentionTag.findFirst.mockResolvedValue({
      id: tag.id,
      title: tag.title,
      status: tag.status,
    });
    await expect(
      service.create(userId, session.id, input),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it("scopes active lists to the current branch", async () => {
    const { service, prisma } = fixture();
    await service.list(userId, session.id, { active: "true" });
    expect(prisma.roomAttentionTag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: session.branchId,
          status: { in: expect.arrayContaining([RoomAttentionStatus.OPEN]) },
        }),
      }),
    );
  });
  it("only lets management cancel a mistaken tag", async () => {
    const { service, prisma } = fixture();
    prisma.roomAttentionTag.findFirst.mockResolvedValue(tag);
    await expect(
      service.cancel(userId, session.id, tag.id, {
        closeReason: "Tạo nhầm tag",
        finalResult: "Không phát sinh xử lý",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("warns checkout callers when active tags remain", async () => {
    const { service, prisma } = fixture();
    prisma.roomAttentionTag.findMany.mockResolvedValue([tag]);
    const result = await service.checkoutWarning(
      userId,
      session.id,
      input.stayReference,
      input.roomNumber,
    );
    expect(result).toMatchObject({ hasActiveTags: true, count: 1 });
    expect(prisma.roomAttentionTag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: session.branchId,
          status: { in: expect.any(Array) },
        }),
      }),
    );
  });
});
