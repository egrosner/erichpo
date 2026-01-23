import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Enable CORS for development
  app.enableCors();

  const port = process.env.PORT ?? 4847;
  await app.listen(port);

  console.log(`Application running on http://localhost:${port}`);
}

bootstrap();
