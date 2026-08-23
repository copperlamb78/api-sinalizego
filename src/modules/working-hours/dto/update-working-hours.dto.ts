import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkingHourItemDto } from './working-hour-item.dto';

export class UpdateWorkingHoursDto {
  @ApiPropertyOptional({
    description:
      'ID da empresa (opcional para COMPANY_OWNER com única empresa, obrigatório para administradores)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  @IsOptional()
  companyId?: string;

  @ApiProperty({
    description: 'Lista de dias da semana e horários de funcionamento',
    type: [WorkingHourItemDto],
    example: [
      {
        dayOfWeek: 1,
        isClosed: false,
        startTime: '09:00',
        endTime: '19:00',
        lunchStartTime: '12:00',
        lunchEndTime: '13:00',
      },
      {
        dayOfWeek: 2,
        isClosed: false,
        startTime: '09:00',
        endTime: '19:00',
        lunchStartTime: '12:00',
        lunchEndTime: '13:00',
      },
      {
        dayOfWeek: 0,
        isClosed: true,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkingHourItemDto)
  hours: WorkingHourItemDto[];
}
