import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { SlugHelper } from './helpers/create-slug.helper';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [CompanyService, SlugHelper],
  controllers: [CompanyController],
  exports: [CompanyService],
})
export class CompanyModule {}
