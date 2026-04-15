import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import { json, urlencoded } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

const API_PREFIX = 'api/v1';
const logger = new Logger('Bootstrap');

function isTruthy(value?: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    String(value || '').toLowerCase(),
  );
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function parseAllowedOrigins(): string[] {
  return (
    process.env.FRONTEND_URLS ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function configureSecurity(app: Awaited<ReturnType<typeof NestFactory.create>>) {
  if (isTruthy(process.env.DISABLE_SECURITY_MIDDLEWARE)) {
    return;
  }

  if (isTruthy(process.env.TRUST_PROXY)) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);
  }

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    compression({
      threshold: 1024,
      level: 6,
    }),
  );

  const bodyLimit = process.env.BODY_LIMIT || '300kb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX ?? 180),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      statusCode: 429,
      message: "So'rovlar soni me'yordan oshdi. Birozdan keyin qayta urinib ko'ring.",
    },
    skip: (req) => req.path.includes('/docs'),
  });

  const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const email = String((req.body as { email?: string })?.email || 'anonymous')
        .trim()
        .toLowerCase();
      return `${req.ip}:${email}`;
    },
    skipSuccessfulRequests: true,
    message: {
      statusCode: 429,
      message: "Kirish urinishlari juda ko'p. 10 daqiqadan keyin qayta urinib ko'ring.",
    },
  });

  app.use(`/${API_PREFIX}/auth/login`, authLimiter);
  app.use(globalLimiter);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  app.setGlobalPrefix(API_PREFIX);

  const allowedOrigins = parseAllowedOrigins();
  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

  configureSecurity(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Imthon7 API')
    .setDescription('Educational ERP backend API documentation')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token returned by /auth/login endpoint',
      },
      'access-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-user-id',
        description: 'Authenticated user id for ERP endpoints',
      },
      'x-user-id',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-user-role',
        description: 'Authenticated role for guarded endpoints',
      },
      'x-user-role',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
    deepScanRoutes: true,
  });

  SwaggerModule.setup('docs', app, swaggerDocument, {
    useGlobalPrefix: true,
    customSiteTitle: 'Imthon7 API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  const server = app.getHttpServer();
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS ?? 15000);

  const appUrl = await app.getUrl();
  logger.log(`Application is running on: ${joinUrl(appUrl, API_PREFIX)}`);
  logger.log(`Swagger docs available at: ${joinUrl(appUrl, `${API_PREFIX}/docs`)}`);
}

void bootstrap();