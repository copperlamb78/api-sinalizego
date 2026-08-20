import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'João Silva Atualizado',
    description: 'Nome do usuário',
    type: String,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: '5561999999999',
    description: 'Número de telefone do usuário (com DDD)',
    type: String,
  })
  @IsOptional()
  @IsString()
  @MinLength(11, { message: 'O telefone deve ter no mínimo 11 caracteres' })
  @MaxLength(15, { message: 'O telefone deve ter no máximo 15 caracteres' })
  phone?: string;
}
