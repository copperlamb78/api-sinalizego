import { Module } from '@nestjs/common';
import { AsaasService } from './asaas.service';
import { AsaasController } from './asaas.controller';
import { CalculateTax } from 'src/helpers/calculate-tax.helper';

@Module({
  providers: [AsaasService, CalculateTax],
  exports: [AsaasService],
  controllers: [AsaasController],
})
export class AsaasModule {}
