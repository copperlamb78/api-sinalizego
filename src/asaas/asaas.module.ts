import { Module } from '@nestjs/common';
import { AsaasService } from './asaas.service';
import { AsaasController } from './asaas.controller';

@Module({
  providers: [AsaasService],
  exports: [AsaasService],
  controllers: [AsaasController],
})
export class AsaasModule {}
