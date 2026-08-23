import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class DashboardMetricsDto {
  @ApiPropertyOptional({
    description: 'Data inicial do período (formato YYYY-MM-DD)',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        'A data inicial deve estar no formato ISO/data válido (YYYY-MM-DD).',
    },
  )
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Data final do período (formato YYYY-MM-DD)',
    example: '2026-08-31',
  })
  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        'A data final deve estar no formato ISO/data válido (YYYY-MM-DD).',
    },
  )
  endDate?: string;

  @ApiPropertyOptional({
    description:
      'ID da empresa (opcional para administradores, ignorado para donos que visualizam sua própria empresa)',
    example: 'clsw0s98x000013z81z8z8z8z',
  })
  @IsOptional()
  @IsUUID('4', {
    message: 'companyId deve ser um UUID válido versão 4.',
  })
  companyId?: string;
}
