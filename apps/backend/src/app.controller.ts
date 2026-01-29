import { Controller, Get } from "@nestjs/common";

@Controller("api")
export class AppController {
  @Get("health")
  getHealth(): string {
    return "OK";
  }
}
