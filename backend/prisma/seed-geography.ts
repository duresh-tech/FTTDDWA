/**
 * Idempotent Tamil Nadu reference-data loader.
 *
 *   npm run seed:geography                       # all ACTIVE businesses
 *   npm run seed:geography -- --all              # explicit all ACTIVE businesses
 *   npm run seed:geography -- <uuid>             # one business
 *   SEED_GEOGRAPHY_BUSINESS_ID=<uuid> npm run seed:geography
 *
 * All five geography tables are tenant-scoped, so every row belongs to one
 * tenant business. With no UUID, the script loads the catalogue into every
 * ACTIVE, non-deleted business; an explicit UUID narrows it to one business.
 * Businesses must already exist - this script never creates one.
 *
 * Re-running is safe: rows are matched by their business-scoped natural keys
 * (countryCode, stateCode, districtCode, rtoCode, and taluk name within a
 * district). Names and parent links are refreshed; status and deletedAt are
 * left alone so a row retired by a user is not silently resurrected.
 *
 * Prerequisites:
 *   - migration 0013_tenant_countries applied (`npm run migrate:deploy`)
 *   - `npm run seed` if permissions were added after setup
 *
 * Data source and caveats are documented at the top of data/tamil-nadu-geography.ts.
 */
import { PrismaClient } from "@prisma/client";
import { newId, newSystemCode, now } from "../src/common/utils/id.util";
import { TAMIL_NADU_GEOGRAPHY } from "./data/tamil-nadu-geography";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const prisma = new PrismaClient();

interface TargetBusiness {
  id: string;
  name: string;
}

interface SeedCounts {
  districts: number;
  taluks: number;
  rtos: number;
}

function resolveRequestedBusinessId(): string | undefined {
  const arg = process.argv[2];
  if (arg === "--all") return undefined;

  const id = arg ?? process.env.SEED_GEOGRAPHY_BUSINESS_ID;
  if (id === undefined || id.trim() === "") return undefined;
  if (!UUID_REGEX.test(id)) {
    throw new Error(`Not a UUID: ${id}`);
  }
  return id;
}

async function resolveBusinesses(): Promise<TargetBusiness[]> {
  const requestedId = resolveRequestedBusinessId();
  if (requestedId !== undefined) {
    const business = await prisma.tenantBusiness.findUnique({
      where: { id: requestedId },
      select: { id: true, name: true, status: true },
    });
    if (!business || business.status === "DELETED") {
      throw new Error(
        `Tenant business ${requestedId} does not exist or is deleted`,
      );
    }
    return [{ id: business.id, name: business.name }];
  }

  return prisma.tenantBusiness.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
}

async function seedForBusiness(business: TargetBusiness): Promise<SeedCounts> {
  const tenantBusinessId = business.id;

  return prisma.$transaction(
    async (tx) => {
      const timestamp = now();
      const { country, state, districts } = TAMIL_NADU_GEOGRAPHY;

      const countryRow = await tx.tenantCountry.upsert({
        where: {
          tenantBusinessId_countryCode: {
            tenantBusinessId,
            countryCode: country.countryCode,
          },
        },
        create: {
          id: newId(),
          systemCode: newSystemCode("CTR"),
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

      const stateRow = await tx.tenantState.upsert({
        where: {
          tenantBusinessId_stateCode: {
            tenantBusinessId,
            stateCode: state.stateCode,
          },
        },
        create: {
          id: newId(),
          systemCode: newSystemCode("STA"),
          tenantBusinessId,
          countryId: countryRow.id,
          ...state,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        update: {
          countryId: countryRow.id,
          stateName: state.stateName,
          stateNameTamil: state.stateNameTamil,
        },
      });

      const counts: SeedCounts = { districts: 0, taluks: 0, rtos: 0 };

      for (const district of districts) {
        const districtRow = await tx.tenantDistrict.upsert({
          where: {
            tenantBusinessId_districtCode: {
              tenantBusinessId,
              districtCode: district.districtCode,
            },
          },
          create: {
            id: newId(),
            systemCode: newSystemCode("DIS"),
            tenantBusinessId,
            stateId: stateRow.id,
            districtCode: district.districtCode,
            districtName: district.districtName,
            districtNameTamil: district.districtNameTamil,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          update: {
            stateId: stateRow.id,
            districtName: district.districtName,
            districtNameTamil: district.districtNameTamil,
          },
        });
        counts.districts++;

        for (const taluk of district.taluks) {
          const existing = await tx.tenantTaluk.findFirst({
            where: {
              tenantBusinessId,
              districtId: districtRow.id,
              talukName: taluk.talukName,
            },
            select: { id: true },
          });
          if (existing) {
            await tx.tenantTaluk.update({
              where: { id: existing.id },
              data: {
                stateId: stateRow.id,
                talukNameTamil: taluk.talukNameTamil,
              },
            });
          } else {
            await tx.tenantTaluk.create({
              data: {
                id: newId(),
                systemCode: newSystemCode("TLK"),
                tenantBusinessId,
                stateId: stateRow.id,
                districtId: districtRow.id,
                ...taluk,
                createdAt: timestamp,
                updatedAt: timestamp,
              },
            });
          }
          counts.taluks++;
        }

        for (const rto of district.rtos) {
          await tx.tenantRto.upsert({
            where: {
              tenantBusinessId_rtoCode: {
                tenantBusinessId,
                rtoCode: rto.rtoCode,
              },
            },
            create: {
              id: newId(),
              systemCode: newSystemCode("RTO"),
              tenantBusinessId,
              tenantDistrictId: districtRow.id,
              rtoCode: rto.rtoCode,
              rtoName: rto.rtoName,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            update: {
              tenantDistrictId: districtRow.id,
              rtoName: rto.rtoName,
            },
          });
          counts.rtos++;
        }
      }

      return counts;
    },
    { maxWait: 10000, timeout: 120000 },
  );
}

async function main() {
  const businesses = await resolveBusinesses();
  if (businesses.length === 0) {
    console.log("No ACTIVE tenant businesses found; nothing to seed.");
    return;
  }

  const totals: SeedCounts = { districts: 0, taluks: 0, rtos: 0 };
  let failed = 0;

  for (const business of businesses) {
    try {
      const counts = await seedForBusiness(business);
      totals.districts += counts.districts;
      totals.taluks += counts.taluks;
      totals.rtos += counts.rtos;
      console.log(
        `Geography seeded for ${business.name} (${business.id}): ` +
          `1 country, 1 state, ${counts.districts} districts, ${counts.taluks} taluks, ${counts.rtos} RTOs.`,
      );
    } catch (error) {
      failed++;
      console.error(
        `Geography seed failed for ${business.name} (${business.id}): ` +
          `${error instanceof Error ? error.message : error}`,
      );
    }
  }

  console.log(
    `Geography seed complete: ${businesses.length - failed}/${businesses.length} businesses; ` +
      `totals: ${totals.districts} districts, ${totals.taluks} taluks, ${totals.rtos} RTOs.`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(
      "Geography seed failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
