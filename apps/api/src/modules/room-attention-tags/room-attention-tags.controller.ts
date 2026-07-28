import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  SupabaseAuthGuard,
  type AuthRequest,
} from "../../common/guards/supabase-auth.guard";
import { WorkSessionGuard } from "../../common/guards/work-session.guard";
import { RoomAttentionTagsService } from "./room-attention-tags.service";

function evidence(request: AuthRequest, requestId?: string) {
  const forwarded = request.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(
    ",",
  )[0];
  return {
    requestId,
    ipAddress: first?.trim() || request.ip,
    userAgent: request.headers["user-agent"],
  };
}

@Controller("room-attention-tags")
@UseGuards(SupabaseAuthGuard, WorkSessionGuard)
export class RoomAttentionTagsController {
  constructor(private readonly service: RoomAttentionTagsService) {}
  private actor(request: AuthRequest) {
    return {
      userId: request.authUser!.id,
      workSessionId: request.workSessionId!,
    };
  }

  @Get()
  list(@Req() request: AuthRequest, @Query() query: Record<string, string>) {
    const actor = this.actor(request);
    return this.service.list(actor.userId, actor.workSessionId, query);
  }

  @Get("checkout-warning")
  checkoutWarning(
    @Req() request: AuthRequest,
    @Query("stayReference") stayReference: string,
    @Query("roomNumber") roomNumber?: string,
  ) {
    const actor = this.actor(request);
    return this.service.checkoutWarning(
      actor.userId,
      actor.workSessionId,
      stayReference,
      roomNumber,
    );
  }

  @Post()
  create(
    @Req() request: AuthRequest,
    @Body() body: unknown,
    @Headers("x-request-id") requestId?: string,
  ) {
    const actor = this.actor(request);
    return this.service.create(
      actor.userId,
      actor.workSessionId,
      body,
      evidence(request, requestId),
    );
  }

  @Get(":id")
  get(@Req() request: AuthRequest, @Param("id") id: string) {
    const actor = this.actor(request);
    return this.service.get(actor.userId, actor.workSessionId, id);
  }

  @Patch(":id")
  update(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-request-id") requestId?: string,
  ) {
    const actor = this.actor(request);
    return this.service.update(
      actor.userId,
      actor.workSessionId,
      id,
      body,
      evidence(request, requestId),
    );
  }

  @Post(":id/close")
  close(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-request-id") requestId?: string,
  ) {
    const actor = this.actor(request);
    return this.service.close(
      actor.userId,
      actor.workSessionId,
      id,
      body,
      evidence(request, requestId),
    );
  }

  @Post(":id/cancel")
  cancel(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-request-id") requestId?: string,
  ) {
    const actor = this.actor(request);
    return this.service.cancel(
      actor.userId,
      actor.workSessionId,
      id,
      body,
      evidence(request, requestId),
    );
  }
}
