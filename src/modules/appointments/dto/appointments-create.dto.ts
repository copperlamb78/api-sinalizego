import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateAppointmentsDto {
  @ApiProperty({
    description: 'ID da empresa / negócio',
    example: 'clsw0s2b0003138mg1wmg1wmg1',
  })
  @IsNotEmpty({ message: 'O ID da empresa é obrigatório' })
  @IsString()
  companyId: string;

  @ApiProperty({
    description: 'ID do serviço escolhido',
    example: 'clsw0s2b0003138mg1wmg1wmg1',
  })
  @IsNotEmpty({ message: 'O ID do serviço é obrigatório' })
  @IsString()
  serviceId: string;

  @ApiProperty({
    description: 'Data e hora de início do agendamento (formato ISO 8601)',
    example: '2026-07-22T14:30:00.000Z',
  })
  @IsNotEmpty({ message: 'A data do agendamento é obrigatória' })
  @IsDateString({}, { message: 'Formato de data inválido. Use ISO 8601.' })
  appointmentDate: string;

  @ApiPropertyOptional({
    description:
      'Porcentagem de sinal escolhida pelo cliente (ex: 25, 50, 75, 100). Sujeita ao mínimo da empresa e à trava de microtransações (R$ 15,00).',
    example: 50,
  })
  @IsOptional()
  @IsInt({ message: 'A porcentagem de sinal deve ser um número inteiro' })
  @Min(1, { message: 'A porcentagem de sinal mínima é 1%' })
  @Max(100, { message: 'A porcentagem de sinal máxima é 100%' })
  downPaymentPercent?: number;
}
