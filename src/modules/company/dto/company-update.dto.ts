import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateCompanyDto } from './company-create.dto';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {
  @ApiProperty({
    example: 'default',
    description: 'Paleta visual de cores da empresa',
    required: false,
    enum: ['default', 'emerald', 'rose', 'amber', 'graphite'],
  })
  @IsOptional()
  @IsString({ message: 'A paleta deve ser uma string válida' })
  @IsIn(['default', 'emerald', 'rose', 'amber', 'graphite'], {
    message: 'Paleta visual inválida.',
  })
  themePalette?: string;
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
