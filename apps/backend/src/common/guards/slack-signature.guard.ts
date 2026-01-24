import { createHmac, timingSafeEqual } from "node:crypto";
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

@Injectable()
export class SlackSignatureGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const timestamp = request.headers["x-slack-request-timestamp"] as string;
    const signature = request.headers["x-slack-signature"] as string;
    const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;

    if (!timestamp || !signature) {
      throw new UnauthorizedException("Missing Slack signature headers");
    }

    if (!rawBody) {
      throw new UnauthorizedException("Missing request body");
    }

    // Check timestamp is within 5 minutes (replay attack protection)
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
    if (Number.parseInt(timestamp, 10) < fiveMinutesAgo) {
      throw new UnauthorizedException("Request timestamp too old");
    }

    const signingSecret = this.configService.get<string>("slack.signingSecret");
    if (!signingSecret) {
      throw new UnauthorizedException("Slack signing secret not configured");
    }

    const sigBaseString = `v0:${timestamp}:${rawBody.toString()}`;
    const expectedSignature = `v0=${createHmac("sha256", signingSecret)
      .update(sigBaseString)
      .digest("hex")}`;

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException("Invalid Slack signature");
    }

    return true;
  }
}
