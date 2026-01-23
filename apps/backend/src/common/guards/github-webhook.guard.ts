import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

@Injectable()
export class GitHubWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers["x-hub-signature-256"] as string;
    const body = (request as Request & { rawBody?: Buffer }).rawBody;

    if (!signature) {
      throw new UnauthorizedException("Missing GitHub signature header");
    }

    if (!body) {
      throw new UnauthorizedException("Missing request body");
    }

    const secret = this.configService.get<string>("github.webhookSecret");
    if (!secret) {
      throw new UnauthorizedException("GitHub webhook secret not configured");
    }

    const expectedSignature = `sha256=${createHmac("sha256", secret)
      .update(body)
      .digest("hex")}`;

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException("Invalid GitHub signature");
    }

    return true;
  }
}
