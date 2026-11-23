import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
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
import { GenerateIdCardDto, RevokeIdCardDto } from './dto/id-card.dto';
import { IdCardListQueryDto } from './dto/id-card-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

export const CARD_EXAMPLE = {
  id: '019f357b-e5b1-73aa-9062-adc0f927a584',
  systemCode: 'MIC-MR8NZ6OO-1-7B2D',
  tenantBusinessId: '019f357b-c211-71a0-9062-adc0f927a584',
  tenantMemberId: '019f357b-d398-73aa-9062-adc0f927a584',
  templateId: '019f357b-aa11-71a0-9062-adc0f927a584',
  // A PRIVATE storage path. It is NOT reachable at /uploads and handing it
  // out buys nothing - the download endpoint below is the only way out.
  filePath: 'member-id-cards/019f357c-d489-74a9-8490-1f82e745b199.pdf',
  fileSizeBytes: 24177,
  generatedBy: '019f357b-1111-71a0-9062-adc0f927a584',
  generatedAt: 1783308735,
  status: 'ACTIVE',
  createdAt: 1783308735,
  updatedAt: 1783308735,
  deletedAt: null,
};

/**
 * Streams a PDF buffer as a download.
 *
 * Shared by both surfaces so the headers cannot drift. `attachment` rather
 * than inline: a card is a document somebody prints, not a page to browse.
 */
export function sendPdf(res: Response, buffer: Buffer, filename: string): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // The file holds member data; no cache should keep a copy.
  res.setHeader('Cache-Control', 'no-store');
  res.end(buffer);
}

@ApiTags('System / Member ID Cards')
@ApiBearerAuth()
@Controller('system/member-id-cards')
export class MemberIdCardsController {
  constructor(private readonly service: TenantIdCardsService) {}

  @Get()
  @RequirePermissions('tenant-member-id-cards:list')
  @ApiOperation({ summary: 'Cross-tenant view of generated ID cards' })
  @ApiResponse({
    status: 200,
    description: 'Paginated cards.',
    schema: { example: { items: [CARD_EXAMPLE], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } } },
  })
  findAll(@Query() query: IdCardListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('tenant-member-id-cards:view')
  @ApiOperation({ summary: 'Get one card record' })
  @ApiParam({ name: 'id', description: 'Card UUIDv7' })
  @ApiResponse({ status: 200, description: 'Card detail.', schema: { example: CARD_EXAMPLE } })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/download')
  @RequirePermissions('tenant-member-id-cards:view')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary: 'Download the stored PDF',
    description:
      'The ONLY way a card leaves the server. The file lives in private ' +
      'storage, which nothing serves statically and the gateway does not ' +
      'proxy, so this permission check is not something a direct URL can ' +
      'step around.',
  })
  @ApiParam({ name: 'id', description: 'Card UUIDv7' })
  @ApiResponse({ status: 200, description: 'The PDF.' })
  @ApiResponse({ status: 404, description: 'Card not found, or its file is missing.' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.service.readCardFile(id);
    sendPdf(res, buffer, filename);
  }

  @Post('members/:memberId')
  @RequirePermissions('tenant-member-id-cards:generate')
  @ApiOperation({
    summary: "Generate a member's ID card",
    description:
      'Renders with the given template, or the business default. ' +
      'Regenerating replaces the stored PDF in place and deletes the old ' +
      'one, so a member has exactly one current card.',
  })
  @ApiParam({ name: 'memberId', description: 'Member UUIDv7' })
  @ApiResponse({ status: 201, description: 'Card generated.', schema: { example: CARD_EXAMPLE } })
  @ApiResponse({ status: 400, description: 'No usable template, or an unreadable layout.' })
  @ApiResponse({ status: 403, description: "This business's member register is turned off." })
  generate(
    @Param('memberId') memberId: string,
    @Body() dto: GenerateIdCardDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.generateForMember(memberId, dto, user?.id);
  }

  @Patch(':id/revoke')
  @RequirePermissions('tenant-member-id-cards:revoke')
  @ApiOperation({
    summary: 'Void a card that is still in circulation',
    description:
      'Lost, stolen, or issued in error. The row and its PDF stay, so the ' +
      'history still shows what was issued and why it stopped being valid - ' +
      'that is what separates this from DELETE. Revoking the current card ' +
      'also frees the member for a new one.',
  })
  @ApiParam({ name: 'id', description: 'Card UUIDv7' })
  @ApiResponse({ status: 200, description: 'Card revoked.', schema: { example: CARD_EXAMPLE } })
  @ApiResponse({ status: 400, description: 'That card is already revoked.' })
  revoke(
    @Param('id') id: string,
    @Body() dto: RevokeIdCardDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.revoke(id, dto.reason, user?.id);
  }

  @Delete(':id')
  @RequirePermissions('tenant-member-id-cards:delete')
  @ApiOperation({
    summary: 'Delete a generated card',
    description:
      'Soft-deletes the row AND removes the PDF. Unlike most soft deletes ' +
      'here the file goes too: the row is the only index into private ' +
      'storage, so keeping it would leave member data nothing can reach.',
  })
  @ApiParam({ name: 'id', description: 'Card UUIDv7' })
  @ApiResponse({ status: 200, description: 'Deleted.', schema: { example: { success: true } } })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
