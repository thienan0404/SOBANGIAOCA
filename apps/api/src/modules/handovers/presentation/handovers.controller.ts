import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  SupabaseAuthGuard,
  type AuthRequest,
} from "../../../common/guards/supabase-auth.guard";
import { WorkSessionGuard } from "../../../common/guards/work-session.guard";
import { HandoversService } from "../application/services/handovers.service";

function evidence(request: AuthRequest, requestId?: string) {
  const forwarded = request.headers["x-forwarded-for"];
  const firstForwarded = (
    Array.isArray(forwarded) ? forwarded[0] : forwarded
  )?.split(",")[0];
  return {
    requestId,
    ipAddress: firstForwarded?.trim() || request.ip,
    userAgent: request.headers["user-agent"],
  };
}

@Controller()
@UseGuards(SupabaseAuthGuard, WorkSessionGuard)
export class HandoversController {
  constructor(private readonly service: HandoversService) {}

  private user(request: AuthRequest) {
    return request.authUser!.id;
  }

  @Get("handovers")
  list(@Req() request: AuthRequest, @Query() query: Record<string, unknown>) {
    return this.service.list(this.user(request), query);
  }

  @Post("handovers")
  create(
    @Req() request: AuthRequest,
    @Body() body: unknown,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.service.create(this.user(request), body, requestId);
  }

  @Get("handovers/:id")
  get(@Req() request: AuthRequest, @Param("id") id: string) {
    return this.service.get(this.user(request), id);
  }

  @Post("handovers/:id/checklist/:itemCode")
  check(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Param("itemCode") itemCode: string,
  ) {
    return this.service.completeChecklist(this.user(request), id, itemCode);
  }

  @Post("handovers/:id/submit")
  submit(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.service.submit(
      this.user(request),
      id,
      body,
      evidence(request, requestId),
    );
  }

  @Post("handovers/:id/management-sign")
  managementSign(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.service.managementSign(
      this.user(request),
      id,
      body,
      evidence(request, requestId),
    );
  }

  @Post("handovers/:id/accounting-sign")
  accountingSign(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.service.accountingSign(
      this.user(request),
      id,
      body,
      evidence(request, requestId),
    );
  }

  @Post("handovers/:id/management-return")
  managementReturn(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.service.managementReturn(
      this.user(request), id, body, evidence(request, requestId),
    );
  }

  @Post("handovers/:id/accounting-return")
  accountingReturn(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.service.accountingReturn(
      this.user(request), id, body, evidence(request, requestId),
    );
  }
  @Post("handovers/:id/request-supplement")
  supplement(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.service.requestSupplement(
      this.user(request),
      id,
      body,
      evidence(request, requestId),
    );
  }

  @Get("handovers/:id/history")
  history(@Req() request: AuthRequest, @Param("id") id: string) {
    return this.service.history(this.user(request), id);
  }

  @Get("handover-participants")
  participants(
    @Req() request: AuthRequest,
    @Query("branchId") branchId?: string,
  ) {
    return this.service.participants(this.user(request), branchId);
  }
}

@Controller()
@UseGuards(SupabaseAuthGuard)
export class HandoverReceiverController {
  constructor(private readonly service: HandoversService) {}

  @Post("handovers/:id/receiver-sign")
  receiverSign(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-work-session-id") workSessionId?: string,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.service.receiverSignAndTransfer(
      request.authUser!.id,
      workSessionId,
      id,
      body,
      evidence(request, requestId),
    );
  }

  @Post("handovers/:id/receiver-amend")
  receiverAmend(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-work-session-id") workSessionId?: string,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.service.receiverAmend(
      request.authUser!.id, workSessionId, id, body, evidence(request, requestId),
    );
  }
  @Post("handovers/:id/receiver-request-supplement")
  receiverSupplement(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.service.receiverRequestSupplement(
      request.authUser!.id,
      id,
      body,
      evidence(request, requestId),
    );
  }
}
