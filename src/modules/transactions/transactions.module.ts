import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { AsaasModule } from 'src/asaas/asaas.module';
import { FeesModule } from '../fees/fees.module';

@Module({
  imports: [AsaasModule, FeesModule],
  providers: [TransactionsService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}
