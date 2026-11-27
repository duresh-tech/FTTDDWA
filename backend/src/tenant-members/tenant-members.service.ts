import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { encryptValue } from '../common/utils/encryption.util';
import { blindIndex, normaliseAadhaar } from '../common/utils/blind-index.util';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import { listResponse, paginate } from '../common/dto/query.dto';
import {
  ChangeTenantMemberStatusDto,
  CreateTenantMemberDto,
  UpdateTenantMemberDto,
} from './dto/tenant-member.dto';
import { ResetTenantMemberPasswordDto } from './dto/tenant-member.dto';
import { TenantMemberListQueryDto } from './dto/tenant-member-query.dto';
import { TenantBusinessSettingsService } from '../tenant-business-settings/tenant-business-settings.service';

/**
 * The flag that closes this register in a business's OWN portal.
 *
 * It gates the tenant self-service surface only. System staff reach the
 * register through the system controller regardless, because the flag is a
 * business's choice about its own portal, not a tenant's veto over support.
 */
const MEMBER_REGISTER_SETTING_KEY = 'memberRegister.enabled';

const INCLUDE = {
  tenantBusiness: { select: { id: true, systemCode: true, name: true } },
  associationPosition: { select: { id: true, positionName: true } },
  industry: { select: { id: true, industryName: true } },
  state: { select: { id: true, stateName: true } },
  district: { select: { id: true, districtName: true } },
  taluk: { select: { id: true, talukName: true } },
  rto: { select: { id: true, rtoName: true, rtoCode: true } },
};

type WithAadhaar = { aadhaarNumber: string | null; aadhaarHash: string | null };

/**
 * Drops the ciphertext and the blind index on the way out, keeping only
 * `aadhaarLast4`, which is already a column.
 *
 * Both removed fields are removed for a reason. The ciphertext is the secret
 * itself. The hash looks harmless but is worse to publish than it appears:
 * an Aadhaar is 12 digits, so anyone holding the hash could grind the whole
 * 10^12 space offline and recover the number.
 */
function mask<T extends WithAadhaar>(row: T) {
  const { aadhaarNumber: _ct, aadhaarHash: _hash, ...rest } = row;
  return rest;
}

function searchClause(search?: string) {
  if (!search) return {};
  return {
    OR: [
      { memberName: { contains: search, mode: 'insensitive' as const } },
      { memberNameTamil: { contains: search, mode: 'insensitive' as const } },
      { businessName: { contains: search, mode: 'insensitive' as const } },
      { businessNameTamil: { contains: search, mode: 'insensitive' as const } },
      { phoneNumber: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
      { systemCode: { contains: search, mode: 'insensitive' as const } },
      { memberIdNumber: { contains: search, mode: 'insensitive' as const } },
    ],
  };
}

@Injectable()
export class TenantMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: TenantBusinessSettingsService,
  ) {}

  async findAll(query: TenantMemberListQueryDto) {
    const where = this.buildWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantMember.findMany({
        where,
        include: INCLUDE,
        orderBy: { [query.sortBy]: query.sortOrder },
        ...paginate(query.page, query.limit),
      }),
      this.prisma.tenantMember.count({ where }),
    ]);
    return listResponse(items.map(mask), total, query.page, query.limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.tenantMember.findFirst({
      where: { id, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('Member not found');
    return mask(row);
  }

  async create(dto: CreateTenantMemberDto, mayMovePosition = false) {
    await this.assertBusinessExists(dto.tenantBusinessId);
    await this.assertChain(
      dto.tenantBusinessId,
      dto.stateId,
      dto.districtId,
      dto.talukId,
      dto.rtoId,
    );
    await this.assertRefs(dto.tenantBusinessId, dto.associationPositionId, dto.industryId);
    await this.assertPositionAllowed(
      dto.tenantBusinessId,
      dto.associationPositionId,
      mayMovePosition,
    );

    // NOTE on capacity: there is deliberately no seat check here. A member
    // enrolled by staff starts PENDING - `status` is absent from the create
    // schema - and a seat is held by an ACTIVE member only. So enrolling
    // into a full position is allowed and takes nothing; changeStatus() is
    // where the seat is actually claimed, and where the cap is enforced.
    // Refusing here would also break the obvious handover: enrol the
    // incoming President, retire the outgoing one, then activate.

    // OPTIONAL. With no number there is nothing to hash and nothing to match
    // on, so the uniqueness check is skipped rather than run against a null -
    // which would collide with every other member who also has none.
    const digits = dto.aadhaarNumber ? normaliseAadhaar(dto.aadhaarNumber) : null;
    const aadhaarHash = digits ? blindIndex(digits) : null;
    if (aadhaarHash) {
      await this.assertAadhaarUnique(dto.tenantBusinessId, aadhaarHash);
    }

    const timestamp = now();
    // One transaction, because the membership number is allocated by reading
    // the numbers already issued for this RTO. Outside a transaction, two
    // concurrent enrolments would both read the same highest number.
    const row = await this.prisma.$transaction(async (tx) => {
      const memberIdNumber = await this.allocateMemberIdNumber(tx, dto.rtoId);
      return tx.tenantMember.create({
      data: {
        id: newId(),
        systemCode: newSystemCode('MEM'),
        memberIdNumber,
        tenantBusinessId: dto.tenantBusinessId,
        memberName: dto.memberName,
        memberNameTamil: dto.memberNameTamil,
        businessName: dto.businessName,
        businessNameTamil: dto.businessNameTamil,
        associationPositionId: dto.associationPositionId,
        industryId: dto.industryId,
        aadhaarNumber: digits ? encryptValue(digits) : null,
        aadhaarHash,
        aadhaarLast4: digits ? digits.slice(-4) : null,
        phoneNumber: dto.phoneNumber,
        whatsappNumber: dto.whatsappNumber,
        email: dto.email,
        stateId: dto.stateId,
        districtId: dto.districtId,
        talukId: dto.talukId,
        rtoId: dto.rtoId,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        dateOfBirth: dto.dateOfBirth,
        isMarried: dto.isMarried,
        // Belt and braces with the schema's superRefine: a create that somehow
        // arrives unmarried-with-a-date stores no date.
        weddingDate: dto.isMarried ? dto.weddingDate : null,
        passportPhotoPath: dto.passportPhotoPath,
        remark: dto.remark,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      include: INCLUDE,
      });
    });
    return mask(row);
  }

  async update(id: string, dto: UpdateTenantMemberDto, mayMovePosition = false) {
    const row = await this.prisma.tenantMember.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('Member not found');

    const tenantBusinessId = dto.tenantBusinessId ?? row.tenantBusinessId;
    if (dto.tenantBusinessId) await this.assertBusinessExists(tenantBusinessId);

    // Any touched part of the chain re-validates the whole chain, because the
    // pieces only make sense together.
    if (dto.stateId || dto.districtId || dto.talukId || dto.rtoId || dto.tenantBusinessId) {
      await this.assertChain(
        tenantBusinessId,
        dto.stateId ?? row.stateId,
        dto.districtId ?? row.districtId,
        dto.talukId ?? row.talukId,
        dto.rtoId ?? row.rtoId,
      );
    }
    if (dto.associationPositionId || dto.industryId || dto.tenantBusinessId) {
      await this.assertRefs(
        tenantBusinessId,
        dto.associationPositionId ?? row.associationPositionId,
        dto.industryId ?? row.industryId,
      );
    }

    // Only when the position actually MOVES. `!== undefined` rather than
    // truthiness, matching the PATCH semantics the rest of this method uses:
    // an absent field means "leave it alone", not "set it to nothing".
    //
    // Without this condition, correcting a phone number on a member who
    // already sits in a full position would be refused - against a seat that
    // is their own.
    const positionChanged =
      dto.associationPositionId !== undefined &&
      dto.associationPositionId !== row.associationPositionId;
    // Moving a member to another business moves the register their seat is
    // counted in, so it is the same question even when the id is unchanged.
    const businessChanged =
      dto.tenantBusinessId !== undefined && dto.tenantBusinessId !== row.tenantBusinessId;

    if (positionChanged) {
      await this.assertPositionAllowed(
        tenantBusinessId,
        dto.associationPositionId as string,
        mayMovePosition,
      );
    }

    const { aadhaarNumber, aadhaarHash, aadhaarLast4 } = await this.resolveAadhaar(
      dto,
      row,
      tenantBusinessId,
    );
    const { isMarried, weddingDate } = this.resolveMarriage(dto, row);

    // memberIdNumber is allocated at enrolment and never reissued - not even
    // when rtoId changes here, because the member may already hold a printed
    // card and an identifier that changes is not an identifier.
    //
    // Zod already strips it at the HTTP boundary (it is absent from the create
    // schema the update schema is derived from), so this guards the SERVICE
    // path: `...dto` below spreads straight into Prisma, and a future caller
    // that skips validation - a bulk import, a script - would otherwise be
    // able to overwrite somebody's number.
    const { memberIdNumber: _generated, ...safeDto } = dto as typeof dto & {
      memberIdNumber?: string;
    };

    // A transaction now, where there was none: a seat check is worth nothing
    // unless it is atomic with the write it guards. Only the check and the
    // update are inside it - every read above is a reference check, and a
    // reference that moves between check and write is caught by the foreign
    // key.
    const updated = await this.prisma.$transaction(async (tx) => {
      // Only an ACTIVE member occupies a seat, so a move that leaves a
      // PENDING or suspended member where they are costs nothing.
      if ((positionChanged || businessChanged) && row.status === 'ACTIVE') {
        await this.assertPositionHasRoom(
          tx,
          tenantBusinessId,
          dto.associationPositionId ?? row.associationPositionId,
          // Never counted against the seat it is competing for. A no-op when
          // the position changed (the row still holds the OLD one), which is
          // why it is passed rather than reasoned about.
          id,
        );
      }
      return tx.tenantMember.update({
        where: { id },
        data: {
          ...safeDto,
          aadhaarNumber,
          aadhaarHash,
          aadhaarLast4,
          isMarried,
          weddingDate,
          updatedAt: now(),
        },
        include: INCLUDE,
      });
    });
    return mask(updated);
  }

  /**
   * An encrypted value reads back masked, so a blank submit means "I did not
   * touch the secret", never "clear it". Encrypting '' here would destroy a
   * stored Aadhaar and only surface the next time someone opened the record.
   */
  private async resolveAadhaar(
    dto: UpdateTenantMemberDto,
    row: {
      aadhaarNumber: string | null;
      aadhaarHash: string | null;
      aadhaarLast4: string | null;
    },
    tenantBusinessId: string,
  ) {
    if (dto.aadhaarNumber === undefined || dto.aadhaarNumber === '') {
      return {
        aadhaarNumber: row.aadhaarNumber,
        aadhaarHash: row.aadhaarHash,
        aadhaarLast4: row.aadhaarLast4,
      };
    }
    const digits = normaliseAadhaar(dto.aadhaarNumber);
    const hash = blindIndex(digits);
    await this.assertAadhaarUnique(tenantBusinessId, hash, row.aadhaarHash ?? undefined);
    return {
      aadhaarNumber: encryptValue(digits),
      aadhaarHash: hash,
      aadhaarLast4: digits.slice(-4),
    };
  }

  /**
   * Clearing `isMarried` clears the date with it. Leaving a wedding date on
   * someone recorded as unmarried is the sort of contradiction that survives
   * for years because nothing ever reads both fields at once.
   *
   * The DTO cannot do this: on a PATCH either field may be absent, so the
   * decision needs the stored row.
   */
  private resolveMarriage(
    dto: UpdateTenantMemberDto,
    row: { isMarried: boolean; weddingDate: string | null },
  ) {
    const isMarried = dto.isMarried ?? row.isMarried;
    if (!isMarried) return { isMarried, weddingDate: null };
    const weddingDate =
      dto.weddingDate === undefined ? row.weddingDate : dto.weddingDate;
    return { isMarried, weddingDate };
  }

  async changeStatus(id: string, dto: ChangeTenantMemberStatusDto) {
    const row = await this.prisma.tenantMember.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('Member not found');

    // THIS is where a seat is claimed.
    //
    // A position's cap counts ACTIVE members, and a member enrolled by staff
    // starts PENDING - so enrolment never fills a position and activation
    // always does. Checking only on create would have made the cap
    // decorative: any number of PENDING members could be filed under a full
    // position and then activated one by one.
    //
    // Only the transition INTO active is checked. Re-saving an already
    // ACTIVE member with a remark must not fail, and no other status takes
    // a seat.
    const claimingSeat = dto.status === 'ACTIVE' && row.status !== 'ACTIVE';

    const updated = await this.prisma.$transaction(async (tx) => {
      if (claimingSeat) {
        await this.assertPositionHasRoom(
          tx,
          row.tenantBusinessId,
          row.associationPositionId,
          id,
        );
      }
      return tx.tenantMember.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
          updatedAt: now(),
        },
        include: INCLUDE,
      });
    });
    return mask(updated);
  }

  async remove(id: string) {
    const row = await this.prisma.tenantMember.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('Member not found');

    const timestamp = now();
    await this.prisma.tenantMember.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: timestamp, updatedAt: timestamp },
    });
    return { success: true };
  }

  async restore(id: string) {
    const row = await this.prisma.tenantMember.findFirst({
      where: { id, status: 'DELETED' },
    });
    if (!row) throw new NotFoundException('Member not found or not deleted');
    // Back to PENDING, not ACTIVE: a restored membership should be looked at
    // again rather than silently resuming.
    const restored = await this.prisma.tenantMember.update({
      where: { id },
      data: { status: 'PENDING', deletedAt: null, updatedAt: now() },
      include: INCLUDE,
    });
    return mask(restored);
  }

  // ---------- validation ----------

  private buildWhere(query: TenantMemberListQueryDto, businessIds?: string[]) {
    const {
      search, status, tenantBusinessId, associationPositionId,
      industryId, stateId, districtId, talukId,
    } = query;
    return {
      ...(businessIds
        ? { tenantBusinessId: { in: businessIds } }
        : tenantBusinessId
          ? { tenantBusinessId }
          : {}),
      status: status ? status : ({ not: 'DELETED' } as const),
      ...(associationPositionId ? { associationPositionId } : {}),
      ...(industryId ? { industryId } : {}),
      ...(stateId ? { stateId } : {}),
      ...(districtId ? { districtId } : {}),
      ...(talukId ? { talukId } : {}),
      ...searchClause(search),
    };
  }

  private async assertBusinessExists(tenantBusinessId: string) {
    const business = await this.prisma.tenantBusiness.findFirst({
      where: { id: tenantBusinessId, status: { not: 'DELETED' } },
    });
    if (!business) {
      throw new BadRequestException('Tenant business does not exist or is deleted');
    }
  }

  /**
   * Walks state -> district -> taluk. Each link is checked against the one
   * above it as well as the business, because the database cannot express
   * "this taluk is in that district" and the three ids would otherwise drift
   * into a combination that never existed.
   */
  /**
   * Creates a member from an approved application, inside the caller's
   * transaction.
   *
   * Takes a `tx` rather than opening its own, so approving is atomic: either
   * the member exists and the application is marked APPROVED, or neither
   * happened. Two transactions could leave a member whose application still
   * reads PENDING, and nothing would reconcile them.
   *
   * The application's fields are copied as they stand - including the already
   * encrypted Aadhaar and the already hashed password, which are moved rather
   * than re-derived. Re-hashing would invalidate the password the applicant
   * chose; re-encrypting is not possible without the plaintext, which is the
   * point of storing it encrypted.
   *
   * The member is ACTIVE rather than PENDING: the approval is the review that
   * PENDING exists for.
   */
  async createFromApplication(
    tx: Prisma.TransactionClient,
    application: {
      tenantBusinessId: string;
      passwordHash: string | null;
      memberName: string;
      memberNameTamil: string | null;
      businessName: string;
      businessNameTamil: string | null;
      associationPositionId: string;
      industryId: string;
      aadhaarNumber: string | null;
      aadhaarHash: string | null;
      aadhaarLast4: string | null;
      phoneNumber: string;
      whatsappNumber: string | null;
      email: string;
      stateId: string;
      districtId: string;
      talukId: string;
      rtoId: string;
      addressLine1: string;
      addressLine2: string | null;
      dateOfBirth: string;
      isMarried: boolean;
      weddingDate: string | null;
      passportPhotoPath: string | null;
    },
    actorId?: string,
  ) {
    void actorId;
    const timestamp = now();
    // Approval creates an ACTIVE member outright, so this is the one path
    // where the seat is taken at creation. A pending application holds
    // nothing, which is why the check belongs here and not at submit.
    //
    // Before allocateMemberIdNumber, because the position is always locked
    // before the RTO - see assertPositionHasRoom on lock order.
    await this.assertPositionHasRoom(
      tx,
      application.tenantBusinessId,
      application.associationPositionId,
    );

    const memberIdNumber = await this.allocateMemberIdNumber(tx, application.rtoId);

    const row = await tx.tenantMember.create({
      data: {
        id: newId(),
        systemCode: newSystemCode('MEM'),
        memberIdNumber,
        tenantBusinessId: application.tenantBusinessId,
        passwordHash: application.passwordHash,
        memberName: application.memberName,
        memberNameTamil: application.memberNameTamil,
        businessName: application.businessName,
        businessNameTamil: application.businessNameTamil,
        associationPositionId: application.associationPositionId,
        industryId: application.industryId,
        aadhaarNumber: application.aadhaarNumber,
        aadhaarHash: application.aadhaarHash,
        aadhaarLast4: application.aadhaarLast4,
        phoneNumber: application.phoneNumber,
        whatsappNumber: application.whatsappNumber,
        email: application.email,
        stateId: application.stateId,
        districtId: application.districtId,
        talukId: application.talukId,
        rtoId: application.rtoId,
        addressLine1: application.addressLine1,
        addressLine2: application.addressLine2,
        dateOfBirth: application.dateOfBirth,
        isMarried: application.isMarried,
        weddingDate: application.isMarried ? application.weddingDate : null,
        passportPhotoPath: application.passportPhotoPath,
        status: 'ACTIVE',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      include: INCLUDE,
    });
    return mask(row);
  }

  /**
   * The next membership number for an RTO: `<rtoCode><sequence>`, starting at
   * 001 and padded to three digits - TN72001, TN72002, ...
   *
   * MUST run inside a transaction. Two things make it safe:
   *
   * 1. It takes a row lock on the RTO with `SELECT ... FOR UPDATE`, which
   *    serialises allocation PER RTO - two enrolments under TN72 queue up,
   *    while TN38 and TN72 never contend. Locking the RTO rather than the
   *    member rows is the point: there is no row to lock for a number that
   *    does not exist yet, so `SELECT MAX(...) FOR UPDATE` over members would
   *    not stop two transactions both reading 001.
   * 2. `@@unique([tenantBusinessId, memberIdNumber])` is the backstop. The
   *    lock is the mechanism; the constraint is the guarantee.
   *
   * The number is derived from the members table rather than a counter
   * column, so a rolled-back enrolment does not burn one.
   */
  private async allocateMemberIdNumber(
    tx: Prisma.TransactionClient,
    rtoId: string,
  ): Promise<string> {
    // Raw, because Prisma has no `FOR UPDATE`. Parameterised, not interpolated.
    await tx.$queryRaw`SELECT id FROM tenant_rtos WHERE id = ${rtoId} FOR UPDATE`;

    const rto = await tx.tenantRto.findUnique({
      where: { id: rtoId },
      select: { rtoCode: true, tenantBusinessId: true },
    });
    if (!rto) throw new BadRequestException('RTO not found');

    const issued = await tx.tenantMember.findMany({
      where: {
        tenantBusinessId: rto.tenantBusinessId,
        memberIdNumber: { startsWith: rto.rtoCode },
      },
      select: { memberIdNumber: true },
    });

    // The highest NUMERIC suffix, never the highest string. 'TN72999' sorts
    // above 'TN721000' lexically, so a string max would stop advancing the
    // moment the sequence passes 999 and then collide on every insert.
    //
    // Soft-deleted members are counted too: their number is still issued, and
    // reusing it would give two people the same membership number.
    let highest = 0;
    for (const row of issued) {
      const suffix = row.memberIdNumber.slice(rto.rtoCode.length);
      if (!/^\d+$/.test(suffix)) continue;
      highest = Math.max(highest, Number(suffix));
    }

    // Padded to three, and simply grows past TN721000 rather than truncating.
    return `${rto.rtoCode}${String(highest + 1).padStart(3, '0')}`;
  }

  private async assertChain(
    tenantBusinessId: string,
    stateId: string,
    districtId: string,
    talukId: string,
    rtoId: string,
  ) {
    const state = await this.prisma.tenantState.findFirst({
      where: { id: stateId, tenantBusinessId, status: { not: 'DELETED' } },
    });
    if (!state) {
      throw new BadRequestException('State does not exist for the given tenant business');
    }

    const district = await this.prisma.tenantDistrict.findFirst({
      where: { id: districtId, tenantBusinessId, stateId, status: { not: 'DELETED' } },
    });
    if (!district) {
      throw new BadRequestException(
        'District does not exist for the given tenant business, or does not belong to the chosen state',
      );
    }

    const taluk = await this.prisma.tenantTaluk.findFirst({
      where: { id: talukId, tenantBusinessId, districtId, status: { not: 'DELETED' } },
    });
    if (!taluk) {
      throw new BadRequestException(
        'Taluk does not exist for the given tenant business, or does not belong to the chosen district',
      );
    }

    // The RTO hangs off the DISTRICT, not the taluk above it in this list, so
    // it is checked against districtId rather than talukId. The two sit next
    // to each other on the form, which makes this easy to get wrong.
    const rto = await this.prisma.tenantRto.findFirst({
      where: { id: rtoId, tenantBusinessId, tenantDistrictId: districtId, status: { not: 'DELETED' } },
    });
    if (!rto) {
      throw new BadRequestException(
        'RTO does not exist for the given tenant business, or does not belong to the chosen district',
      );
    }
  }

  private async assertRefs(
    tenantBusinessId: string,
    associationPositionId: string,
    industryId: string,
  ) {
    const position = await this.prisma.tenantAssociationPosition.findFirst({
      where: { id: associationPositionId, tenantBusinessId, status: { not: 'DELETED' } },
    });
    if (!position) {
      throw new BadRequestException(
        'Association position does not exist for the given tenant business',
      );
    }

    const industry = await this.prisma.tenantIndustry.findFirst({
      where: { id: industryId, tenantBusinessId, status: { not: 'DELETED' } },
    });
    if (!industry) {
      throw new BadRequestException('Industry does not exist for the given tenant business');
    }
  }

  /**
   * Not scoped to status != DELETED, like the street-code check: the unique
   * index covers every row whatever its soft-delete state, so a soft-deleted
   * member still holds their Aadhaar. Restoring them must not collide with
   * someone enrolled in the meantime.
   */
  private async assertAadhaarUnique(
    tenantBusinessId: string,
    aadhaarHash: string,
    excludeHash?: string,
  ) {
    if (excludeHash && excludeHash === aadhaarHash) return;
    const existing = await this.prisma.tenantMember.findFirst({
      where: { tenantBusinessId, aadhaarHash },
    });
    if (existing) {
      throw new BadRequestException(
        'A member with this Aadhaar number already exists for this business',
      );
    }
  }

  // ---------- Tenant self-service ----------

  async listMappedBusinesses(tenantUserId: string) {
    const businessIds = await this.enabledBusinessIds(
      await this.getMappedBusinessIds(tenantUserId),
    );
    return this.prisma.tenantBusiness.findMany({
      where: { id: { in: businessIds }, status: { not: 'DELETED' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAllForTenantUser(tenantUserId: string, query: TenantMemberListQueryDto) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const requested = query.tenantBusinessId
      ? businessIds.filter((b) => b === query.tenantBusinessId)
      : businessIds;
    // Filtered rather than refused: a caller mapped to two businesses, one
    // with the register closed, should see the other's members instead of an
    // error for both.
    const scoped = await this.enabledBusinessIds(requested);
    const where = this.buildWhere(query, scoped);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantMember.findMany({
        where,
        include: INCLUDE,
        orderBy: { [query.sortBy]: query.sortOrder },
        ...paginate(query.page, query.limit),
      }),
      this.prisma.tenantMember.count({ where }),
    ]);
    return listResponse(items.map(mask), total, query.page, query.limit);
  }

  async findOneForTenantUser(tenantUserId: string, id: string) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const row = await this.prisma.tenantMember.findFirst({
      where: { id, tenantBusinessId: { in: businessIds }, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('Member not found');
    // Covers view, update, changeStatus and remove in one place: all four
    // reach the row through here first.
    await this.assertRegisterEnabled(row.tenantBusinessId);
    return mask(row);
  }

  async createForTenantUser(
    tenantUserId: string,
    dto: CreateTenantMemberDto,
    mayMovePosition = false,
  ) {
    await this.assertBusinessOwned(tenantUserId, dto.tenantBusinessId);
    return this.create(dto, mayMovePosition);
  }

  async updateForTenantUser(
    tenantUserId: string,
    id: string,
    dto: UpdateTenantMemberDto,
    mayMovePosition = false,
  ) {
    await this.findOneForTenantUser(tenantUserId, id);
    if (dto.tenantBusinessId) await this.assertBusinessOwned(tenantUserId, dto.tenantBusinessId);
    return this.update(id, dto, mayMovePosition);
  }

  async changeStatusForTenantUser(
    tenantUserId: string,
    id: string,
    dto: ChangeTenantMemberStatusDto,
  ) {
    await this.findOneForTenantUser(tenantUserId, id);
    return this.changeStatus(id, dto);
  }

  async removeForTenantUser(tenantUserId: string, id: string) {
    await this.findOneForTenantUser(tenantUserId, id);
    return this.remove(id);
  }

  private async getMappedBusinessIds(tenantUserId: string): Promise<string[]> {
    const mappings = await this.prisma.tenantMappedBusiness.findMany({
      where: { tenantUserId, status: 'ACTIVE' },
      select: { tenantBusinessId: true },
    });
    return mappings.map((m) => m.tenantBusinessId);
  }

  private async assertBusinessOwned(tenantUserId: string, tenantBusinessId: string) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    if (!businessIds.includes(tenantBusinessId)) {
      throw new ForbiddenException('You are not mapped to this business');
    }
    await this.assertRegisterEnabled(tenantBusinessId);
  }

  private async assertRegisterEnabled(tenantBusinessId: string) {
    const enabled = await this.settings.isSettingEnabled(
      tenantBusinessId,
      MEMBER_REGISTER_SETTING_KEY,
    );
    if (!enabled) {
      throw new ForbiddenException('The member register is turned off for this business');
    }
  }

  /**
   * The subset of `businessIds` whose register is open.
   *
   * One query for the whole set, not one per business: this runs on every
   * list request. It looks for the businesses explicitly switched OFF and
   * removes them, which is also how "unset means enabled" falls out - a
   * business with no row simply does not appear in `closed`.
   */
  private async enabledBusinessIds(businessIds: string[]): Promise<string[]> {
    if (businessIds.length === 0) return [];
    const closed = await this.prisma.tenantBusinessSetting.findMany({
      where: {
        tenantBusinessId: { in: businessIds },
        settingKey: { equals: MEMBER_REGISTER_SETTING_KEY, mode: 'insensitive' },
        // A BOOLEAN is written as exactly 'true' or 'false' by the settings
        // validator, so this comparison is deliberately case-sensitive.
        settingValue: 'false',
        status: 'ACTIVE',
      },
      select: { tenantBusinessId: true },
    });
    const closedIds = new Set(closed.map((row) => row.tenantBusinessId));
    return businessIds.filter((id) => !closedIds.has(id));
  }

  // ---------- The position a member holds ----------

  /**
   * The permission that overrides a business's fixed position.
   *
   * Named once: the string appears in the catalogue, in two controllers and
   * here, and only this copy fails CLOSED if it is mistyped.
   */
  static readonly POSITION_UPDATE_KEY = 'tenant-members:position_update';

  /**
   * Whether a position has room for one more ACTIVE member.
   *
   * Lock-free, for callers that only need to DISPLAY the answer - the public
   * picker, and the register-open flag. Anything that writes a member row
   * uses assertPositionHasRoom() instead, because an answer read outside a
   * transaction is stale the moment it returns.
   */
  async positionHasRoom(
    client: Prisma.TransactionClient | PrismaService,
    tenantBusinessId: string,
    associationPositionId: string,
    exceptMemberId?: string,
  ): Promise<boolean> {
    const position = await client.tenantAssociationPosition.findUnique({
      where: { id: associationPositionId },
      select: { maxMembers: true },
    });
    // A missing position is a REFERENCE fault, which assertRefs and the
    // foreign key both speak to. Answering "no room" would report it as a
    // capacity problem and send somebody looking in the wrong place.
    if (!position || position.maxMembers <= 0) return true;

    const seated = await client.tenantMember.count({
      where: {
        tenantBusinessId,
        associationPositionId,
        // ACTIVE only. A PENDING enrolment is not yet a member and a
        // suspended one has given the seat back, so neither holds one.
        status: 'ACTIVE',
        ...(exceptMemberId ? { id: { not: exceptMemberId } } : {}),
      },
    });
    return seated < position.maxMembers;
  }

  /**
   * The same question, asked where the answer must STAY true until commit.
   *
   * MUST run inside a transaction, for the reason allocateMemberIdNumber
   * must: it takes a row lock on the POSITION with SELECT ... FOR UPDATE,
   * which serialises everybody competing for that position's last seat while
   * leaving every other position uncontended. There is no row to lock for a
   * member who does not exist yet, which is why the parent is locked instead.
   *
   * Unlike the membership number there is NO constraint behind this lock. A
   * unique index enforces at most ONE row per key and SQL has no "at most N"
   * form, so above a cap of 1 the lock is the whole guarantee.
   *
   * LOCK ORDER: the position is always locked BEFORE the RTO. Two paths
   * taking the same two locks in opposite orders deadlock under exactly the
   * concurrency this exists for.
   */
  private async assertPositionHasRoom(
    tx: Prisma.TransactionClient,
    tenantBusinessId: string,
    associationPositionId: string,
    exceptMemberId?: string,
  ): Promise<void> {
    // Raw, because Prisma has no FOR UPDATE. Parameterised, not interpolated.
    await tx.$queryRaw`SELECT id FROM tenant_association_positions WHERE id = ${associationPositionId} FOR UPDATE`;

    if (await this.positionHasRoom(tx, tenantBusinessId, associationPositionId, exceptMemberId)) {
      return;
    }

    const position = await tx.tenantAssociationPosition.findUnique({
      where: { id: associationPositionId },
      select: { positionName: true, maxMembers: true },
    });
    throw new BadRequestException(
      `${position?.positionName ?? 'That position'} is full: it allows ` +
        `${position?.maxMembers} active member(s). Deactivate the current ` +
        `holder, or raise the limit on the position.`,
    );
  }

  /**
   * Refuses a position other than the one this business has fixed.
   *
   * `memberRegister.positionId` fixes the position members are filed under.
   * On the PUBLIC path the server simply overrides what was sent - the
   * applicant was never offered the choice, so a mismatch is not a mistake
   * they could act on. Here it is a refusal instead, because staff DID see
   * the field, and silently filing a Treasurer as a Member would be worse
   * than saying no.
   *
   * `tenant-members:position_update` is the way out, and the reason that key
   * exists: an association still has to be able to record its own Secretary.
   */
  private async assertPositionAllowed(
    tenantBusinessId: string,
    associationPositionId: string,
    mayMovePosition: boolean,
  ): Promise<void> {
    if (mayMovePosition) return;
    const fixed = await this.settings.resolveApplicantPositionId(tenantBusinessId);
    if (fixed && fixed !== associationPositionId) {
      throw new ForbiddenException(
        'This business files every member under a fixed position. Changing it ' +
          'needs the "Position_update Tenant Members" permission.',
      );
    }
  }

  // ---------- Portal password, set by staff ----------

  /**
   * Sets a member's portal password on their behalf.
   *
   * One thing separates this from the member's own change in
   * MemberAuthService: there is no currentPassword to verify. That is the
   * whole point, and the reason it carries its own permission rather than
   * riding on `update`.
   *
   * It also does NOT require an existing hash. `passwordHash` is nullable and
   * every staff-enrolled member has none, so this is equally how such a
   * member gets portal access for the first time.
   */
  async resetPassword(id: string, dto: ResetTenantMemberPasswordDto) {
    const row = await this.prisma.tenantMember.findFirst({
      where: { id, status: { not: 'DELETED' } },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Member not found');

    // Hashed OUTSIDE the transaction. Argon2id is deliberately slow, and
    // holding a write transaction open across it would serialise unrelated
    // work for no benefit.
    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });

    const timestamp = now();
    await this.prisma.$transaction(async (tx) => {
      await tx.tenantMember.update({
        where: { id },
        data: { passwordHash, updatedAt: timestamp },
      });
      // Every refresh token dies with the old password. A staff reset is what
      // somebody asks for after a lost phone or a shared password, and
      // leaving those sessions alive would defeat the reason for asking. Same
      // mechanism the member's own password change uses.
      await tx.tenantMemberRefreshToken.updateMany({
        where: { tenantMemberId: id, revokedAt: null },
        data: { revokedAt: timestamp },
      });
    });

    // The ACCESS token is a JWT and cannot be revoked: an app already open
    // keeps working until it expires and then cannot refresh. There is no
    // deny-list anywhere in this system, deliberately.
    return { success: true };
  }

  async resetPasswordForTenantUser(
    tenantUserId: string,
    id: string,
    dto: ResetTenantMemberPasswordDto,
  ) {
    // Ownership and the register flag, both, in one existing call.
    await this.findOneForTenantUser(tenantUserId, id);
    return this.resetPassword(id, dto);
  }
}
