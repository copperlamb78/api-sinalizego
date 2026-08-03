import { PartialType, PickType } from '@nestjs/swagger';
import { CreateServiceGroupDto } from './create-service-group.dto';

export class UpdateServiceGroupDto extends PartialType(
  PickType(CreateServiceGroupDto, ['name', 'capacity']),
) {}
