import type { WorkspaceRole } from "@erichpo/shared";
import { SetMetadata } from "@nestjs/common";

// DEPRECATED: Use WorkspaceRoles from workspace-roles.decorator.ts instead
export const ROLES_KEY = "roles";
export const Roles = (...roles: WorkspaceRole[]) =>
  SetMetadata(ROLES_KEY, roles);
