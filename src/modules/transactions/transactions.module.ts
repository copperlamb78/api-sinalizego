import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { AsaasService } from 'src/asaas/asaas.service';
import { CalculateTax } from 'src/helpers/calculate-tax.helper';

@Module({
  providers: [TransactionsService, AsaasService, CalculateTax],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
