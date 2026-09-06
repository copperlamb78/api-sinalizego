import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CompanyModule } from '../company/company.module';
import { FeesModule } from '../fees/fees.module';
import { FoundersController } from './founders.controller';
import { FoundersService } from './founders.service';

@Module({
  imports: [PrismaModule, CompanyModule, FeesModule],
  providers: [FoundersService],
  controllers: [FoundersController],
  exports: [FoundersService],
})
export class FoundersModule {}
