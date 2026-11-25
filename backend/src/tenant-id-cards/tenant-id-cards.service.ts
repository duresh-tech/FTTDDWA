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
import { applyWatermark, watermarkFor } from './id-card-watermark';
import { IdCardContext, IdCardMember } from './id-card-fields';
import { parseLayout } from './id-card-layout.schema';
import { IdCardListQueryDto } from './dto/id-card-query.dto';
import { BulkGenerateIdCardsDto, GenerateIdCardDto } from './dto/id-card.dto';

/** How long a card is valid, in years. 0 means it never expires. */
const CARD_VALIDITY_SETTING_KEY = 'memberIdCard.validityYears';

/**
 * A card's expiry, or null when the business issues cards that do not expire.
 *
 * Years are added on the calendar rather than as a fixed number of seconds,
 * so a card issued on 29 February lands on a real date and five years means
 * five birthdays rather than 5 x 365 days.
 */
export function expiryFrom(issuedAtSeconds: number, validityYears: number): number | null {
  if (validityYears <= 0) return null;
  const date = new Date(issuedAtSeconds * 1000);
  date.setFullYear(date.getFullYear() + validityYears);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Whether a card has expired, computed from its date and the clock.
 *
 * There is no EXPIRED status to read instead - see the note on
 * TenantMemberIdCardStatus. This is the only place expiry is decided.
 */
export function isExpired(expiryAt: bigint | number | null, nowSeconds: number): boolean {
  if (expiryAt === null || expiryAt === undefined) return false;
  return Number(expiryAt) <= nowSeconds;
}

/**
 * Attaches the derived `expired` flag to a card row.
 *
 * Staff reads need it for the same reason the member portal does: with no
 * stored EXPIRED status, a card past its date is indistinguishable from a
 * valid one unless somebody computes it. Doing it here rather than in each
 * caller keeps the one definition of expiry in `isExpired`.
 */
function withExpiry<T extends { expiryAt: bigint | null }>(card: T): T & { expired: boolean } {
  return { ...card, expired: isExpired(card.expiryAt, now()) };
}

/**
 * Refuses to issue a card to a membership that is not current.
 *
 * A card is an assertion that someone IS a member, so issuing one to a PENDING
 * or INACTIVE membership prints a claim the register does not support. The
 * previous gate was only "not deleted", which let every other state through.
 *
 * The message names the status, because the operator's next question is always
 * "why not" and the answer is on the member's own row.
 */
export function assertMemberIssuable(member: { status: string; memberName: string }): void {
  if (member.status === 'ACTIVE') return;
  throw new BadRequestException(
    `${member.memberName} is ${member.status.toLowerCase()}. ` +
      'Only active members can be issued an ID card.',
  );
}

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
  rto: { select: { rtoName: true, rtoNameTamil: true, rtoCode: true } },
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
   * Regeneration INSERTS a new issue and marks the previous one SUSPENDED, in
   * one transaction. The superseded PDF is KEPT - that is what history means,
   * and it does mean private storage grows with every reissue rather than
   * holding one file per member.
   *
   * (This used to update one row in place and delete the old file, which is
   * what `@@unique([tenantMemberId])` enforced. Migration 0014 replaced that
   * constraint with a partial unique index on the ACTIVE row.)
   */
  async generateForMember(
    memberId: string,
    dto: GenerateIdCardDto,
    actorId?: string,
  ) {
    const member = await this.loadMember(memberId);
    assertMemberIssuable(member);
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
    const validityYears = await this.cardValidityYears(member.tenantBusinessId);

    // One transaction: supersede whatever was current, then insert the new
    // issue. The partial unique index on (tenantMemberId) WHERE status =
    // 'ACTIVE' is the backstop - if this ever failed to supersede first, the
    // insert would be refused rather than leaving two cards both claiming to
    // be current.
    const card = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.tenantMemberIdCard.findFirst({
        where: { tenantMemberId: memberId, status: 'ACTIVE' },
        orderBy: { issueNumber: 'desc' },
      });
      if (previous) {
        await tx.tenantMemberIdCard.update({
          where: { id: previous.id },
          data: { status: 'SUSPENDED', suspendedAt: timestamp, updatedAt: timestamp },
        });
      }

      // Counted over EVERY issue, not just the active one, so a revoked or
      // superseded card still consumes its number and the sequence never
      // repeats.
      const issued = await tx.tenantMemberIdCard.aggregate({
        where: { tenantMemberId: memberId },
        _max: { issueNumber: true },
      });

      return tx.tenantMemberIdCard.create({
        data: {
          id: newId(),
          systemCode: newSystemCode('MIC'),
          tenantBusinessId: member.tenantBusinessId,
          tenantMemberId: memberId,
          templateId: template.id,
          filePath,
          fileSizeBytes: pdf.length,
          issueNumber: (issued._max.issueNumber ?? 0) + 1,
          issuedBy: actorId,
          issuedAt: timestamp,
          expiryAt: expiryFrom(timestamp, validityYears),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        include: CARD_LIST_INCLUDE,
      });
    });

    // The superseded card's PDF is KEPT. That is what history means: a
    // reissued card's predecessor is evidence of what was in circulation.
    // Only an explicit delete removes a file - which does mean private
    // storage grows with every reissue rather than holding one file per
    // member.
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

    // Skip, do not fail. A 250-row print run must not die because one row is
    // inactive, and the console's "Print ID cards" button sends every member
    // on the page - inactive ones included. They land in `skipped`, which the
    // response reports in X-Cards-Skipped.
    const issuable = members.filter((m) => m.status === 'ACTIVE');
    const notIssuable = members
      .filter((m) => m.status !== 'ACTIVE')
      .map((m) => `${m.memberName} (${m.status.toLowerCase()})`);
    if (issuable.length === 0) {
      throw new BadRequestException(
        'None of those members are active, so no card can be issued.',
      );
    }

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
    // ISSUABLE only. The combined sheet must not print a card for somebody
    // the register does not currently call a member.
    const contexts: IdCardContext[] = issuable.map((member) => ({
      member: member as unknown as IdCardMember,
      settings,
      generatedOn,
    }));

    const combined = await this.renderer.render(layout, contexts);

    // Each member also gets their own stored card, so the batch is a print
    // convenience rather than the only copy.
    const skipped: string[] = [...notIssuable];
    for (const member of issuable) {
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

    // Counted from the issuable set: a member skipped for being inactive was
    // never going to be generated, so folding them into `generated` would
    // report cards that are not in the PDF.
    return {
      pdf: combined,
      generated: issuable.length - (skipped.length - notIssuable.length),
      skipped,
    };
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

    // A card that is no longer valid is stamped on the way OUT. The stored
    // bytes are never touched: that file is the evidence of what was actually
    // in circulation, and re-rendering it from today's template and today's
    // member record would quietly change history.
    //
    // Stamped here because every surface reaches a PDF through this method -
    // system, tenant and the member portal (via readOwnCardFile) - so there is
    // one place to get it right rather than three.
    const reason = watermarkFor(card.status, isExpired(card.expiryAt, now()));
    const served = reason ? await applyWatermark(buffer, reason) : buffer;

    return { buffer: served, filename: `${card.member.systemCode}.pdf` };
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
    return listResponse(items.map(withExpiry), total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.tenantMemberIdCard.findFirst({
      where: { id, status: { not: 'DELETED' } },
      include: CARD_LIST_INCLUDE,
    });
    if (!row) throw new NotFoundException('ID card not found');
    return withExpiry(row);
  }

  /**
   * Every issue of ONE member's card, newest first.
   *
   * Its own method rather than `findAll` with a filter because it answers a
   * different question - "what has this person been issued" - and is read by
   * the dialog on their row. Unpaginated on purpose: a member has a handful of
   * issues over a lifetime, and a page control over four rows is noise.
   *
   * DELETED issues are left out. Deleting a card removes its PDF, so the row
   * would be a history entry pointing at nothing.
   */
  async historyForMember(tenantMemberId: string) {
    const rows = await this.prisma.tenantMemberIdCard.findMany({
      where: { tenantMemberId, status: { not: 'DELETED' } },
      include: CARD_LIST_INCLUDE,
      orderBy: { issueNumber: 'desc' },
    });
    return rows.map(withExpiry);
  }

  /**
   * A member's own current card, or null.
   *
   * Takes the member id from the caller's TOKEN, never a parameter - this is
   * the member portal's only view of a card, and there must be no shape of
   * request that reads somebody else's.
   *
   * Expiry is computed here rather than stored, as it is everywhere else, so
   * the portal and the PDF cannot disagree about whether a card is still
   * valid.
   */
  async findCurrentForMember(tenantMemberId: string) {
    const card = await this.prisma.tenantMemberIdCard.findFirst({
      where: { tenantMemberId, status: 'ACTIVE' },
      select: {
        id: true,
        systemCode: true,
        issueNumber: true,
        issuedAt: true,
        expiryAt: true,
        status: true,
        fileSizeBytes: true,
      },
    });
    if (!card) return null;
    return { ...card, expired: isExpired(card.expiryAt, now()) };
  }

  /**
   * The PDF of a member's own current card.
   *
   * Scoped the same way: it resolves the card FROM the member rather than
   * accepting a card id, so there is no id to tamper with. A revoked or
   * superseded card is not reachable here at all - only the ACTIVE one is,
   * which is what the member is entitled to hold.
   */
  async readOwnCardFile(tenantMemberId: string) {
    const card = await this.prisma.tenantMemberIdCard.findFirst({
      where: { tenantMemberId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!card) {
      throw new NotFoundException('No membership card has been issued to you yet');
    }
    return this.readCardFile(card.id);
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

  /**
   * The business's card validity in years, from the settings catalogue.
   *
   * An unset or unparseable value means NO expiry rather than an arbitrary
   * default: issuing a card that silently expires because a setting was
   * missing would be worse than issuing one that does not.
   */
  private async cardValidityYears(tenantBusinessId: string): Promise<number> {
    const map = await this.settings.getSettingsMapForBusiness(tenantBusinessId, [
      CARD_VALIDITY_SETTING_KEY,
    ]);
    const years = Number(map[CARD_VALIDITY_SETTING_KEY]);
    return Number.isFinite(years) && years > 0 ? Math.floor(years) : 0;
  }

  /**
   * Voids a card that is still in circulation - lost, stolen, or issued in
   * error.
   *
   * Separate from delete: the row and its PDF stay, so the history still
   * shows what was issued and why it stopped being valid. Revoking the
   * current card also frees the member for a new ACTIVE one, which the
   * partial unique index would otherwise refuse.
   */
  async revoke(id: string, reason: string | undefined, actorId?: string) {
    const card = await this.findOne(id);
    if (card.status === 'REVOKED') {
      throw new BadRequestException('That card is already revoked');
    }
    const timestamp = now();
    return this.prisma.tenantMemberIdCard.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedAt: timestamp,
        revokedBy: actorId,
        revokeReason: reason,
        updatedAt: timestamp,
      },
      include: CARD_LIST_INCLUDE,
    });
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
