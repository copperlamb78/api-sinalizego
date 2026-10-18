import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    description: 'ID do agendamento concluído (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'O ID do agendamento é obrigatório' })
  @IsUUID('4', { message: 'appointmentId deve ser um UUID válido' })
  appointmentId: string;

  @ApiProperty({
    description: 'Nota de 1 a 5 para a empresa/estabelecimento',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsNotEmpty({ message: 'A nota da empresa é obrigatória' })
  @IsInt({ message: 'A nota deve ser um número inteiro' })
  @Min(1, { message: 'A nota mínima é 1' })
  @Max(5, { message: 'A nota máxima é 5' })
  ratingCompany: number;

  @ApiPropertyOptional({
    description: 'Nota de 1 a 5 para o funcionário/profissional que realizou o atendimento',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt({ message: 'A nota deve ser um número inteiro' })
  @Min(1, { message: 'A nota mínima é 1' })
  @Max(5, { message: 'A nota máxima é 5' })
  ratingEmployee?: number;

  @ApiPropertyOptional({
    description: 'Comentário ou depoimento opcional sobre o atendimento',
    example: 'Excelente atendimento, corte impecável!',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
