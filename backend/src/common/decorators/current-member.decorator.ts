import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { MemberAuthUser } from '../../member-auth/strategies/member-jwt.strategy';

export type { MemberAuthUser };

/** Injects the authenticated member (populated by MemberJwtStrategy). */
export const CurrentMember = createParamDecorator(
  (data: keyof MemberAuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const member: MemberAuthUser = request.user;
    return data ? member?.[data] : member;
  },
);
