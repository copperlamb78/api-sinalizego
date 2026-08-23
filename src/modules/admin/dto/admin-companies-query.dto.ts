import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AdminCompaniesQueryDto {
  @ApiPropertyOptional({
    description: 'Número da página (iniciando em 1)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A página deve ser um número inteiro.' })
  @Min(1, { message: 'A página mínima é 1.' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Quantidade de registros por página',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O limite deve ser um número inteiro.' })
  @Min(1, { message: 'O limite mínimo é 1.' })
  @Max(100, { message: 'O limite máximo é 100.' })
  limit?: number = 10;

  @ApiPropertyOptional({
    description:
      'Termo de busca (filtra por nome do negócio, slug, cidade ou e-mail/nome do proprietário)',
    example: 'Barbearia VIP',
  })
  @IsOptional()
  @IsString({ message: 'O termo de busca deve ser uma string.' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtro por status de atividade da empresa',
    enum: ['ACTIVE', 'INACTIVE', 'ALL'],
    default: 'ALL',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'ALL'], {
    message: 'Status deve ser ACTIVE, INACTIVE ou ALL.',
  })
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL' = 'ALL';
}
