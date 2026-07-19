import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    example: 'João Silva',
    description: 'Nome do usuário',
    type: String,
  })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  name: string;

  @ApiProperty({
    example: 'joao.silva@example.com',
    description: 'Endereço de e-mail do usuário',
    type: String,
  })
  @IsEmail({}, { message: 'O formato do e-mail é inválido' })
  email: string;

  @ApiProperty({
    example: 'senha123',
    description: 'Senha do usuário (mínimo 6 caracteres)',
    type: String,
  })
  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  password: string;

  @ApiProperty({
    example: '5561999999999',
    description: 'Número de telefone do usuário (com DDD)',
    type: String,
  })
  @IsString()
  @IsNotEmpty({ message: 'O telefone é obrigatório' })
  @MinLength(11, { message: 'O telefone deve ter no mínimo 11 caracteres' })
  @MaxLength(15, { message: 'O telefone deve ter no máximo 15 caracteres' })
  phone: string;
}
