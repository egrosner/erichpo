import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { WorkspaceRolesGuard } from "./guards/workspace-roles.guard";

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, WorkspaceRolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, WorkspaceRolesGuard],
})
export class AuthModule {}
