import { PartialType } from '@nestjs/swagger';
import { CreateProviderDto } from './providers-create.dto';

export class UpdateProviderDto extends PartialType(CreateProviderDto) {}
