import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { patchNestJsSwagger } from 'nestjs-zod';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as path from 'path';
import { AppModule } from './app.module';

// Prisma returns BigInt for UNIX timestamp columns; make them JSON-safe.
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Let SIGTERM from `docker stop` run PrismaService.onModuleDestroy so
  // connections close cleanly instead of being severed.
  app.enableShutdownHooks();

  // ---- Reverse-proxy trust ----
  // Behind the console's nginx gateway, Express would otherwise see the
  // gateway's address as the client for every request - collapsing all users
  // into one ThrottlerGuard bucket, so the global limit would throttle the
  // whole instance and five bad logins from anyone would lock out everybody.
  //
  // A HOP COUNT, not `true`: trusting any X-Forwarded-For would let a client
  // spoof its own address and escape rate limiting entirely. And not an IP
  // list - the gateway's address on the fttddwa-app network is DHCP-assigned, so
  // there is nothing stable to list.
  //
  // snippets/proxy.conf SETS X-Forwarded-For to a single address rather than
  // appending, so TRUST_PROXY=1 is correct whether or not the edge is
  // running. Empty (the default) trusts nothing, which is right for a
  // directly exposed API.
  const trustProxy = (config.get<string>('TRUST_PROXY') ?? '').trim();
  if (trustProxy) {
    app.set('trust proxy', /^\d+$/.test(trustProxy) ? parseInt(trustProxy, 10) : trustProxy);
    Logger.log(`Trusting proxy: ${trustProxy}`, 'Bootstrap');
  }

  // ---- Security headers ----
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow serving /uploads to the frontend origin
    }),
  );
  app.disable('x-powered-by');

  // ---- Cookies (refresh token / CSRF) ----
  app.use(cookieParser());

  // ---- CORS restrictions ----
  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    Logger.warn(
      'CORS_ORIGINS is empty - every cross-origin browser request will be rejected',
      'Bootstrap',
    );
  }
  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-device-type',
      'x-csrf-token',
    ],
  });

  // ---- API versioning: /api/v{API_VERSION}/... ----
  const apiVersion = config.get('API_VERSION', '1');
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: apiVersion });

  // ---- Local storage static serving (driver=local) ----
  app.useStaticAssets(
    path.join(process.cwd(), config.get('LOCAL_STORAGE_DIR', 'public/uploads')),
    { prefix: '/uploads' },
  );

  // ---- Swagger / OpenAPI ----
  if (config.get('SWAGGER_ENABLED', 'true') === 'true') {
    patchNestJsSwagger(); // teach Swagger to read Zod DTO schemas
    const swaggerConfig = new DocumentBuilder()
      .setTitle(config.get('APP_NAME', 'System API'))
      .setDescription(
        `System REST API. All endpoints are versioned under /api/v${apiVersion} and ` +
          'require the x-device-type header. Protected endpoints use a JWT ' +
          'Bearer access token; refresh tokens are httpOnly cookies with ' +
          'CSRF double-submit protection.',
      )
      .setVersion('1.5.0')
      .addBearerAuth()
      .addGlobalParameters({
        name: 'x-device-type',
        in: 'header',
        required: true,
        description: 'Calling device type',
        schema: {
          type: 'string',
          enum: ['website', 'androidApp', 'iosApp', 'desktopApp'],
          default: 'website',
        },
      })
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(config.get('SWAGGER_PATH', 'docs'), app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = parseInt(config.get('PORT', '4000'), 10);
  // Bind all interfaces explicitly: inside a container, binding the loopback
  // only would make the service unreachable from other containers and the host.
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on 0.0.0.0:${port} (base path /api/v${apiVersion})`, 'Bootstrap');
  if (config.get('SWAGGER_ENABLED', 'true') === 'true') {
    Logger.log(`Swagger docs at /${config.get('SWAGGER_PATH', 'docs')}`, 'Bootstrap');
  }
}

bootstrap();
