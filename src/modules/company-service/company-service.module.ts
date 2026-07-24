import { Module } from '@nestjs/common';
import { CompanyServiceService } from './company-service.service';
import { CompanyServiceController } from './company-service.controller';
import { CalculateTax } from '../../helpers/calculate-tax.helper';

@Module({
  providers: [CompanyServiceService, CalculateTax],
  controllers: [CompanyServiceController],
})
export class CompanyServiceModule {}
