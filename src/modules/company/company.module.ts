import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { SlugHelper } from './helpers/create-slug.helper';
import { AuthModule } from '../auth/auth.module';
import { AsaasModule } from 'src/asaas/asaas.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { CalculateTax } from '../../helpers/calculate-tax.helper';
import { CalculateDeposit } from '../../helpers/calculate-deposit.helper';

@Module({
  imports: [AuthModule, AsaasModule, ReferralsModule],
  providers: [CompanyService, SlugHelper, CalculateTax, CalculateDeposit],
  controllers: [CompanyController],
  exports: [CompanyService],
})
export class CompanyModule {}
