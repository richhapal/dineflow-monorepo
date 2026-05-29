import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS — allow dashboard, web and mobile dev
  app.enableCors({
    origin: [
      'http://localhost:3000', // dashboard
      'http://localhost:3001', // web
      process.env.DASHBOARD_URL || '',
      process.env.WEB_URL || '',
    ].filter(Boolean),
    credentials: true,
  });

  // Swagger docs (dev only)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('DineFlow API')
      .setDescription('Restaurant operating system API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🍽  DineFlow API running on http://localhost:${port}`);
  console.log(`📚 Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
