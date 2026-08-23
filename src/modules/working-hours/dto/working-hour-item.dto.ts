import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class WorkingHourItemDto {
  @ApiProperty({
    description: 'Dia da semana (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)',
    example: 1,
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiPropertyOptional({
    description: 'Indica se a empresa estará fechada neste dia',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isClosed?: boolean;

  @ApiPropertyOptional({
    description: 'Horário de abertura no formato HH:mm (obrigatório se aberto)',
    example: '09:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime deve estar no formato HH:mm (ex: 09:00)',
  })
  startTime?: string;

  @ApiPropertyOptional({
    description:
      'Horário de encerramento no formato HH:mm (obrigatório se aberto)',
    example: '18:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime deve estar no formato HH:mm (ex: 18:00)',
  })
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Início do intervalo de almoço no formato HH:mm',
    example: '12:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'lunchStartTime deve estar no formato HH:mm (ex: 12:00)',
  })
  lunchStartTime?: string | null;

  @ApiPropertyOptional({
    description: 'Fim do intervalo de almoço no formato HH:mm',
    example: '13:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'lunchEndTime deve estar no formato HH:mm (ex: 13:00)',
  })
  lunchEndTime?: string | null;
}
