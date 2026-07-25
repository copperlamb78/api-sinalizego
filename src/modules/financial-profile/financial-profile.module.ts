import { Module } from '@nestjs/common';
import { FinancialProfileService } from './financial-profile.service';
import { FinancialProfileController } from './financial-profile.controller';

@Module({
  providers: [FinancialProfileService],
  controllers: [FinancialProfileController]
})
export class FinancialProfileModule {}
