import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({
    description: 'Nome completo do funcionário',
    example: 'Carlos Silva',
  })
  @IsNotEmpty({ message: 'O nome do funcionário é obrigatório' })
  @IsString({ message: 'O nome deve ser uma string' })
  name: string;

  @ApiPropertyOptional({
    description: 'Cargo, especialidade ou função',
    example: 'Barbeiro Sênior',
  })
  @IsOptional()
  @IsString()
  roleTitle?: string;

  @ApiPropertyOptional({
    description: 'E-mail de contato',
    example: 'carlos.silva@exemplo.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Telefone ou WhatsApp',
    example: '(11) 98765-4321',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'URL da foto de perfil',
    example: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg',
  })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({
    description: 'IDs dos grupos de serviço aos quais o funcionário pertence',
    type: [String],
    example: ['123e4567-e89b-12d3-a456-426614174000'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupIds?: string[];

  @ApiPropertyOptional({
    description: 'IDs dos serviços que o funcionário está habilitado a executar',
    type: [String],
    example: ['123e4567-e89b-12d3-a456-426614174001'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceIds?: string[];
}
