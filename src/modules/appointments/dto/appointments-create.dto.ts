import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CreateAppointmentsDto {
  @ApiProperty({
    description: 'ID do negócio/barbearia',
    example: 'clsw0s2b0003138mg1wmg1wmg1',
  })
  @IsNotEmpty({ message: 'O ID do negócio é obrigatório' })
  @IsString()
  providerId: string;

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
}
