import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class AdminMetricsDto {
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
}
