import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, IsIn } from 'class-validator';
import { PlatformInvoiceStatus } from '@prisma/client';

export class ListCompanyInvoicesDto {
  @ApiPropertyOptional({ example: 1, description: 'Número da página' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Quantidade de registros por página',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 2026, description: 'Ano de competência' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ example: 9, description: 'Mês de competência (1-12)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({
    enum: [
      'SCHEDULED',
      'SYNCHRONIZED',
      'AUTHORIZED',
      'PROCESSING_CANCELLATION',
      'CANCELED',
      'CANCELLATION_DENIED',
      'ERROR',
    ],
    description: 'Status da NFS-e',
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'SCHEDULED',
    'SYNCHRONIZED',
    'AUTHORIZED',
    'PROCESSING_CANCELLATION',
    'CANCELED',
    'CANCELLATION_DENIED',
    'ERROR',
  ])
  status?: PlatformInvoiceStatus;

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'ID da empresa (opcional para multi-empresa do mesmo dono)',
  })
  @IsOptional()
  @IsString()
  companyId?: string;
}
