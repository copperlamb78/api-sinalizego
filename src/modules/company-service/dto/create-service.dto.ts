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

  @ApiProperty({
    example: 50,
    description:
      'Porcentagem mínima do valor do sinal (depósito) - exclusivamente 25% ou 50%',
    enum: [25, 50],
  })
  @IsInt({ message: 'A porcentagem de sinal deve ser um número inteiro' })
  @IsIn([25, 50], {
    message: 'A porcentagem de sinal deve ser exclusivamente 25% ou 50%',
  })
  downPaymentPercent: number;

  @ApiProperty({
    example: 'd9b2b63d-a233-4123-8478-831d12345678',
    description: 'ID do grupo de serviços (ServiceGroup) associado',
  })
  @IsUUID('4', { message: 'O ID do grupo de serviços deve ser um UUID válido' })
  @IsNotEmpty({ message: 'O ID do grupo de serviços é obrigatório' })
  serviceGroupId: string;
}
