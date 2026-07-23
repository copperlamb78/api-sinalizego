import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateProviderDto } from './providers-create.dto';
import { IsOptional, IsUrl } from 'class-validator';

export class UpdateProviderDto extends PartialType(CreateProviderDto) {
  @ApiProperty({
    example:
      'https://res.cloudinary.com/sinalizego/image/upload/v1700000000/sinalizego/providerId/banner/public_id.jpg',
    description: 'URL do banner do negócio',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'A URL do banner é inválida' })
  banner?: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/sinalizego/image/upload/v1700000000/sinalizego/providerId/logo/public_id.jpg',
    description: 'URL da logo do negócio',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'A URL da logo é inválida' })
  logo?: string;
}
