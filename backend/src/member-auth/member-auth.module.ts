import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MemberAuthController } from './member-auth.controller';
import { MemberAuthService } from './member-auth.service';
import { MemberJwtStrategy } from './strategies/member-jwt.strategy';
import { SiteModule } from '../site/site.module';

@Module({
  // SiteModule resolves which association a hostname serves, which is how a
  // membership number - unique per business, not globally - is disambiguated
  // at login.
  imports: [PassportModule.register({}), JwtModule.register({}), SiteModule],
  controllers: [MemberAuthController],
  providers: [MemberAuthService, MemberJwtStrategy],
  exports: [MemberAuthService],
})
export class MemberAuthModule {}
