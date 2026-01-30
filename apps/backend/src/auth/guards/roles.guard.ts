import type { WorkspaceRole } from "@erichpo/shared";
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";

// DEPRECATED: Use WorkspaceRolesGuard instead
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    // For backwards compatibility, check currentWorkspace role
    return user?.currentWorkspace
      ? requiredRoles.includes(user.currentWorkspace.role)
      : false;
  }
}
