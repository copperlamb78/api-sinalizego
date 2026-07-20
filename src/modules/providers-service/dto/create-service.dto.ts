import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsInt,
  IsOptional, // <-- Adicionado
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty({
    example: 'Corte de Cabelo Masculino',
    description: 'Nome do serviço oferecido',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  // 👇 Ajustado para ser opcional, igual ao Prisma
  @ApiPropertyOptional({
    example: 'Corte com tesoura e máquina, incluindo lavagem.',
    description: 'Descrição detalhada do serviço',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 60, description: 'Duração do serviço em minutos' })
  @IsInt()
  @Min(1)
  durationMinutes: number;

  @ApiProperty({ example: 50.0, description: 'Preço do serviço' })
  @IsNumber()
  @Min(0)
  totalPrice: number;

  @ApiProperty({
    example: 50,
    description: 'Porcentagem do valor do sinal (depósito)',
  })
  @IsInt()
  @Min(0)
  @Max(50)
  downPaymentPercent: number;

  @ApiProperty({
    example: 1,
    description: 'Quantidade de cadeiras disponíveis para o serviço',
  })
  @IsInt()
  @Min(1)
  availableEmployers: number;
}
