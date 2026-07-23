import { ApiProperty, OmitType } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateProviderDto {
  // --- TELA 1: DADOS DO USUÁRIO ---
  @ApiProperty({ example: 'Carlos Alberto' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'carlos@barbershop.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Senha123!' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '75999999999' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  // --- TELA 2: DADOS DO NEGÓCIO ---
  @ApiProperty({ example: 'Barbearia' })
  @IsString()
  @IsNotEmpty()
  providerType: string;

  @ApiProperty({ example: "Barber's Shop" })
  @IsString()
  @IsNotEmpty()
  businessName: string;

  // --- TELA 3: ENDEREÇO ---
  @ApiProperty({ example: 'Bahia' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ example: 'Feira de Santana' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'SIM' })
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiProperty({ example: 'Artemia Pires Freitas' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ example: '44085370' })
  @IsString()
  @IsNotEmpty()
  zipCode: string;

  @ApiProperty({ example: '123' })
  @IsString()
  @IsNotEmpty()
  number: string;
}

export class CreateProviderWithoutUserDto extends OmitType(CreateProviderDto, [
  'name',
  'email',
]) {}
