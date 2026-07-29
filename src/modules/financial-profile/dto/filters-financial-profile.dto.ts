import { ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { CreateFinancialProfileDto } from './create-financial-profile.dto';
import { IsOptional, IsString } from 'class-validator';

export class FiltersFinancialProfileDto extends PartialType(
  PickType(CreateFinancialProfileDto, ['cpfCnpj', 'name'] as const),
) {}

export class AdminFiltersFinancialProfileDto extends FiltersFinancialProfileDto {
  @ApiPropertyOptional({
    example: '1a6d4b6a4er6_va1sf64a',
    description: 'ID do usuário dono do perfil',
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    example: 'Avenida Getúlio Vargas',
    description: 'Logradouro / Nome da rua ou avenida',
  })
  @IsString()
  @IsOptional()
  address?: string;
}
