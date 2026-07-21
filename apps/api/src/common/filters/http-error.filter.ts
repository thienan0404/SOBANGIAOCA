import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const requestId = String(request.headers["x-request-id"] ?? "unknown");
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = error instanceof HttpException ? error.getResponse() : null;
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message: unknown }).message)
        : "Đã xảy ra lỗi hệ thống";

    if (!(error instanceof HttpException)) {
      const detail = error instanceof Error ? error.stack : String(error);
      this.logger.error(
        `${request.method} ${request.originalUrl} failed [requestId=${requestId}]`,
        detail,
      );
    }

    response.status(status).json({
      error: {
        code:
          error instanceof HttpException ? "REQUEST_FAILED" : "INTERNAL_ERROR",
        message,
        details: {},
      },
      requestId,
    });
  }
}
