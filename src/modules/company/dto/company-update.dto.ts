import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateCompanyDto } from './company-create.dto';
import { IsOptional, IsUrl } from 'class-validator';

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {
  @ApiProperty({
    example:
      'https://res.cloudinary.com/sinalizego/image/upload/v1700000000/sinalizego/companyId/banner/public_id.jpg',
    description: 'URL do banner da empresa',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'A URL do banner é inválida' })
  banner?: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/sinalizego/image/upload/v1700000000/sinalizego/companyId/logo/public_id.jpg',
    description: 'URL da logo da empresa',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'A URL da logo é inválida' })
  logo?: string;
}
