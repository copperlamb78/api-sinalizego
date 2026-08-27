import { Module } from '@nestjs/common';
import { CompanyServiceService } from './company-service.service';
import { CompanyServiceController } from './company-service.controller';
import { CalculateTax } from '../../helpers/calculate-tax.helper';
import { CalculateDeposit } from '../../helpers/calculate-deposit.helper';

@Module({
  providers: [CompanyServiceService, CalculateTax, CalculateDeposit],
  controllers: [CompanyServiceController],
})
export class CompanyServiceModule {}
