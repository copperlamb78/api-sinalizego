import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterProviderDto {
  @ApiPropertyOptional({
    example: 'Barbearia do Zé',
    description: 'Nome do negócio',
  })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiPropertyOptional({
    example: 'Barbearia',
    description: 'Tipo de prestador de serviço',
  })
  @IsOptional()
  @IsString()
  providerType?: string;

  @ApiPropertyOptional({ example: 'desc', description: 'Ordem de ordenação' })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'], { message: 'O orderBy deve ser "asc" ou "desc".' })
  orderBy?: 'asc' | 'desc';
}
