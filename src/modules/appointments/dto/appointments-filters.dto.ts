import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, OmitType, PickType } from '@nestjs/swagger';
import { ApptStatus } from '@prisma/client';

export class AppointmentsSuperFiltersDto {
  @ApiPropertyOptional({ example: 'uuid', description: 'ID do prestador' })
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiPropertyOptional({ example: 'uuid', description: 'ID do cliente' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ example: 'uuid', description: 'ID do serviço' })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({
    example: 'CONFIRMED',
    description: 'Novo status do agendamento',
    enum: ['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELED'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELED'], {
    message:
      'Status inválido. Use PENDING_PAYMENT, CONFIRMED, COMPLETED ou CANCELED.',
  })
  status: ApptStatus;

  @ApiPropertyOptional({
    example: '2024-01-01T00:00:00Z',
    description: 'Data de início mínima (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2024-01-31T23:59:59Z',
    description: 'Data de início máxima (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 50.0,
    description: 'Preço mínimo do serviço',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  servicePrice?: number;

  @ApiPropertyOptional({
    example: 10.0,
    description: 'Valor mínimo do adiantamento',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  downPaymentAmount?: number;

  @ApiPropertyOptional({
    example: 5.0,
    description: 'Valor mínimo da taxa da plataforma',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  platformFeeAmount?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Filtrar por agendamentos ativos',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'desc', description: 'Ordem de ordenação' })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'], { message: 'O orderBy deve ser "asc" ou "desc".' })
  orderBy?: 'asc' | 'desc';
}

export class AppointmentsAdminFiltersDto extends OmitType(
  AppointmentsSuperFiltersDto,
  ['platformFeeAmount'] as const,
) {}

export class AppointmentsFiltersDto extends PickType(
  AppointmentsSuperFiltersDto,
  ['serviceId', 'startDate', 'orderBy'] as const,
) {}
