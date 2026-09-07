import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePixKeyDto {
  @ApiProperty({
    example: '11999999999',
    description: 'Chave Pix (CPF, CNPJ, e-mail, telefone ou chave aleatória EVP)',
  })
  @IsNotEmpty({ message: 'A chave Pix é obrigatória' })
  @IsString({ message: 'A chave Pix deve ser uma string' })
  key: string;

  @ApiProperty({
    example: 'PHONE',
    enum: ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'],
    description: 'Tipo da chave Pix cadastrada',
  })
  @IsNotEmpty({ message: 'O tipo da chave Pix é obrigatório' })
  @IsIn(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'], {
    message: 'Tipo de chave Pix inválido. Use CPF, CNPJ, EMAIL, PHONE ou EVP.',
  })
  type: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';

  @ApiPropertyOptional({
    example: true,
    description: 'Indica se esta chave deve ser definida como principal para saques',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isDefault deve ser um valor booleano' })
  isDefault?: boolean;
}
