import { ApiProperty } from '@nestjs/swagger';
import { ApptStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class AppointmentsStatusUpdateDto {
  @ApiProperty({
    example: 'COMPLETED',
    description: 'Novo status do agendamento (COMPLETED ou CANCELED)',
    enum: ApptStatus,
  })
  @IsNotEmpty({ message: 'O status é obrigatório.' })
  @IsEnum(ApptStatus, {
    message: 'Status inválido. Use COMPLETED ou CANCELED.',
  })
  status: ApptStatus;
}
