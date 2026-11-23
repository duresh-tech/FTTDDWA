import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantIdCardTemplatesService } from './tenant-id-card-templates.service';
import {
  CreateIdCardTemplateDto,
  UpdateIdCardTemplateDto,
} from './dto/id-card-template.dto';
import { IdCardTemplateListQueryDto } from './dto/id-card-template-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ID_CARD_FIELDS } from '../tenant-id-cards/id-card-fields';

export const TEMPLATE_EXAMPLE = {
  id: '019f357b-d398-73aa-9062-adc0f927a584',
  systemCode: 'ICT-MR8NZ6OO-0-C0CB',
  tenantBusinessId: '019f357b-c211-71a0-9062-adc0f927a584',
  name: 'Standard membership card',
  description: 'Front shows the photo and both names; back carries the office address.',
  widthMm: '85.60',
  heightMm: '54.00',
  layout:
    '{"version":1,"card":{"widthMm":85.6,"heightMm":54},"sides":{"front":{"background":{"color":"#ffffff","imagePath":null},"elements":[]},"back":{"background":{"color":"#ffffff","imagePath":null},"elements":[]}}}',
  isDefault: true,
  status: 'ACTIVE',
  createdAt: 1783308735,
  updatedAt: 1783308735,
  deletedAt: null,
};

@ApiTags('System / ID Card Templates')
@ApiBearerAuth()
@Controller('system/id-card-templates')
export class IdCardTemplatesController {
  constructor(private readonly service: TenantIdCardTemplatesService) {}

  // Declared BEFORE @Get(':id'), or the param route swallows it and ":id"
  // arrives as the literal string "fields".
  @Get('fields')
  @RequirePermissions('tenant-id-card-templates:view')
  @ApiOperation({
    summary: 'The values a template may bind to',
    description:
      'The field catalogue the designer renders its palette from. A template ' +
      'stores a TOKEN and never a value, and this is the one place that says ' +
      'which tokens exist, what they are called and whether each is text, an ' +
      'image or a QR code. Each carries a `sample` so a layout can be judged ' +
      'at realistic width - a Tamil name is wider than its token.',
  })
  @ApiResponse({ status: 200, description: 'Field catalogue.' })
  listFields() {
    return ID_CARD_FIELDS;
  }

  @Get()
  @RequirePermissions('tenant-id-card-templates:list')
  @ApiOperation({ summary: "Cross-tenant view of ID card templates" })
  @ApiResponse({
    status: 200,
    description: 'Paginated templates.',
    schema: { example: { items: [TEMPLATE_EXAMPLE], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } } },
  })
  findAll(@Query() query: IdCardTemplateListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('tenant-id-card-templates:view')
  @ApiOperation({ summary: 'Get one template' })
  @ApiParam({ name: 'id', description: 'Template UUIDv7' })
  @ApiResponse({ status: 200, description: 'Template detail.', schema: { example: TEMPLATE_EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Template not found.' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('tenant-id-card-templates:create')
  @ApiOperation({
    summary: 'Create a template',
    description:
      'Omit `layout` to start from an empty card of the given size. The ' +
      "first template a business creates becomes its default, so generation " +
      'works without anyone setting the flag.',
  })
  @ApiResponse({ status: 201, description: 'Template created.', schema: { example: TEMPLATE_EXAMPLE } })
  create(@Body() dto: CreateIdCardTemplateDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('tenant-id-card-templates:update')
  @ApiOperation({
    summary: 'Update a template',
    description:
      'The whole `layout` is replaced rather than merged - a deep merge of ' +
      'positioned elements has no sensible meaning, and the designer holds ' +
      'the canvas as its single source of truth while editing.',
  })
  @ApiParam({ name: 'id', description: 'Template UUIDv7' })
  @ApiResponse({ status: 200, description: 'Template updated.', schema: { example: TEMPLATE_EXAMPLE } })
  @ApiResponse({ status: 400, description: 'The layout did not validate.' })
  update(@Param('id') id: string, @Body() dto: UpdateIdCardTemplateDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/default')
  @RequirePermissions('tenant-id-card-templates:update')
  @ApiOperation({
    summary: 'Make this the business default',
    description:
      'Clears the flag on whichever template held it, in the same ' +
      'transaction, so exactly one template is ever the default.',
  })
  @ApiParam({ name: 'id', description: 'Template UUIDv7' })
  @ApiResponse({ status: 200, description: 'Default set.', schema: { example: TEMPLATE_EXAMPLE } })
  setDefault(@Param('id') id: string) {
    return this.service.setDefault(id);
  }

  @Delete(':id')
  @RequirePermissions('tenant-id-card-templates:delete')
  @ApiOperation({
    summary: 'Soft-delete a template',
    description:
      'Cards already generated from it keep pointing at the row, so this is ' +
      'a status change. A deleted template also stops being the default.',
  })
  @ApiParam({ name: 'id', description: 'Template UUIDv7' })
  @ApiResponse({ status: 200, description: 'Deleted.', schema: { example: { success: true } } })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions('tenant-id-card-templates:restore')
  @ApiOperation({
    summary: 'Restore a soft-deleted template',
    description:
      'Comes back INACTIVE and not as the default: a design that was deleted ' +
      'deserves another look before it starts printing cards again.',
  })
  @ApiParam({ name: 'id', description: 'Template UUIDv7' })
  @ApiResponse({ status: 200, description: 'Restored.', schema: { example: TEMPLATE_EXAMPLE } })
  restore(@Param('id') id: string) {
    return this.service.restore(id);
  }
}
