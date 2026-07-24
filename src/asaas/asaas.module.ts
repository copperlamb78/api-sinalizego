import { Module } from '@nestjs/common';
import { AsaasService } from './asaas.service';

@Module({
  providers: [AsaasService]
})
export class AsaasModule {}
