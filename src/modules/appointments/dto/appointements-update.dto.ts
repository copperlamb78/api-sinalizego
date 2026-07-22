import { PickType } from '@nestjs/swagger';
import { AppointmentsDeactivateDto } from './appointments-deactivate.dto';

export class AppointmentsStatusUpdateDto extends PickType(AppointmentsDeactivateDto, [
  'status',
] as const) {}
