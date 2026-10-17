import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelAppointmentClientDto {
  @ApiProperty({
    example: 'IMPREVISTO',
    description: 'Motivo selecionado para o cancelamento do agendamento',
  })
  @IsNotEmpty({ message: 'O motivo do cancelamento é obrigatório.' })
  @IsString({ message: 'O motivo deve ser um texto válido.' })
  reason: string;

  @ApiPropertyOptional({
    example: 'Tive uma reunião de trabalho inesperada.',
    description: 'Detalhes adicionais descritos pelo cliente (opcional)',
  })
  @IsOptional()
  @IsString({ message: 'Os detalhes devem ser um texto válido.' })
  @MaxLength(500, {
    message: 'Os detalhes não podem ultrapassar 500 caracteres.',
  })
  details?: string;
}
