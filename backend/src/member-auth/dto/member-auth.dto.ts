import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Members sign in with their MEMBERSHIP NUMBER, not an email.
 *
 * It is already unique per business and already the member's identifier, so
 * it needs no new constraint - and the business comes from the hostname, so
 * the number only has to be unique within it. Email would have needed a
 * unique index that two members sharing a family address would fail.
 */
const MemberLoginSchema = z.object({
  memberIdNumber: z.string().min(1).max(20),
  password: z.string().min(1).max(128),
});

const MemberChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export class MemberLoginDto extends createZodDto(MemberLoginSchema) {}
export class MemberChangePasswordDto extends createZodDto(MemberChangePasswordSchema) {}
