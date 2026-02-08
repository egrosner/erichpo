import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>("email.resendApiKey");
    this.from =
      this.configService.get<string>("email.from") ?? "noreply@example.com";

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
      this.logger.warn(
        "RESEND_API_KEY not configured — email invites will be disabled",
      );
    }
  }

  get isConfigured(): boolean {
    return this.resend !== null;
  }

  async sendWorkspaceInvite(
    to: string,
    inviteUrl: string,
    workspaceName: string,
    invitedBy: string,
  ): Promise<void> {
    if (!this.resend) {
      throw new Error(
        "Email service is not configured (missing RESEND_API_KEY)",
      );
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: `You've been invited to ${workspaceName} on erichpo`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="margin: 0 0 16px;">Join ${workspaceName} on erichpo</h2>
          <p style="color: #555; line-height: 1.5;">
            <strong>${invitedBy}</strong> invited you to join the <strong>${workspaceName}</strong> workspace.
          </p>
          <p style="color: #555; line-height: 1.5;">
            erichpo connects your GitHub pull requests with Slack, creating dedicated channels for each PR with synced comments, reviews, and CI status.
          </p>
          <a href="${inviteUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 16px 0;">
            Accept Invite
          </a>
          <p style="color: #888; font-size: 13px; margin-top: 24px;">
            This invite expires in 7 days. If you weren't expecting this email, you can safely ignore it.
          </p>
        </div>
      `,
    });

    if (error) {
      this.logger.error(
        `Failed to send invite email to ${to}: ${error.message}`,
      );
      throw new Error(`Failed to send invite email: ${error.message}`);
    }

    this.logger.log(
      `Sent workspace invite email to ${to} for ${workspaceName}`,
    );
  }
}
