import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { SlugHelper } from './helpers/create-slug.helper';

@Module({
  providers: [CompanyService, SlugHelper],
  controllers: [CompanyController],
})
export class CompanyModule {}
