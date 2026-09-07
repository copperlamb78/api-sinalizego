import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AdminUpdateUserDto {
  @ApiPropertyOptional({
    example: 'João Silva Atualizado',
    description: 'Nome completo do usuário',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'O nome deve ter no mínimo 2 caracteres' })
  name?: string;

  @ApiPropertyOptional({
    example: 'joao.novo@example.com',
    description: 'Novo e-mail do usuário',
  })
  @IsOptional()
  @IsEmail({}, { message: 'O formato do e-mail é inválido' })
  email?: string;

  @ApiPropertyOptional({
    example: '5561988887777',
    description: 'Novo telefone do usuário',
  })
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'O telefone deve ter no mínimo 10 caracteres' })
  @MaxLength(15, { message: 'O telefone deve ter no máximo 15 caracteres' })
  phone?: string;

  @ApiPropertyOptional({
    enum: Role,
    example: Role.ADMIN,
    description: 'Novo perfil / nível de permissão do usuário',
  })
  @IsOptional()
  @IsEnum(Role, { message: 'O perfil informado é inválido' })
  role?: Role;

  @ApiPropertyOptional({
    example: true,
    description: 'Status ativo/inativo do usuário',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
