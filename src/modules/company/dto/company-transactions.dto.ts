import {
  IsOptional,
  IsString,
  IsIn,
  IsDateString,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType, TransactionStatus } from '@prisma/client';

export class CompanyTransactionsDto {
  @ApiPropertyOptional({ description: 'Número da página', example: 1 })
  @IsOptional()
  page?: number | string;

  @ApiPropertyOptional({ description: 'Itens por página', example: 20 })
  @IsOptional()
  limit?: number | string;

  @ApiPropertyOptional({
    description: 'Tipo de transação',
    enum: TransactionType,
  })
  @IsOptional()
  @IsString()
  @IsIn([TransactionType.DEPOSIT, TransactionType.WITHDRAWAL], {
    message: 'Tipo deve ser DEPOSIT ou WITHDRAWAL',
  })
  type?: TransactionType;

  @ApiPropertyOptional({
    description: 'Status da transação',
    enum: TransactionStatus,
  })
  @IsOptional()
  @IsString()
  status?: TransactionStatus;

  @ApiPropertyOptional({
    description: 'Data de início (YYYY-MM-DD)',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate deve estar no formato YYYY-MM-DD',
  })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Data de término (YYYY-MM-DD)',
    example: '2026-09-30',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate deve estar no formato YYYY-MM-DD',
  })
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por empresa específica do dono (opcional)',
  })
  @IsOptional()
  @IsString()
  companyId?: string;
}
