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

  @ApiPropertyOptional({
    example: 'joao.login@barbeariadojoao.com',
    description: 'E-mail utilizado para login',
  })
  @IsEmail()
  @IsOptional()
  loginEmail?: string;

  @ApiProperty({
    example: '12345678909',
    description: 'CPF (11 dígitos) ou CNPJ (14 dígitos) sem pontuação',
  })
  @IsString()
  document: string;

  @ApiPropertyOptional({
    example: '1990-05-15',
    description:
      'Data de nascimento no formato YYYY-MM-DD (obrigatório para Pessoa Física)',
  })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({
    example: 'MEI',
    enum: ['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION'],
    description: 'Tipo de empresa (obrigatório se for Pessoa Jurídica)',
  })
  @IsIn(['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION'])
  @IsOptional()
  companyType?: string;

  @ApiPropertyOptional({
    example: '7533334444',
    description: 'Telefone fixo com DDD (somente números)',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    example: '75999998888',
    description: 'Celular / WhatsApp com DDD (somente números)',
  })
  @IsString()
  mobilePhone: string;

  @ApiPropertyOptional({
    example: 'https://barbeariadojoao.com.br',
    description: 'Website oficial da empresa',
  })
  @IsString()
  @IsOptional()
  site?: string;

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

  @ApiPropertyOptional({
    example: 'Sala 204, Bloco B',
    description: 'Complemento do endereço',
  })
  @IsString()
  @IsOptional()
  complement?: string;

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
