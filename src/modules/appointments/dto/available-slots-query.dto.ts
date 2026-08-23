import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID, Matches } from 'class-validator';

export class AvailableSlotsQueryDto {
  @ApiProperty({
    description: 'ID da empresa (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'companyId deve ser um UUID válido' })
  companyId: string;

  @ApiProperty({
    description: 'ID do serviço a ser agendado (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID('4', { message: 'serviceId deve ser um UUID válido' })
  serviceId: string;

  @ApiProperty({
    description: 'Data da consulta no formato YYYY-MM-DD',
    example: '2026-08-25',
  })
  @IsDateString(
    {},
    { message: 'date deve estar no formato ISO/data (ex: YYYY-MM-DD)' },
  )
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date deve estar estritamente no formato YYYY-MM-DD',
  })
  date: string;
}
