import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { ApptStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class AppointmentsDeactivateDto {
  @ApiProperty({
    example: 'CONFIRMED',
    description: 'Novo status do agendamento',
    enum: ['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELED'],
  })
  @IsNotEmpty({ message: 'O status é obrigatório.' })
  @IsString()
  @IsIn(['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELED'], {
    message:
      'Status inválido. Use PENDING_PAYMENT, CONFIRMED, COMPLETED ou CANCELED.',
  })
  status: ApptStatus;

  @ApiProperty({
    example: false,
    description: 'Define se o agendamento está ativo ou inativo',
  })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
    description: 'Data de desativação (ISO 8601)',
  })
  @IsDateString()
  disabledAt: string;
}
