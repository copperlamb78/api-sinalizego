import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FeesModule } from '../fees/fees.module';
import { MailModule } from '../mail/mail.module';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [PrismaModule, FeesModule, MailModule],
  providers: [ReferralsService],
  controllers: [ReferralsController],
  exports: [ReferralsService],
})
export class ReferralsModule {}
