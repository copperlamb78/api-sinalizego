import { Module } from '@nestjs/common';
import { FinancialProfileService } from './financial-profile.service';
import { FinancialProfileController } from './financial-profile.controller';
import { AsaasModule } from 'src/asaas/asaas.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [AsaasModule, PrismaModule],
  providers: [FinancialProfileService],
  controllers: [FinancialProfileController],
  exports: [FinancialProfileService],
})
export class FinancialProfileModule {}
