jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { CanActivate, ExecutionContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import {
  SupabaseAuthGuard,
  type AuthRequest,
} from "../src/common/guards/supabase-auth.guard";
import { WorkSessionGuard } from "../src/common/guards/work-session.guard";
import { RequestIdInterceptor } from "../src/common/interceptors/request-id.interceptor";
import { PrismaService } from "../src/infrastructure/database/prisma/prisma.service";
import { RoomAttentionTagsController } from "../src/modules/room-attention-tags/room-attention-tags.controller";
import { RoomAttentionTagsService } from "../src/modules/room-attention-tags/room-attention-tags.service";

const tag = {
  id: "60000000-0000-4000-8000-000000000001",
  branchId: "40000000-0000-4000-8000-000000000001",
  roomNumber: "512",
  stayReference: "BK-001",
  guestName: "Nguyễn Văn A",
  tagType: "SPECIAL_REQUEST",
  priority: "IMPORTANT",
  status: "OPEN",
  title: "Chuẩn bị thêm gối",
  details: "Chuẩn bị thêm hai gối trước 20:00.",
};
class AuthStub implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    req.authUser = { id: "employee-id" };
    return true;
  }
}
class WorkSessionStub implements CanActivate {
  canActivate(context: ExecutionContext) {
    context.switchToHttp().getRequest<AuthRequest>().workSessionId =
      "work-session-id";
    return true;
  }
}

describe("room attention tags API integration", () => {
  const service = {
    list: jest.fn(),
    create: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    close: jest.fn(),
    cancel: jest.fn(),
    checkoutWarning: jest.fn(),
  };
  let app: import("@nestjs/common").INestApplication;
  beforeAll(async () => {
    service.list.mockResolvedValue([tag]);
    service.create.mockResolvedValue(tag);
    service.get.mockResolvedValue({ ...tag, updates: [] });
    service.update.mockResolvedValue({ ...tag, status: "IN_PROGRESS" });
    service.close.mockResolvedValue({ ...tag, status: "CLOSED" });
    service.checkoutWarning.mockResolvedValue({
      hasActiveTags: true,
      count: 1,
      tags: [tag],
    });
    const module = await Test.createTestingModule({
      controllers: [RoomAttentionTagsController],
      providers: [
        { provide: RoomAttentionTagsService, useValue: service },
        SupabaseAuthGuard,
        WorkSessionGuard,
        { provide: PrismaService, useValue: {} },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useClass(AuthStub)
      .overrideGuard(WorkSessionGuard)
      .useClass(WorkSessionStub)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalInterceptors(new RequestIdInterceptor());
    await app.init();
  });
  afterAll(async () => app?.close());
  it("creates a tag through the protected endpoint", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/room-attention-tags")
      .send({
        branchId: tag.branchId,
        stayReference: tag.stayReference,
        roomNumber: tag.roomNumber,
        guestName: tag.guestName,
        checkInDate: "2026-07-27",
        expectedCheckOutDate: "2026-07-30",
        tagType: tag.tagType,
        priority: tag.priority,
        title: tag.title,
        details: tag.details,
      })
      .expect(201);
    expect(response.body.data.id).toBe(tag.id);
    expect(service.create).toHaveBeenCalledWith(
      "employee-id",
      "work-session-id",
      expect.any(Object),
      expect.any(Object),
    );
  });
  it("lists active tags with filters", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/room-attention-tags?active=true&priority=IMPORTANT")
      .expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(service.list).toHaveBeenCalledWith(
      "employee-id",
      "work-session-id",
      expect.objectContaining({ active: "true", priority: "IMPORTANT" }),
    );
  });
  it("returns the checkout warning before treating the route as an id", async () => {
    const response = await request(app.getHttpServer())
      .get(
        "/api/v1/room-attention-tags/checkout-warning?stayReference=BK-001&roomNumber=512",
      )
      .expect(200);
    expect(response.body.data.hasActiveTags).toBe(true);
    expect(service.checkoutWarning).toHaveBeenCalledWith(
      "employee-id",
      "work-session-id",
      "BK-001",
      "512",
    );
  });
  it("adds a timeline update", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/room-attention-tags/${tag.id}`)
      .send({ content: "Đã chuyển gối lên phòng", status: "IN_PROGRESS" })
      .expect(200);
    expect(service.update).toHaveBeenCalledWith(
      "employee-id",
      "work-session-id",
      tag.id,
      expect.any(Object),
      expect.any(Object),
    );
  });
});
