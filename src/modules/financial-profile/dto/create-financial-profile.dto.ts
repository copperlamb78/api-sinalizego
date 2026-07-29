import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  IsDateString,
  IsIn,
} from 'class-validator';

export class CreateFinancialProfileDto {
  @ApiProperty({
    example: 'Barbearia do João LTDA',
    description: 'Nome da empresa ou nome completo se pessoa física',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'contato@barbeariadojoao.com',
    description: 'E-mail principal de contato',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '12345678909',
    description: 'CPF (11 dígitos) ou CNPJ (14 dígitos) sem pontuação',
  })
  @IsString()
  cpfCnpj: string;

  @ApiProperty({
    example: '1995-04-12',
    description:
      'Data de nascimento no formato YYYY-MM-DD (somente Pessoa Física)',
  })
  @IsDateString()
  @IsOptional()
  birthDate?: Date;

  @ApiProperty({
    example: 'MEI',
    description: 'Tipo da empresa (somente quando Pessoa Jurídica)',
  })
  @IsString()
  @IsOptional()
  @IsIn(['MEI', 'INDIVIDUAL', 'LIMITED', 'ASSOCIATION'])
  companyType?: string;

  @ApiProperty({
    example: '75999998888',
    description: 'Celular / WhatsApp com DDD (somente números)',
  })
  @IsString()
  mobilePhone: string;

  @ApiProperty({
    example: 5000.0,
    description: 'Renda ou faturamento mensal estimado (R$)',
  })
  @IsNumber()
  incomeValue: number;

  @ApiProperty({
    example: 'Avenida Getúlio Vargas',
    description: 'Logradouro / Nome da rua ou avenida',
  })
  @IsString()
  address: string;

  @ApiProperty({
    example: '1500',
    description: 'Número do endereço',
  })
  @IsString()
  addressNumber: string;

  @ApiProperty({
    example: 'Centro',
    description: 'Bairro',
  })
  @IsString()
  province: string;

  @ApiProperty({
    example: '44001000',
    description: 'CEP sem hífen (8 dígitos)',
  })
  @IsString()
  postalCode: string;
}
