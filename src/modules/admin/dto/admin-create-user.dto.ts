import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AdminCreateUserDto {
  @ApiProperty({
    example: 'Carlos Administrador',
    description: 'Nome completo do usuário',
  })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  name: string;

  @ApiProperty({
    example: 'carlos@sinalizego.com',
    description: 'Endereço de e-mail do usuário',
  })
  @IsEmail({}, { message: 'O formato do e-mail é inválido' })
  email: string;

  @ApiProperty({
    example: '5561999998888',
    description: 'Número de telefone do usuário (com DDD)',
  })
  @IsString()
  @IsNotEmpty({ message: 'O telefone é obrigatório' })
  @MinLength(10, { message: 'O telefone deve ter no mínimo 10 caracteres' })
  @MaxLength(15, { message: 'O telefone deve ter no máximo 15 caracteres' })
  phone: string;

  @ApiProperty({
    enum: Role,
    example: Role.COMPANY_OWNER,
    description: 'Perfil de acesso do usuário no sistema',
  })
  @IsEnum(Role, { message: 'O perfil informado é inválido' })
  role: Role;

  @ApiPropertyOptional({
    example: 'MinhaSenhaForte@2026',
    description:
      'Senha de acesso. Se omitida, uma senha provisória aleatória será gerada e enviada por e-mail com troca obrigatória.',
  })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  password?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Se true, envia os dados de acesso por e-mail (padrão: true)',
  })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}
