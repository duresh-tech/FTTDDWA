import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantIdCardsService } from './tenant-id-cards.service';
import { BulkGenerateIdCardsDto, GenerateIdCardDto } from './dto/id-card.dto';
import { IdCardListQueryDto } from './dto/id-card-query.dto';
import { CARD_EXAMPLE, sendPdf } from './tenant-id-cards.controller';
import { Public } from '../common/decorators/public.decorator';
import { RequireTenantPermissions } from '../common/decorators/require-tenant-permissions.decorator';
import {
  CurrentTenantUser,
  TenantAuthUser,
} from '../common/decorators/current-tenant-user.decorator';
import { TenantJwtAuthGuard } from '../common/guards/tenant-jwt-auth.guard';
import { TenantPermissionsGuard } from '../common/guards/tenant-permissions.guard';

// @Public() escapes the SYSTEM JWT guard so the tenant guard pair below can
// take over. It does NOT make the route public: an API key is still required,
// and TenantJwtAuthGuard still demands a tenant session.
@ApiTags('Tenant / Member ID Cards')
@ApiBearerAuth()
@Public()
@UseGuards(TenantJwtAuthGuard, TenantPermissionsGuard)
@Controller('tenant/member-id-cards')
export class TenantIdCardsSelfController {
  constructor(private readonly service: TenantIdCardsService) {}

  // Declared BEFORE @Get(':id') / @Post(':id'), or the param routes swallow
  // "bulk" and "members".
  @Post('bulk')
  @RequireTenantPermissions('tenant-member-id-cards:generate')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary: 'Generate many cards as one printable PDF',
    description:
      'Returns a single multi-page PDF for the print run AND stores each ' +
      "member's own card, so the batch is a convenience rather than the only " +
      'copy. The combined file is NOT stored - it is a disposable artefact of ' +
      'one run. Member ids are explicit rather than a filter, so the operator ' +
      'can see how many cards they are about to produce. Capped at 250.',
  })
  @ApiResponse({ status: 201, description: 'The combined PDF.' })
  @ApiResponse({ status: 400, description: 'Over the cap, or members from several businesses.' })
  async bulk(
    @CurrentTenantUser() user: TenantAuthUser,
    @Body() dto: BulkGenerateIdCardsDto,
    @Res() res: Response,
  ) {
    const businessIds = await this.service.getMappedBusinessIds(user.id);
    const { pdf, generated, skipped } = await this.service.generateBulk(
      businessIds,
      dto,
      user.id,
    );
    // Counts ride along in headers so the screen can report them without a
    // second request, while the body stays a plain PDF.
    res.setHeader('X-Cards-Generated', String(generated));
    if (skipped.length > 0) res.setHeader('X-Cards-Skipped', skipped.join(','));
    sendPdf(res, pdf, `member-id-cards-${generated}.pdf`);
  }

  @Post('members/:memberId')
  @RequireTenantPermissions('tenant-member-id-cards:generate')
  @ApiOperation({
    summary: "Generate one of the caller's own members' ID card",
    description:
      'Renders with the given template, or the business default. ' +
      'Regenerating replaces the stored PDF in place.',
  })
  @ApiParam({ name: 'memberId', description: 'Member UUIDv7' })
  @ApiResponse({ status: 201, description: 'Card generated.', schema: { example: CARD_EXAMPLE } })
  @ApiResponse({ status: 403, description: 'The member register is turned off.' })
  async generate(
    @CurrentTenantUser() user: TenantAuthUser,
    @Param('memberId') memberId: string,
    @Body() dto: GenerateIdCardDto,
  ) {
    await this.service.assertMemberOwned(user.id, memberId);
    return this.service.generateForMember(memberId, dto, user.id);
  }

  @Get()
  @RequireTenantPermissions('tenant-member-id-cards:list')
  @ApiOperation({ summary: "List the caller's own generated cards" })
  @ApiResponse({ status: 200, description: 'Paginated cards.' })
  findAll(
    @CurrentTenantUser() user: TenantAuthUser,
    @Query() query: IdCardListQueryDto,
  ) {
    return this.service.findAllForTenantUser(user.id, query);
  }

  @Get(':id/download')
  @RequireTenantPermissions('tenant-member-id-cards:view')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary: 'Download the stored PDF',
    description:
      'The only way a card leaves the server. The file is in private ' +
      'storage, which nothing serves statically and the gateway does not ' +
      'proxy.',
  })
  @ApiParam({ name: 'id', description: 'Card UUIDv7' })
  @ApiResponse({ status: 200, description: 'The PDF.' })
  async download(
    @CurrentTenantUser() user: TenantAuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    await this.service.assertCardOwned(user.id, id);
    const { buffer, filename } = await this.service.readCardFile(id);
    sendPdf(res, buffer, filename);
  }

  @Delete(':id')
  @RequireTenantPermissions('tenant-member-id-cards:delete')
  @ApiOperation({
    summary: 'Delete one of the caller\'s own generated cards',
    description: 'Removes the row and the stored PDF together.',
  })
  @ApiParam({ name: 'id', description: 'Card UUIDv7' })
  @ApiResponse({ status: 200, description: 'Deleted.', schema: { example: { success: true } } })
  async remove(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    await this.service.assertCardOwned(user.id, id);
    return this.service.remove(id);
  }
}
