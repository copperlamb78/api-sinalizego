import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

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
  })
  @IsNotEmpty()
  @IsNumber()
  capacity: number;

  @ApiProperty({
    example: '6e463255-9c3e-47e1-b417-60382e3d2223',
    description: 'ID da empresa à qual este grupo de serviços pertence',
  })
  @IsString()
  @IsNotEmpty()
  companyId: string;
}
