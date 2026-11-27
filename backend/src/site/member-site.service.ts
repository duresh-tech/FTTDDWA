import { Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { TenantBusinessSettingsService } from '../tenant-business-settings/tenant-business-settings.service';
import { SiteService } from './site.service';

const MEMBER_REGISTER_SETTING_KEY = 'memberRegister.enabled';

/**
 * The settings a public page may show. Listed explicitly rather than returning
 * the whole map: the settings store also holds things a business did not
 * publish, and an allow-list is the only version of this that stays correct
 * when a setting is added later.
 */
const PUBLIC_SETTING_KEYS = [
  'association.name',
  'association.nameTamil',
  'association.shortName',
  'association.shortNameTamil',
  'association.registrationNumber',
  'association.tagline',
  'association.taglineTamil',
  'association.email',
  'association.phoneNumber',
  'association.whatsappNumber',
  'association.isWhatsapp',
  'association.officeAddress',
  'association.officeAddressTamil',
  'association.pincode',
  'association.logo1Path',
];

@Injectable()
export class MemberSiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly site: SiteService,
    private readonly settings: TenantBusinessSettingsService,
  ) {}

  /**
   * The business this hostname serves, or 404.
   *
   * Everything public for members hangs off this. The business is NEVER taken
   * from the request body: an anonymous caller naming the association they
   * are applying to would let anyone file against any of them.
   */
  async businessIdForRequest(req: Request): Promise<string> {
    const resolution = await this.site.resolveForRequest(req);
    if (resolution.kind !== 'tenant' || !resolution.business) {
      // The system console has no association, so there is nothing public to
      // show and nowhere to file. 404 rather than 403: on this hostname the
      // member portal does not exist at all.
      throw new NotFoundException('This address does not serve a member portal');
    }
    return resolution.business.id;
  }

  /** The association's public details, for the home and registration pages. */
  async publicSite(req: Request) {
    const tenantBusinessId = await this.businessIdForRequest(req);
    const map = await this.settings.getSettingsMapForBusiness(tenantBusinessId, [
      ...PUBLIC_SETTING_KEYS,
      MEMBER_REGISTER_SETTING_KEY,
    ]);

    const association: Record<string, string> = {};
    for (const key of PUBLIC_SETTING_KEYS) {
      if (map[key]) association[key] = map[key];
    }

    const fixedPositionId =
      await this.settings.resolveApplicantPositionId(tenantBusinessId);

    // A FIXED position with no seats left means this association cannot accept
    // anybody at all - there is no other position an applicant could be filed
    // under. Reported as "closed" rather than as an empty picker, because
    // every client already renders a closed register and none of them has to
    // learn a new state.
    //
    // Only the fixed case can close the register this way. When applicants
    // choose, a full position is simply absent from the list below and the
    // others still work.
    const fixedPositionFull =
      fixedPositionId !== null &&
      !(await this.positionsWithRoom(tenantBusinessId)).has(fixedPositionId);

    return {
      association,
      // Unset means enabled, matching how the register reads it everywhere
      // else - a business whose settings backfill has not run is not closed.
      registrationOpen: map[MEMBER_REGISTER_SETTING_KEY] !== 'false' && !fixedPositionFull,
      /**
       * The position applicants are filed under, or null when they choose.
       *
       * A named, already-resolved field rather than a PUBLIC_SETTING_KEYS
       * entry, for the same reason registrationOpen is: the clients should
       * read an answer, not a raw setting they each have to interpret. It is
       * re-validated against the positions table, so a stale id reads as null.
       */
      fixedPositionId,
    };
  }

  /**
   * The ids of this business's positions that can still take an ACTIVE member.
   *
   * One grouped count rather than a query per position: a business with forty
   * positions would otherwise make forty round trips to render one picker.
   * `groupBy` returns only positions that HAVE an active member, which is why
   * the lookup below defaults to 0.
   *
   * Read without a lock, deliberately. This decides what to SHOW; the seat is
   * claimed under `SELECT ... FOR UPDATE` in TenantMembersService, and a
   * picker that is a moment out of date is not a correctness problem.
   */
  private async positionsWithRoom(tenantBusinessId: string): Promise<Set<string>> {
    const [positions, counts] = await Promise.all([
      this.prisma.tenantAssociationPosition.findMany({
        where: { tenantBusinessId, status: 'ACTIVE' },
        select: { id: true, maxMembers: true },
      }),
      this.prisma.tenantMember.groupBy({
        by: ['associationPositionId'],
        where: { tenantBusinessId, status: 'ACTIVE' },
        _count: { _all: true },
      }),
    ]);

    const seated = new Map(counts.map((row) => [row.associationPositionId, row._count._all]));
    return new Set(
      positions
        .filter((p) => p.maxMembers <= 0 || (seated.get(p.id) ?? 0) < p.maxMembers)
        .map((p) => p.id),
    );
  }

  /**
   * The lookups the registration form's pickers need.
   *
   * Reference data only - the names of positions, trades and places. It is
   * already printed on every membership card, so publishing it costs nothing
   * that the cards do not already.
   */
  async publicOptions(req: Request) {
    const tenantBusinessId = await this.businessIdForRequest(req);
    const owned = { tenantBusinessId, status: 'ACTIVE' as const };

    // When the business fixes applicants to one position, that is the only one
    // the public form may offer. Narrowed HERE rather than in each client, so
    // a client that forgets cannot put the other positions back.
    const fixedPositionId =
      await this.settings.resolveApplicantPositionId(tenantBusinessId);

    // Which positions still have a seat. Fetched alongside the lists below
    // rather than inside the position query, because "fewer ACTIVE members
    // than maxMembers" compares a count against a column and Prisma has no
    // `where` that can say that.
    const withRoom = await this.positionsWithRoom(tenantBusinessId);

    const [positions, industries, states, districts, taluks, rtos] = await Promise.all([
      this.prisma.tenantAssociationPosition.findMany({
        // Two filters, narrowest first. A FIXED position wins outright - the
        // business named exactly one, and that answer does not depend on a
        // flag. Otherwise only positions flagged for the application form are
        // offered, so an association can keep Treasurer out of a stranger's
        // reach without hiding it from its own staff.
        where: fixedPositionId
          ? { ...owned, id: fixedPositionId }
          : { ...owned, showOnApplicationForm: true },
        select: { id: true, positionName: true, positionNameTamil: true },
        orderBy: { positionName: 'asc' },
      }),
      this.prisma.tenantIndustry.findMany({
        where: owned,
        select: { id: true, industryName: true, industryNameTamil: true },
        orderBy: { industryName: 'asc' },
      }),
      this.prisma.tenantState.findMany({
        where: owned,
        select: { id: true, stateName: true, stateNameTamil: true },
        orderBy: { stateName: 'asc' },
      }),
      // Districts, taluks and RTOs come back WITH their parent id, so the form
      // can cascade client-side instead of asking again on every change.
      this.prisma.tenantDistrict.findMany({
        where: owned,
        select: { id: true, districtName: true, districtNameTamil: true, stateId: true },
        orderBy: { districtName: 'asc' },
      }),
      this.prisma.tenantTaluk.findMany({
        where: owned,
        select: { id: true, talukName: true, talukNameTamil: true, districtId: true },
        orderBy: { talukName: 'asc' },
      }),
      this.prisma.tenantRto.findMany({
        where: owned,
        select: { id: true, rtoName: true, rtoNameTamil: true, rtoCode: true, tenantDistrictId: true },
        orderBy: { rtoCode: 'asc' },
      }),
    ]);

    return {
      // A full position is not offered, including the fixed one. Offering a
      // seat that submission would refuse is worse than offering nothing -
      // and when the FIXED position is full, publicSite() has already told
      // the client the register is closed, so the form is never reached.
      //
      // maxMembers itself is never returned: a stranger has no business
      // reading an association's headcount or its limits.
      positions: positions.filter((p) => withRoom.has(p.id)),
      industries,
      states,
      districts,
      taluks,
      rtos,
    };
  }
}
