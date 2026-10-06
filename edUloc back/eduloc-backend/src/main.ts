import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AppConfig } from './core/config/app.config';

async function bootstrap(): Promise<void> {
  // rawBody : nécessaire pour la vérification de signature du webhook LiveKit.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const cfg = app.get(AppConfig);
  const logger = new Logger('Bootstrap');

  app.use(helmet());
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.enableCors({
    origin: cfg.corsOrigins,
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  const swagger = new DocumentBuilder()
    .setTitle('EduLoc V2 API')
    .setDescription('Marketplace de tutorat géolocalisé — vocal, documents, appels LiveKit.')
    .setVersion('2.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document);

  await app.listen(cfg.port);
  logger.log(`EduLoc API prête sur http://localhost:${cfg.port} — Swagger : /docs`);
}

void bootstrap();
