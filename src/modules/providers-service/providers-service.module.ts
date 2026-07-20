import { Module } from '@nestjs/common';
import { ProvidersServiceService } from './providers-service.service';
import { ProvidersServiceController } from './providers-service.controller';
import { CalculateTax } from './helpers/calculate-tax.helper';

@Module({
  providers: [ProvidersServiceService, CalculateTax],
  controllers: [ProvidersServiceController],
})
export class ProvidersServiceModule {}
