import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Token JWT de recuperação recebido por e-mail',
  })
  @IsString({ message: 'O token deve ser uma string.' })
  @IsNotEmpty({ message: 'O token de recuperação é obrigatório.' })
  token: string;

  @ApiProperty({
    example: 'novaSenhaForte123',
    description: 'Nova senha do usuário (mínimo de 6 caracteres)',
  })
  @IsString({ message: 'A nova senha deve ser uma string.' })
  @IsNotEmpty({ message: 'A nova senha é obrigatória.' })
  @MinLength(6, { message: 'A nova senha deve ter no mínimo 6 caracteres.' })
  newPassword: string;
}
