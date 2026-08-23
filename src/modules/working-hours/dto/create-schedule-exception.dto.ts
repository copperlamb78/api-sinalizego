import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateScheduleExceptionDto {
  @ApiPropertyOptional({
    description:
      'ID da empresa (opcional para COMPANY_OWNER com única empresa, obrigatório para administradores)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  @IsOptional()
  companyId?: string;

  @ApiProperty({
    description: 'Data da exceção no formato YYYY-MM-DD',
    example: '2026-12-25',
  })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({
    description:
      'Indica se o estabelecimento estará totalmente fechado nesta data',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isClosed?: boolean;

  @ApiPropertyOptional({
    description:
      'Horário especial de abertura no formato HH:mm (se isClosed for false)',
    example: '10:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime deve estar no formato HH:mm (ex: 10:00)',
  })
  startTime?: string;

  @ApiPropertyOptional({
    description:
      'Horário especial de encerramento no formato HH:mm (se isClosed for false)',
    example: '14:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime deve estar no formato HH:mm (ex: 14:00)',
  })
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Descrição ou motivo da exceção (ex: Feriado de Natal)',
    example: 'Feriado de Natal',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
