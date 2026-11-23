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

    return {
      association,
      // Unset means enabled, matching how the register reads it everywhere
      // else - a business whose settings backfill has not run is not closed.
      registrationOpen: map[MEMBER_REGISTER_SETTING_KEY] !== 'false',
    };
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

    const [positions, industries, states, districts, taluks, rtos] = await Promise.all([
      this.prisma.tenantAssociationPosition.findMany({
        where: owned,
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

    return { positions, industries, states, districts, taluks, rtos };
  }
}
