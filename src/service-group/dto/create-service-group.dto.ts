import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CreateServiceGroupDto {
  @ApiProperty({
    example: 'Cabeleireiros',
    description: 'Nome do grupo de serviços',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 1,
    description:
      'Quantidade de profissionais disponíveis para o grupo de serviços',
    minimum: 1,
    maximum: 50,
  })
  @IsNotEmpty()
  @IsInt({ message: 'A capacidade deve ser um número inteiro.' })
  @Min(1, { message: 'A capacidade mínima é de 1 profissional.' })
  @Max(50, { message: 'A capacidade máxima é de 50 profissionais.' })
  capacity: number;

  @ApiProperty({
    example: '6e463255-9c3e-47e1-b417-60382e3d2223',
    description: 'ID da empresa à qual este grupo de serviços pertence',
  })
  @IsString()
  @IsNotEmpty()
  companyId: string;
}
