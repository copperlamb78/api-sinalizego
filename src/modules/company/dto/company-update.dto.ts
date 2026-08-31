import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateCompanyDto } from './company-create.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {
  @ApiProperty({
    example:
      'https://res.cloudinary.com/sinalizego/image/upload/v1700000000/sinalizego/companyId/banner/public_id.jpg',
    description: 'URL ou Data URL (base64) do banner da empresa',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'O banner deve ser uma string válida' })
  bannerPhoto?: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/sinalizego/image/upload/v1700000000/sinalizego/companyId/logo/public_id.jpg',
    description: 'URL ou Data URL (base64) da logo da empresa',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'A logo deve ser uma string válida' })
  logoPhoto?: string;
}
