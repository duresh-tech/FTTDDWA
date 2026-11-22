import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { TenantMemberListQueryDto } from './dto/tenant-member-query.dto';

const INCLUDE = {
  tenantBusiness: { select: { id: true, systemCode: true, name: true } },
  associationPosition: { select: { id: true, positionName: true } },
  industry: { select: { id: true, industryName: true } },
  state: { select: { id: true, stateName: true } },
  district: { select: { id: true, districtName: true } },
  taluk: { select: { id: true, talukName: true } },
};

type WithAadhaar = { aadhaarNumber: string; aadhaarHash: string };

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
    ],
  };
}

@Injectable()
export class TenantMembersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(dto: CreateTenantMemberDto) {
    await this.assertBusinessExists(dto.tenantBusinessId);
    await this.assertChain(dto.tenantBusinessId, dto.stateId, dto.districtId, dto.talukId);
    await this.assertRefs(dto.tenantBusinessId, dto.associationPositionId, dto.industryId);

    const aadhaarHash = blindIndex(dto.aadhaarNumber);
    await this.assertAadhaarUnique(dto.tenantBusinessId, aadhaarHash);

    const timestamp = now();
    const row = await this.prisma.tenantMember.create({
      data: {
        id: newId(),
        systemCode: newSystemCode('MEM'),
        tenantBusinessId: dto.tenantBusinessId,
        memberName: dto.memberName,
        memberNameTamil: dto.memberNameTamil,
        businessName: dto.businessName,
        businessNameTamil: dto.businessNameTamil,
        associationPositionId: dto.associationPositionId,
        industryId: dto.industryId,
        aadhaarNumber: encryptValue(normaliseAadhaar(dto.aadhaarNumber)),
        aadhaarHash,
        aadhaarLast4: normaliseAadhaar(dto.aadhaarNumber).slice(-4),
        phoneNumber: dto.phoneNumber,
        whatsappNumber: dto.whatsappNumber,
        email: dto.email,
        stateId: dto.stateId,
        districtId: dto.districtId,
        talukId: dto.talukId,
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
    return mask(row);
  }

  async update(id: string, dto: UpdateTenantMemberDto) {
    const row = await this.prisma.tenantMember.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('Member not found');

    const tenantBusinessId = dto.tenantBusinessId ?? row.tenantBusinessId;
    if (dto.tenantBusinessId) await this.assertBusinessExists(tenantBusinessId);

    // Any touched part of the chain re-validates the whole chain, because the
    // pieces only make sense together.
    if (dto.stateId || dto.districtId || dto.talukId || dto.tenantBusinessId) {
      await this.assertChain(
        tenantBusinessId,
        dto.stateId ?? row.stateId,
        dto.districtId ?? row.districtId,
        dto.talukId ?? row.talukId,
      );
    }
    if (dto.associationPositionId || dto.industryId || dto.tenantBusinessId) {
      await this.assertRefs(
        tenantBusinessId,
        dto.associationPositionId ?? row.associationPositionId,
        dto.industryId ?? row.industryId,
      );
    }

    const { aadhaarNumber, aadhaarHash, aadhaarLast4 } = await this.resolveAadhaar(
      dto,
      row,
      tenantBusinessId,
    );
    const { isMarried, weddingDate } = this.resolveMarriage(dto, row);

    const updated = await this.prisma.tenantMember.update({
      where: { id },
      data: {
        ...dto,
        aadhaarNumber,
        aadhaarHash,
        aadhaarLast4,
        isMarried,
        weddingDate,
        updatedAt: now(),
      },
      include: INCLUDE,
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
    row: { aadhaarNumber: string; aadhaarHash: string; aadhaarLast4: string },
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
    const hash = blindIndex(dto.aadhaarNumber);
    await this.assertAadhaarUnique(tenantBusinessId, hash, row.aadhaarHash);
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

    const updated = await this.prisma.tenantMember.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
        updatedAt: now(),
      },
      include: INCLUDE,
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
  private async assertChain(
    tenantBusinessId: string,
    stateId: string,
    districtId: string,
    talukId: string,
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
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    return this.prisma.tenantBusiness.findMany({
      where: { id: { in: businessIds }, status: { not: 'DELETED' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAllForTenantUser(tenantUserId: string, query: TenantMemberListQueryDto) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const scoped = query.tenantBusinessId
      ? businessIds.filter((b) => b === query.tenantBusinessId)
      : businessIds;
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
    return mask(row);
  }

  async createForTenantUser(tenantUserId: string, dto: CreateTenantMemberDto) {
    await this.assertBusinessOwned(tenantUserId, dto.tenantBusinessId);
    return this.create(dto);
  }

  async updateForTenantUser(tenantUserId: string, id: string, dto: UpdateTenantMemberDto) {
    await this.findOneForTenantUser(tenantUserId, id);
    if (dto.tenantBusinessId) await this.assertBusinessOwned(tenantUserId, dto.tenantBusinessId);
    return this.update(id, dto);
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
  }
}
