import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Member JWT guard, applied explicitly on member-portal routes (which are also
 * marked @Public() to skip the global SYSTEM guard) - so no @Public()
 * short-circuit is needed here.
 *
 * There is no companion permissions guard, and that is deliberate: a member
 * holds no RBAC role. This proves identity only, and every portal endpoint
 * reads the member out of the token rather than a path parameter.
 */
@Injectable()
export class MemberJwtAuthGuard extends AuthGuard('jwt-member') {}
