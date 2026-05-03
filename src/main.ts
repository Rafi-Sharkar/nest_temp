import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ENVEnum } from './common/enum/env.enum';
import { AllExceptionsFilter } from './core/filter/http-exception.filter';

async function bootstrap() {
  // ✅ Remove rawBody: true — we handle it manually via verify callback
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger();

  // * -------------------- enable cors -----------------------------
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:5174',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // * ----------------- add global pipes ----------------------
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // * ------------------ add global filters error handler ------------------------
  app.useGlobalFilters(new AllExceptionsFilter());

  // * ✅ STEP 1 — Stripe webhook raw body parser MUST come FIRST
  // before any JSON parser, otherwise the body stream is already consumed
  app.use(
    '/webhook/stripe',
    bodyParser.raw({
      type: 'application/json',
      verify: (req: any, _res: any, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );

  // * ✅ STEP 2 — JSON + URL-encoded parsers for all other routes
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // * ✅ STEP 3 — Cookie parser after body parsers
  app.use(cookieParser());

  // * ---------------- configure Swagger ---------------------------
  const config = new DocumentBuilder()
    .setTitle('NestJS Template Backend API Documentation')
    .setDescription('Standard NestJS Template with Auth, Notifications, Chat, and Payments.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // * -------------------- set port -----------------------------
  const port = parseInt(configService.get<string>(ENVEnum.PORT) ?? '5000', 10);

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}/docs`);
}
bootstrap();
