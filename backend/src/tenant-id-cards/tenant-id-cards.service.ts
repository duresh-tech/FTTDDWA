import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TenantBusinessSettingsService } from '../tenant-business-settings/tenant-business-settings.service';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import { listResponse, paginate } from '../common/dto/query.dto';
import { IdCardRendererService } from './id-card-renderer.service';
import { IdCardContext, IdCardMember } from './id-card-fields';
import { parseLayout } from './id-card-layout.schema';
import { IdCardListQueryDto } from './dto/id-card-query.dto';
import { BulkGenerateIdCardsDto, GenerateIdCardDto } from './dto/id-card.dto';

/** Where cards land inside the PRIVATE storage area. */
const CARD_FOLDER = 'member-id-cards';

/** The flag that closes a business's register; a closed one issues no cards. */
const MEMBER_REGISTER_SETTING_KEY = 'memberRegister.enabled';

/**
 * A bulk run is bounded. Rendering is CPU work on the request thread, and an
 * unbounded batch over a large register would hold a worker for minutes and
 * build a PDF too big to hand back.
 */
export const BULK_LIMIT = 250;

/**
 * Everything a card needs from a member, including the TAMIL names.
 *
 * Its own include rather than the one in TenantMembersService, which selects
 * English names only. Widening the shared one would grow the payload of every
 * member list and detail response for the sake of this one consumer.
 */
const CARD_INCLUDE = {
  associationPosition: { select: { positionName: true, positionNameTamil: true } },
  industry: { select: { industryName: true, industryNameTamil: true } },
  state: { select: { stateName: true, stateNameTamil: true } },
  district: { select: { districtName: true, districtNameTamil: true } },
  taluk: { select: { talukName: true, talukNameTamil: true } },
};

const CARD_LIST_INCLUDE = {
  member: { select: { id: true, systemCode: true, memberName: true, memberNameTamil: true } },
  template: { select: { id: true, name: true } },
};

@Injectable()
export class TenantIdCardsService {
  private readonly logger = new Logger(TenantIdCardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly renderer: IdCardRendererService,
    private readonly settings: TenantBusinessSettingsService,
  ) {}

  // ---------- Generation ----------

  /**
   * Renders one member's card, stores it privately, and records it.
   *
   * Regeneration updates the existing row in place and removes the superseded
   * file. Keeping one row per member is what `@@unique([tenantMemberId])`
   * enforces, and updating rather than delete-and-insert is what stops a
   * soft-deleted row from blocking a reissue.
   */
  async generateForMember(
    memberId: string,
    dto: GenerateIdCardDto,
    actorId?: string,
  ) {
    const member = await this.loadMember(memberId);
    await this.assertRegisterOpen(member.tenantBusinessId);

    const template = await this.resolveTemplate(member.tenantBusinessId, dto.templateId);
    const layout = parseLayout(template.layout);
    if (!layout) {
      throw new BadRequestException(
        `Template "${template.name}" holds a layout this server cannot read`,
      );
    }

    const context = await this.buildContext(member);
    const pdf = await this.renderer.render(layout, [context]);

    const filePath = await this.storage.upload(
      {
        originalname: `${member.systemCode}.pdf`,
        mimetype: 'application/pdf',
        buffer: pdf,
        size: pdf.length,
      },
      CARD_FOLDER,
      // PRIVATE, not the uploads tree. A card carries a photo, a phone
      // number, an address and an Aadhaar's last four digits, and /uploads is
      // served outside the guard pipeline.
      'private',
    );

    const timestamp = now();
    const existing = await this.prisma.tenantMemberIdCard.findUnique({
      where: { tenantMemberId: memberId },
    });

    const card = existing
      ? await this.prisma.tenantMemberIdCard.update({
          where: { id: existing.id },
          data: {
            templateId: template.id,
            filePath,
            fileSizeBytes: pdf.length,
            generatedBy: actorId,
            generatedAt: timestamp,
            status: 'ACTIVE',
            deletedAt: null,
            updatedAt: timestamp,
          },
          include: CARD_LIST_INCLUDE,
        })
      : await this.prisma.tenantMemberIdCard.create({
          data: {
            id: newId(),
            systemCode: newSystemCode('MIC'),
            tenantBusinessId: member.tenantBusinessId,
            tenantMemberId: memberId,
            templateId: template.id,
            filePath,
            fileSizeBytes: pdf.length,
            generatedBy: actorId,
            generatedAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          include: CARD_LIST_INCLUDE,
        });

    // After the row points at the new file, so a failure here leaves an
    // orphaned file rather than a row pointing at a deleted one.
    if (existing && existing.filePath !== filePath) {
      await this.storage
        .remove(existing.filePath, 'private')
        .catch((error: Error) =>
          this.logger.warn(`Could not remove superseded card: ${error.message}`),
        );
    }

    return card;
  }

  /**
   * Renders many members into ONE multi-page PDF for printing, and records
   * each member's own card so it stays individually downloadable.
   *
   * The combined PDF is returned and NOT stored: it is a disposable artefact
   * of one print run, unlike the per-member card.
   */
  async generateBulk(
    businessIds: string[],
    dto: BulkGenerateIdCardsDto,
    actorId?: string,
  ): Promise<{ pdf: Buffer; generated: number; skipped: string[] }> {
    if (dto.memberIds.length > BULK_LIMIT) {
      throw new BadRequestException(
        `Generate at most ${BULK_LIMIT} cards at a time (asked for ${dto.memberIds.length})`,
      );
    }

    const members = await this.prisma.tenantMember.findMany({
      where: {
        id: { in: dto.memberIds },
        tenantBusinessId: { in: businessIds },
        status: { not: 'DELETED' },
      },
      include: CARD_INCLUDE,
    });
    if (members.length === 0) throw new NotFoundException('No members matched');

    // One business per run: a card is rendered from that business's template
    // and settings, so mixing them would silently use one business's branding
    // for another's members.
    const distinct = [...new Set(members.map((m) => m.tenantBusinessId))];
    if (distinct.length > 1) {
      throw new BadRequestException('Generate cards for one business at a time');
    }
    const businessId = distinct[0];
    await this.assertRegisterOpen(businessId);

    const template = await this.resolveTemplate(businessId, dto.templateId);
    const layout = parseLayout(template.layout);
    if (!layout) {
      throw new BadRequestException(
        `Template "${template.name}" holds a layout this server cannot read`,
      );
    }

    const settings = await this.settings.getSettingsMapForBusiness(businessId);
    const generatedOn = this.today();
    const contexts: IdCardContext[] = members.map((member) => ({
      member: member as unknown as IdCardMember,
      settings,
      generatedOn,
    }));

    const combined = await this.renderer.render(layout, contexts);

    // Each member also gets their own stored card, so the batch is a print
    // convenience rather than the only copy.
    const skipped: string[] = [];
    for (const member of members) {
      try {
        await this.generateForMember(member.id, { templateId: template.id }, actorId);
      } catch (error) {
        // One member failing must not lose the whole run - the combined PDF
        // is already rendered and the rest of the rows are worth keeping.
        skipped.push(member.systemCode);
        this.logger.warn(
          `Bulk: could not store card for ${member.systemCode}: ${(error as Error).message}`,
        );
      }
    }

    return { pdf: combined, generated: members.length - skipped.length, skipped };
  }

  /** The stored PDF, for the guarded download endpoint. */
  async readCardFile(cardId: string): Promise<{ buffer: Buffer; filename: string }> {
    const card = await this.prisma.tenantMemberIdCard.findFirst({
      where: { id: cardId, status: { not: 'DELETED' } },
      include: { member: { select: { systemCode: true } } },
    });
    if (!card) throw new NotFoundException('ID card not found');

    const buffer = await this.storage.readBuffer(card.filePath, 'private');
    if (!buffer) {
      throw new NotFoundException(
        'The stored PDF is missing. Generate the card again.',
      );
    }
    return { buffer, filename: `${card.member.systemCode}.pdf` };
  }

  // ---------- Reading ----------

  async findAll(query: IdCardListQueryDto) {
    const { page, limit, status, tenantBusinessId, tenantMemberId, sortBy, sortOrder } = query;
    const where = {
      ...(tenantBusinessId ? { tenantBusinessId } : {}),
      ...(tenantMemberId ? { tenantMemberId } : {}),
      status: status ? status : ({ not: 'DELETED' } as const),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantMemberIdCard.findMany({
        where,
        include: CARD_LIST_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantMemberIdCard.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.tenantMemberIdCard.findFirst({
      where: { id, status: { not: 'DELETED' } },
      include: CARD_LIST_INCLUDE,
    });
    if (!row) throw new NotFoundException('ID card not found');
    return row;
  }

  async remove(id: string) {
    const card = await this.findOne(id);
    await this.prisma.tenantMemberIdCard.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: now(), updatedAt: now() },
    });
    // The PDF goes with it. Unlike most soft deletes here, keeping the file
    // would leave member data on disk that nothing references and nobody can
    // reach - the row is the only index into private storage.
    await this.storage
      .remove(card.filePath, 'private')
      .catch((error: Error) =>
        this.logger.warn(`Could not remove card file: ${error.message}`),
      );
    return { success: true };
  }

  // ---------- Tenant self-service ----------

  async getMappedBusinessIds(tenantUserId: string): Promise<string[]> {
    const mappings = await this.prisma.tenantMappedBusiness.findMany({
      where: { tenantUserId, status: 'ACTIVE' },
      select: { tenantBusinessId: true },
    });
    return mappings.map((m) => m.tenantBusinessId);
  }

  async assertMemberOwned(tenantUserId: string, memberId: string): Promise<void> {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const member = await this.prisma.tenantMember.findFirst({
      where: { id: memberId, tenantBusinessId: { in: businessIds }, status: { not: 'DELETED' } },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Member not found');
  }

  async assertCardOwned(tenantUserId: string, cardId: string): Promise<void> {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const card = await this.prisma.tenantMemberIdCard.findFirst({
      where: { id: cardId, tenantBusinessId: { in: businessIds }, status: { not: 'DELETED' } },
      select: { id: true },
    });
    if (!card) throw new NotFoundException('ID card not found');
  }

  async findAllForTenantUser(tenantUserId: string, query: IdCardListQueryDto) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const scoped = query.tenantBusinessId
      ? businessIds.filter((id) => id === query.tenantBusinessId)
      : businessIds;
    const { page, limit, status, tenantMemberId, sortBy, sortOrder } = query;
    const where = {
      tenantBusinessId: { in: scoped },
      ...(tenantMemberId ? { tenantMemberId } : {}),
      status: status ? status : ({ not: 'DELETED' } as const),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantMemberIdCard.findMany({
        where,
        include: CARD_LIST_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantMemberIdCard.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  // ---------- Internals ----------

  private async loadMember(memberId: string) {
    const member = await this.prisma.tenantMember.findFirst({
      where: { id: memberId, status: { not: 'DELETED' } },
      include: CARD_INCLUDE,
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  private async buildContext(
    member: Awaited<ReturnType<TenantIdCardsService['loadMember']>>,
  ): Promise<IdCardContext> {
    const settings = await this.settings.getSettingsMapForBusiness(
      member.tenantBusinessId,
    );
    return {
      member: member as unknown as IdCardMember,
      settings,
      generatedOn: this.today(),
    };
  }

  /**
   * The template to render with: the one asked for, else the business default.
   */
  private async resolveTemplate(tenantBusinessId: string, templateId?: string) {
    const template = await this.prisma.tenantIdCardTemplate.findFirst({
      where: {
        tenantBusinessId,
        status: 'ACTIVE',
        ...(templateId ? { id: templateId } : { isDefault: true }),
      },
    });
    if (!template) {
      throw new BadRequestException(
        templateId
          ? 'That ID card template was not found for this business'
          : 'This business has no default ID card template yet',
      );
    }
    return template;
  }

  private async assertRegisterOpen(tenantBusinessId: string): Promise<void> {
    const open = await this.settings.isSettingEnabled(
      tenantBusinessId,
      MEMBER_REGISTER_SETTING_KEY,
    );
    if (!open) {
      throw new ForbiddenException('The member register is turned off for this business');
    }
  }

  /** YYYY-MM-DD, matching how the register already stores calendar dates. */
  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
