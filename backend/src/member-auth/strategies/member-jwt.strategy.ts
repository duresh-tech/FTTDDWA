import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface MemberJwtPayload {
  sub: string;
  memberIdNumber: string;
  tenantBusinessId: string;
  type: 'access' | 'refresh';
}

/**
 * Who is calling the member portal.
 *
 * It resolves a MEMBER, and deliberately no permissions: a member holds no
 * RBAC role, so there is nothing to look up and no `MemberPermissionsGuard`
 * to pair this with. Authorisation in the portal is structural instead - every
 * endpoint reads the member out of the token rather than a path parameter, so
 * there is no "read another member" route to get wrong.
 *
 * Re-checked on every request rather than trusted from the token: a member
 * suspended a minute ago must stop being able to read their record now, not
 * when their access token happens to expire.
 */
@Injectable()
export class MemberJwtStrategy extends PassportStrategy(Strategy, 'jwt-member') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: MemberJwtPayload): Promise<MemberAuthUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const member = await this.prisma.tenantMember.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        memberIdNumber: true,
        tenantBusinessId: true,
        status: true,
        passwordHash: true,
      },
    });

    if (!member || member.status !== 'ACTIVE') {
      throw new UnauthorizedException('Member not found or not active');
    }
    // A member whose password was cleared has had portal access withdrawn;
    // an existing token should stop working the moment that happens.
    if (!member.passwordHash) {
      throw new UnauthorizedException('Portal access is not enabled for this member');
    }

    return {
      id: member.id,
      memberIdNumber: member.memberIdNumber,
      tenantBusinessId: member.tenantBusinessId,
    };
  }
}

export interface MemberAuthUser {
  id: string;
  memberIdNumber: string;
  tenantBusinessId: string;
}
