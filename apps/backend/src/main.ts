import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Cookie parser for auth tokens
  app.use(cookieParser());

  // Enable CORS with credentials support
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT ?? 4848;
  await app.listen(port);

  console.log(`Application running on http://localhost:${port}`);
}

bootstrap();
