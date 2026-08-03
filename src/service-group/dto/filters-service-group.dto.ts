import { PartialType, PickType } from '@nestjs/swagger';
import { CreateServiceGroupDto } from './create-service-group.dto';

export class FiltersServiceGroupDto extends PartialType(
  PickType(CreateServiceGroupDto, ['name', 'capacity', 'companyId']),
) {}
