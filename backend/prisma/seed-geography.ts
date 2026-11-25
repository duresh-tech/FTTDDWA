/**
 * Idempotent Tamil Nadu reference-data loader.
 *
 *   npm run seed:geography
 *   npm run seed:geography -- 01a207ab-4d6d-7642-95b3-342dc0c612a9
 *   SEED_GEOGRAPHY_BUSINESS_ID=<uuid> npm run seed:geography
 *
 * All five geography tables are tenant-scoped, so every row belongs to one
 * tenant business. The default is the dev business below; pass another UUID to
 * load the same catalogue for a different business. The business must already
 * exist - this script never creates one.
 *
 * Re-running is safe: rows are matched by their business-scoped natural keys
 * (countryCode, stateCode, districtCode, rtoCode, and taluk name within a
 * district). Names and RTO district links are refreshed; status and deletedAt
 * are left alone so a row retired by a user is not silently resurrected.
 *
 * Prerequisites:
 *   - migration 0013_tenant_countries applied (`npm run migrate:deploy`)
 *   - `npm run seed` if permissions were added after setup
 *
 * Data source and caveats are documented at the top of data/tamil-nadu-geography.ts.
 */
import { PrismaClient } from '@prisma/client';
import { newId, newSystemCode, now } from '../src/common/utils/id.util';
import { TAMIL_NADU_GEOGRAPHY } from './data/tamil-nadu-geography';

const DEFAULT_BUSINESS_ID = '01a207ab-4d6d-7642-95b3-342dc0c612a9';

const prisma = new PrismaClient();

function resolveBusinessId(): string {
  const id = process.argv[2] ?? process.env.SEED_GEOGRAPHY_BUSINESS_ID ?? DEFAULT_BUSINESS_ID;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error(`Not a UUID: ${id}`);
  }
  return id;
}

async function main() {
  const tenantBusinessId = resolveBusinessId();
  const business = await prisma.tenantBusiness.findUnique({ where: { id: tenantBusinessId } });
  if (!business || business.status === 'DELETED') {
    throw new Error(`Tenant business ${tenantBusinessId} does not exist or is deleted`);
  }

  const timestamp = now();
  const { country, state, districts } = TAMIL_NADU_GEOGRAPHY;

  const countryRow = await prisma.tenantCountry.upsert({
    where: {
      tenantBusinessId_countryCode: { tenantBusinessId, countryCode: country.countryCode },
    },
    create: {
      id: newId(),
      systemCode: newSystemCode('CTR'),
      tenantBusinessId,
      ...country,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    update: {
      countryName: country.countryName,
      countryNameTamil: country.countryNameTamil,
    },
  });

  const stateRow = await prisma.tenantState.upsert({
    where: {
      tenantBusinessId_stateCode: { tenantBusinessId, stateCode: state.stateCode },
    },
    create: {
      id: newId(),
      systemCode: newSystemCode('STA'),
      tenantBusinessId,
      countryId: countryRow.id,
      ...state,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    update: {
      stateName: state.stateName,
      stateNameTamil: state.stateNameTamil,
    },
  });

  let talukCount = 0;
  let rtoCount = 0;
  let districtCount = 0;

  for (const district of districts) {
    const districtRow = await prisma.tenantDistrict.upsert({
      where: {
        tenantBusinessId_districtCode: {
          tenantBusinessId,
          districtCode: district.districtCode,
        },
      },
      create: {
        id: newId(),
        systemCode: newSystemCode('DIS'),
        tenantBusinessId,
        stateId: stateRow.id,
        districtCode: district.districtCode,
        districtName: district.districtName,
        districtNameTamil: district.districtNameTamil,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      update: {
        districtName: district.districtName,
        districtNameTamil: district.districtNameTamil,
      },
    });
    districtCount++;

    for (const taluk of district.taluks) {
      const existing = await prisma.tenantTaluk.findFirst({
        where: {
          tenantBusinessId,
          districtId: districtRow.id,
          talukName: taluk.talukName,
        },
        select: { id: true },
      });
      if (existing) {
        await prisma.tenantTaluk.update({
          where: { id: existing.id },
          data: { talukNameTamil: taluk.talukNameTamil },
        });
      } else {
        await prisma.tenantTaluk.create({
          data: {
            id: newId(),
            systemCode: newSystemCode('TLK'),
            tenantBusinessId,
            stateId: stateRow.id,
            districtId: districtRow.id,
            ...taluk,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });
      }
      talukCount++;
    }

    for (const rto of district.rtos) {
      await prisma.tenantRto.upsert({
        where: {
          tenantBusinessId_rtoCode: { tenantBusinessId, rtoCode: rto.rtoCode },
        },
        create: {
          id: newId(),
          systemCode: newSystemCode('RTO'),
          tenantBusinessId,
          tenantDistrictId: districtRow.id,
          rtoCode: rto.rtoCode,
          rtoName: rto.rtoName,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        update: { rtoName: rto.rtoName, tenantDistrictId: districtRow.id },
      });
      rtoCount++;
    }
  }

  console.log(
    `Geography seeded for ${business.name} (${tenantBusinessId}): ` +
      `1 country, 1 state, ${districtCount} districts, ${talukCount} taluks, ${rtoCount} RTOs.`,
  );
}

main()
  .catch((error) => {
    console.error('Geography seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
