import { PartialType } from '@nestjs/swagger';
import { CreateFinancialProfileDto } from './create-financial-profile.dto';

export class UpdateFinancialProfileDto extends PartialType(
  CreateFinancialProfileDto,
) {}
