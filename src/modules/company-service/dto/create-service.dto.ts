import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
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

  @ApiPropertyOptional({
    example: 50,
    description:
      'Porcentagem do valor do sinal (depósito) - 50% padrão, ou 30% opcional para serviços de alto valor (>= R$ 400,00)',
    enum: [30, 50],
    default: 50,
  })
  @IsOptional()
  @IsInt({ message: 'A porcentagem de sinal deve ser um número inteiro' })
  @IsIn([30, 50], {
    message: 'A porcentagem de sinal deve ser exclusivamente 30% ou 50%',
  })
  downPaymentPercent?: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Alias para downPaymentPercent (30% ou 50%)',
    enum: [30, 50],
    default: 50,
  })
  @IsOptional()
  @IsInt({ message: 'A porcentagem de sinal deve ser um número inteiro' })
  @IsIn([30, 50], {
    message: 'A porcentagem de sinal deve ser exclusivamente 30% ou 50%',
  })
  depositPercentage?: number;

  @ApiProperty({
    example: 'd9b2b63d-a233-4123-8478-831d12345678',
    description: 'ID do grupo de serviços (ServiceGroup) associado',
  })
  @IsUUID('4', { message: 'O ID do grupo de serviços deve ser um UUID válido' })
  @IsNotEmpty({ message: 'O ID do grupo de serviços é obrigatório' })
  serviceGroupId: string;
}
