import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const AssociationPositionStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED']);

// max() mirrors the Prisma VarChar exactly - 100 for the names, 255 for remark.
const CreateTenantAssociationPositionSchema = z.object({
  tenantBusinessId: z.string().uuid(),
  positionName: z.string().min(1).max(100),
  /** A position may be recorded in English only. */
  positionNameTamil: z.string().max(100).optional(),
  remark: z.string().max(255).optional(),
  /**
   * Whether a public APPLICANT may claim this position.
   *
   * Defaults true, matching the column: a position is offered unless somebody
   * decides otherwise. It governs the public registration form only - staff
   * enrolling a member directly always see every position, because an
   * association has to be able to record a Treasurer.
   */
  showOnApplicationForm: z.coerce.boolean().optional(),
  /**
   * How many members may hold this position. **0 means unlimited.**
   *
   * Only ACTIVE members occupy a seat, so a resigned President at INACTIVE
   * does not block appointing the next one.
   *
   * Lowering it below the number already seated is ALLOWED and does not evict
   * anybody: an association that decides on two vice-presidents when it has
   * three must be able to record that intention, and the cap then simply
   * refuses the next one. Refusing the edit instead would leave them unable
   * to express the decision at all.
   */
  maxMembers: z.coerce.number().int().min(0).optional(),
});

/**
 * `status` is absent from create and added here, with DELETED excluded, so a
 * row can only reach DELETED through the DELETE endpoint - never a PATCH that
 * would bypass the soft-delete bookkeeping.
 */
const UpdateTenantAssociationPositionSchema =
  CreateTenantAssociationPositionSchema.partial().extend({
    status: AssociationPositionStatusEnum.exclude(['DELETED']).optional(),
  });

export class CreateTenantAssociationPositionDto extends createZodDto(
  CreateTenantAssociationPositionSchema,
) {}
export class UpdateTenantAssociationPositionDto extends createZodDto(
  UpdateTenantAssociationPositionSchema,
) {}
