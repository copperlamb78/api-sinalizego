import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { AsaasService } from 'src/asaas/asaas.service';

@Module({
  providers: [TransactionsService],
  imports: [AsaasService],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
