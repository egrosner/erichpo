import type { WorkspaceRole } from "@erichpo/shared";
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { WORKSPACE_ROLES_KEY } from "../decorators/workspace-roles.decorator";

@Injectable()
export class WorkspaceRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      WORKSPACE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException("No user in request");
    }

    if (!user.currentWorkspace) {
      throw new ForbiddenException("No workspace context set");
    }

    const hasRole = requiredRoles.includes(user.currentWorkspace.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `Workspace role ${requiredRoles.join(" or ")} required`,
      );
    }

    return true;
  }
}
