import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { newId, now } from '../common/utils/id.util';
import { MemberLoginDto, MemberChangePasswordDto } from './dto/member-auth.dto';
import { MemberJwtPayload } from './strategies/member-jwt.strategy';

export interface MemberAuthTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

/** What the portal shows a member about themselves. */
const PROFILE_SELECT = {
  id: true,
  systemCode: true,
  memberIdNumber: true,
  memberName: true,
  memberNameTamil: true,
  businessName: true,
  businessNameTamil: true,
  phoneNumber: true,
  whatsappNumber: true,
  email: true,
  addressLine1: true,
  addressLine2: true,
  dateOfBirth: true,
  isMarried: true,
  weddingDate: true,
  passportPhotoPath: true,
  status: true,
  createdAt: true,
  // The last four digits only. The number itself never leaves the server,
  // not even to the person it belongs to - this endpoint has no more right
  // to the ciphertext than any other.
  aadhaarLast4: true,
  associationPosition: { select: { positionName: true, positionNameTamil: true } },
  industry: { select: { industryName: true, industryNameTamil: true } },
  state: { select: { stateName: true, stateNameTamil: true } },
  district: { select: { districtName: true, districtNameTamil: true } },
  taluk: { select: { talukName: true, talukNameTamil: true } },
  rto: { select: { rtoName: true, rtoNameTamil: true, rtoCode: true } },
};

@Injectable()
export class MemberAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Signs a member in, scoped to the business the hostname resolved to.
   *
   * The membership number is unique per business, not globally, so the
   * business is part of the lookup rather than an afterthought - without it,
   * TN72001 would be ambiguous across associations.
   */
  async login(tenantBusinessId: string, dto: MemberLoginDto, deviceType: string) {
    const member = await this.prisma.tenantMember.findFirst({
      where: {
        tenantBusinessId,
        memberIdNumber: { equals: dto.memberIdNumber, mode: 'insensitive' },
        status: { not: 'DELETED' },
      },
    });

    // Verified even when there is no member, so a wrong number and a wrong
    // password cost the same time and cannot be told apart by timing.
    const passwordOk =
      member?.passwordHash
        ? await argon2.verify(member.passwordHash, dto.password).catch(() => false)
        : await argon2
            .hash(dto.password, { type: argon2.argon2id })
            .then(() => false)
            .catch(() => false);

    if (!member || !passwordOk) {
      throw new UnauthorizedException('Invalid membership number or password');
    }
    // Deliberately AFTER the password check, so the status of a member is not
    // discoverable by guessing numbers.
    if (member.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        `This membership is ${member.status.toLowerCase()}. Please contact the association.`,
      );
    }

    const tokens = await this.issueTokens(member, deviceType);
    return { member: await this.profile(member.id), ...tokens };
  }

  async refresh(refreshToken: string, deviceType: string) {
    let payload: MemberJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<MemberJwtPayload>(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.tenantMemberRefreshToken.findFirst({
      where: { tenantMemberId: payload.sub, tokenHash, revokedAt: null },
    });
    if (!stored || Number(stored.expiresAt) <= now()) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    const member = await this.prisma.tenantMember.findUnique({ where: { id: payload.sub } });
    if (!member || member.status !== 'ACTIVE' || !member.passwordHash) {
      throw new UnauthorizedException('Member is no longer able to sign in');
    }

    // Rotated: the presented token is revoked as the new one is issued, so a
    // stolen refresh token is good for one use and its reuse is detectable.
    await this.prisma.tenantMemberRefreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: now() },
    });

    const tokens = await this.issueTokens(member, deviceType);
    return { member: await this.profile(member.id), ...tokens };
  }

  async logout(tenantMemberId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.tenantMemberRefreshToken.updateMany({
        where: { tenantMemberId, tokenHash: this.hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: now() },
      });
    } else {
      // No token to identify the session, so end them all rather than
      // silently leaving the member signed in somewhere.
      await this.prisma.tenantMemberRefreshToken.updateMany({
        where: { tenantMemberId, revokedAt: null },
        data: { revokedAt: now() },
      });
    }
    return { success: true };
  }

  /** The member's own record. The only "read a member" the portal has. */
  async profile(tenantMemberId: string) {
    return this.prisma.tenantMember.findUnique({
      where: { id: tenantMemberId },
      select: PROFILE_SELECT,
    });
  }

  async changePassword(tenantMemberId: string, dto: MemberChangePasswordDto) {
    const member = await this.prisma.tenantMember.findUnique({
      where: { id: tenantMemberId },
      select: { passwordHash: true },
    });
    if (!member?.passwordHash) {
      throw new BadRequestException('Portal access is not enabled for this membership');
    }
    const ok = await argon2.verify(member.passwordHash, dto.currentPassword).catch(() => false);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');

    await this.prisma.tenantMember.update({
      where: { id: tenantMemberId },
      data: {
        passwordHash: await argon2.hash(dto.newPassword, { type: argon2.argon2id }),
        updatedAt: now(),
      },
    });
    // Every other session ends: changing a password is how somebody locks out
    // whoever they think is using their account.
    await this.prisma.tenantMemberRefreshToken.updateMany({
      where: { tenantMemberId, revokedAt: null },
      data: { revokedAt: now() },
    });
    return { success: true };
  }

  private async issueTokens(
    member: { id: string; memberIdNumber: string; tenantBusinessId: string },
    deviceType: string,
  ): Promise<MemberAuthTokens> {
    const base = {
      sub: member.id,
      memberIdNumber: member.memberIdNumber,
      tenantBusinessId: member.tenantBusinessId,
    };
    const accessToken = await this.jwt.signAsync(
      { ...base, type: 'access' } satisfies MemberJwtPayload,
      {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { ...base, type: 'refresh' } satisfies MemberJwtPayload,
      {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.prisma.tenantMemberRefreshToken.create({
      data: {
        id: newId(),
        tenantMemberId: member.id,
        // Only the HASH is stored, so a database leak does not hand out live
        // sessions.
        tokenHash: this.hashToken(refreshToken),
        deviceType,
        expiresAt: decoded.exp,
        createdAt: now(),
      },
    });

    return { accessToken, refreshToken, csrfToken: randomBytes(24).toString('hex') };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
