import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
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
      'CPF ou CNPJ do cliente para emissão de cobrança (necessário caso ainda não informado no perfil)',
    example: '12345678909',
  })
  @IsOptional()
  @IsString()
  cpfCnpj?: string;
}
