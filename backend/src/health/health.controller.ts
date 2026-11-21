import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SkipApiKey } from '../common/decorators/skip-api-key.decorator';

/**
 * Liveness/readiness probe for container orchestration (compose
 * `depends_on: service_healthy`, Docker HEALTHCHECK, k8s probes).
 *
 * Note for probe authors: `DeviceHeaderGuard` is registered globally, and its
 * one bypass (`@SkipDeviceHeader()`) exists only for Caddy's on-demand TLS
 * check. A probe must therefore send `x-device-type: website` or it gets a
 * 400 - both Dockerfiles and the compose healthchecks do exactly that.
 */
@ApiTags('System / Health')
// The probe runs before anything is configured, and a container
// healthcheck has nowhere to read a key from.
@SkipApiKey()
@Controller('system/health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  // Probes poll far more often than a human would; keep them clear of the
  // global 100/min budget so a healthcheck can never throttle real traffic.
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Service and database health' })
  @ApiOkResponse({ schema: { example: { status: 'ok', db: 'up' } } })
  @ApiServiceUnavailableResponse({ description: 'The database is unreachable' })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
    return { status: 'ok', db: 'up' };
  }
}
