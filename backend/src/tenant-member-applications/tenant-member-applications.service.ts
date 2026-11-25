import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { encryptValue } from '../common/utils/encryption.util';
import { blindIndex, normaliseAadhaar } from '../common/utils/blind-index.util';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import { listResponse, paginate } from '../common/dto/query.dto';
import { TenantBusinessSettingsService } from '../tenant-business-settings/tenant-business-settings.service';
import { TenantMembersService } from '../tenant-members/tenant-members.service';
import {
  RejectMemberApplicationDto,
  SubmitMemberApplicationDto,
} from './dto/member-application.dto';
import { MemberApplicationListQueryDto } from './dto/member-application-query.dto';

const MEMBER_REGISTER_SETTING_KEY = 'memberRegister.enabled';

/** Width of the zero-padded serial. It grows past this rather than wrapping. */
const APPLICATION_NUMBER_WIDTH = 6;

const INCLUDE = {
  tenantBusiness: { select: { id: true, systemCode: true, name: true } },
  associationPosition: { select: { id: true, positionName: true } },
  industry: { select: { id: true, industryName: true } },
  state: { select: { id: true, stateName: true } },
  district: { select: { id: true, districtName: true } },
  taluk: { select: { id: true, talukName: true } },
  rto: { select: { id: true, rtoName: true, rtoCode: true } },
};

type WithSecrets = { aadhaarNumber: string; aadhaarHash: string; passwordHash: string | null };

/**
 * Drops everything that must never leave the server.
 *
 * The same shape the register uses: the Aadhaar ciphertext is the secret, the
 * blind index is an offline oracle against a 10^12 space, and the password
 * hash is a password hash. `aadhaarLast4` stays, because a screen has to show
 * which person this is.
 */
function mask<T extends WithSecrets>(row: T) {
  const { aadhaarNumber: _ct, aadhaarHash: _hash, passwordHash: _pw, ...rest } = row;
  return rest;
}

function searchClause(search?: string) {
  if (!search) return {};
  const contains = { contains: search, mode: 'insensitive' as const };
  return {
    OR: [
      { memberName: contains },
      { memberNameTamil: contains },
      { businessName: contains },
      { businessNameTamil: contains },
      { phoneNumber: contains },
      { email: contains },
      { systemCode: contains },
      { applicationNumber: contains },
    ],
  };
}

@Injectable()
export class TenantMemberApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: TenantBusinessSettingsService,
    private readonly members: TenantMembersService,
  ) {}

  // ---------- The public path ----------

  /**
   * Files an application for the business the HOSTNAME resolved to.
   *
   * `tenantBusinessId` is a parameter rather than part of the DTO on purpose:
   * the caller is anonymous, and letting them name the association would let
   * anyone file against any of them.
   */
  async submit(tenantBusinessId: string, dto: SubmitMemberApplicationDto) {
    const open = await this.settings.isSettingEnabled(
      tenantBusinessId,
      MEMBER_REGISTER_SETTING_KEY,
    );
    if (!open) {
      throw new ForbiddenException('This association is not accepting registrations');
    }

    // A business may fix the position applicants are filed under. Enforced
    // here rather than trusted from the form, because this route is public:
    // the picker having one option stops an honest applicant choosing wrongly,
    // and says nothing about what a crafted request can send.
    //
    // It OVERRIDES rather than rejects. The applicant was never offered the
    // choice, so a mismatch is not a mistake they can act on, and failing
    // their application over a field they could not see would be the worse
    // answer.
    const fixedPositionId =
      await this.settings.resolveApplicantPositionId(tenantBusinessId);
    if (fixedPositionId) dto.associationPositionId = fixedPositionId;

    await this.assertChain(tenantBusinessId, dto);

    const digits = normaliseAadhaar(dto.aadhaarNumber);
    const aadhaarHash = blindIndex(dto.aadhaarNumber);

    // Checked against BOTH tables: somebody already in the register should be
    // told to sign in, not left waiting on an application that will be
    // rejected as a duplicate.
    const member = await this.prisma.tenantMember.findFirst({
      where: { tenantBusinessId, aadhaarHash },
      select: { id: true },
    });
    if (member) {
      throw new BadRequestException(
        'This Aadhaar number already belongs to a member of this association',
      );
    }
    const existing = await this.prisma.tenantMemberApplication.findFirst({
      where: { tenantBusinessId, aadhaarHash },
      select: { status: true },
    });
    if (existing) {
      throw new BadRequestException(
        'An application with this Aadhaar number has already been submitted',
      );
    }

    const timestamp = now();
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const created = await this.prisma.$transaction(async (tx) => {
      const applicationNumber = await this.allocateApplicationNumber(tx, tenantBusinessId);
      return tx.tenantMemberApplication.create({
        data: {
          id: newId(),
          systemCode: newSystemCode('APP'),
          tenantBusinessId,
          applicationNumber,
          passwordHash,
          memberName: dto.memberName,
          memberNameTamil: dto.memberNameTamil,
          businessName: dto.businessName,
          businessNameTamil: dto.businessNameTamil,
          associationPositionId: dto.associationPositionId,
          industryId: dto.industryId,
          aadhaarNumber: encryptValue(digits),
          aadhaarHash,
          aadhaarLast4: digits.slice(-4),
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
          weddingDate: dto.isMarried ? dto.weddingDate : null,
          passportPhotoPath: dto.passportPhotoPath,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        include: INCLUDE,
      });
    });

    // Only the number and a confirmation go back. An anonymous caller gets no
    // echo of what they submitted.
    return {
      applicationNumber: created.applicationNumber,
      status: created.status,
      submittedAt: created.createdAt,
    };
  }

  /**
   * The next application number for a business: zero-padded digits from 1.
   *
   * Allocated exactly as membership numbers are, and for the same reasons:
   *
   * 1. The BUSINESS row is locked with `SELECT ... FOR UPDATE`, which
   *    serialises allocation per association. There is no row to lock for a
   *    number that does not exist yet, so locking the applications would not
   *    stop two submissions both reading 000001.
   * 2. The suffix is compared NUMERICALLY. '000999' sorts above '001000'
   *    only by luck of the padding - once the sequence outgrows the width, a
   *    string max stops advancing and every insert collides forever.
   *
   * `@@unique([tenantBusinessId, applicationNumber])` is the backstop.
   */
  private async allocateApplicationNumber(
    tx: Prisma.TransactionClient,
    tenantBusinessId: string,
  ): Promise<string> {
    await tx.$queryRaw`SELECT id FROM tenant_business WHERE id = ${tenantBusinessId} FOR UPDATE`;

    const issued = await tx.tenantMemberApplication.findMany({
      where: { tenantBusinessId },
      select: { applicationNumber: true },
    });

    let highest = 0;
    for (const row of issued) {
      if (!/^\d+$/.test(row.applicationNumber)) continue;
      highest = Math.max(highest, Number(row.applicationNumber));
    }
    return String(highest + 1).padStart(APPLICATION_NUMBER_WIDTH, '0');
  }

  /** Every FK must belong to the same business, as the register requires. */
  private async assertChain(tenantBusinessId: string, dto: SubmitMemberApplicationDto) {
    const owned = { tenantBusinessId, status: { not: 'DELETED' as const } };

    const [position, industry, state, district, taluk, rto] = await Promise.all([
      this.prisma.tenantAssociationPosition.findFirst({
        where: { id: dto.associationPositionId, ...owned },
      }),
      this.prisma.tenantIndustry.findFirst({ where: { id: dto.industryId, ...owned } }),
      this.prisma.tenantState.findFirst({ where: { id: dto.stateId, ...owned } }),
      this.prisma.tenantDistrict.findFirst({
        where: { id: dto.districtId, stateId: dto.stateId, ...owned },
      }),
      this.prisma.tenantTaluk.findFirst({
        where: { id: dto.talukId, districtId: dto.districtId, ...owned },
      }),
      // The RTO hangs off the DISTRICT, not the taluk above it on the form.
      this.prisma.tenantRto.findFirst({
        where: { id: dto.rtoId, tenantDistrictId: dto.districtId, ...owned },
      }),
    ]);

    if (!position) throw new BadRequestException('Unknown association position');
    if (!industry) throw new BadRequestException('Unknown industry');
    if (!state) throw new BadRequestException('Unknown state');
    if (!district) {
      throw new BadRequestException('District does not belong to the chosen state');
    }
    if (!taluk) {
      throw new BadRequestException('Taluk does not belong to the chosen district');
    }
    if (!rto) {
      throw new BadRequestException('RTO does not belong to the chosen district');
    }
  }

  // ---------- Staff review ----------

  async findAll(query: MemberApplicationListQueryDto) {
    const { page, limit, search, status, tenantBusinessId, sortBy, sortOrder } = query;
    const where = {
      ...(tenantBusinessId ? { tenantBusinessId } : {}),
      status: status ? status : ({ not: 'DELETED' } as const),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantMemberApplication.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantMemberApplication.count({ where }),
    ]);
    return listResponse(items.map(mask), total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.tenantMemberApplication.findFirst({
      where: { id, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('Application not found');
    return mask(row);
  }

  /**
   * Turns an application into a member, in ONE transaction.
   *
   * The member is created ACTIVE rather than PENDING - a deliberate break
   * from "a new member starts PENDING", because this approval IS that review.
   * Leaving them PENDING would mean they still could not sign in after being
   * told they were accepted.
   *
   * The password hash is carried across unchanged, so the applicant signs in
   * with what they chose at registration.
   */
  async approve(id: string, actorId?: string) {
    const application = await this.prisma.tenantMemberApplication.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.status === 'APPROVED') {
      throw new BadRequestException('That application has already been approved');
    }
    if (application.status === 'REJECTED') {
      throw new BadRequestException('That application was rejected');
    }

    const timestamp = now();
    return this.prisma.$transaction(async (tx) => {
      const member = await this.members.createFromApplication(tx, application, actorId);
      await tx.tenantMemberApplication.update({
        where: { id },
        data: {
          status: 'APPROVED',
          convertedMemberId: member.id,
          reviewedBy: actorId,
          reviewedAt: timestamp,
          updatedAt: timestamp,
        },
      });
      return member;
    });
  }

  async reject(id: string, dto: RejectMemberApplicationDto, actorId?: string) {
    const application = await this.prisma.tenantMemberApplication.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.status === 'APPROVED') {
      throw new BadRequestException(
        'That application was approved; remove the member instead',
      );
    }

    const timestamp = now();
    const row = await this.prisma.tenantMemberApplication.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: dto.reason,
        reviewedBy: actorId,
        reviewedAt: timestamp,
        updatedAt: timestamp,
      },
      include: INCLUDE,
    });
    return mask(row);
  }

  async remove(id: string) {
    await this.findOne(id);
    const timestamp = now();
    await this.prisma.tenantMemberApplication.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: timestamp, updatedAt: timestamp },
    });
    return { success: true };
  }

  // ---------- Tenant self-service ----------

  async findAllForTenantUser(tenantUserId: string, query: MemberApplicationListQueryDto) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const scoped = query.tenantBusinessId
      ? businessIds.filter((id) => id === query.tenantBusinessId)
      : businessIds;
    const { page, limit, search, status, sortBy, sortOrder } = query;
    const where = {
      tenantBusinessId: { in: scoped },
      status: status ? status : ({ not: 'DELETED' } as const),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantMemberApplication.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantMemberApplication.count({ where }),
    ]);
    return listResponse(items.map(mask), total, page, limit);
  }

  async assertOwned(tenantUserId: string, id: string): Promise<void> {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const row = await this.prisma.tenantMemberApplication.findFirst({
      where: { id, tenantBusinessId: { in: businessIds }, status: { not: 'DELETED' } },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Application not found');
  }

  private async getMappedBusinessIds(tenantUserId: string): Promise<string[]> {
    const mappings = await this.prisma.tenantMappedBusiness.findMany({
      where: { tenantUserId, status: 'ACTIVE' },
      select: { tenantBusinessId: true },
    });
    return mappings.map((m) => m.tenantBusinessId);
  }
}
