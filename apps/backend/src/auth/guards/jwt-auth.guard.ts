import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { AuthService } from "../auth.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("No authentication token provided");
    }

    try {
      const payload = this.authService.verifyJwt(token);

      // Validate session is still active
      const user = await this.authService.validateSession(payload);
      if (!user) {
        throw new UnauthorizedException("Session expired or revoked");
      }

      request.user = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  private extractToken(request: {
    cookies?: { auth_token?: string };
    headers: { authorization?: string };
  }): string | null {
    // Try cookie first
    const cookieToken = request.cookies?.auth_token;
    if (cookieToken) return cookieToken;

    // Fall back to Authorization header (for API clients)
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice(7);
    }

    return null;
  }
}
