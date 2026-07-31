import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateCpfCnpjDto {
  @ApiProperty({
    example: '12345678909',
    description:
      'CPF (11 dígitos) ou CNPJ (14 dígitos) do usuário para cadastro de cliente no Asaas',
  })
  @IsString()
  @IsNotEmpty({ message: 'O CPF/CNPJ é obrigatório.' })
  cpfCnpj: string;
}
