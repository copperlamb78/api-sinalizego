import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { SlugHelper } from './helpers/create-slug.helper';
import { AuthModule } from '../auth/auth.module';
import { AsaasModule } from 'src/asaas/asaas.module';

@Module({
  imports: [AuthModule, AsaasModule],
  providers: [CompanyService, SlugHelper],
  controllers: [CompanyController],
  exports: [CompanyService],
})
export class CompanyModule {}

