import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsUUID } from 'class-validator';

export class CreatePixTransactionDto {
  @ApiProperty({
    description: 'ID do cliente no sistema (UUID)',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsUUID()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({
    description: 'ID do cliente no Asaas',
    example: 'cus_000005260178',
  })
  @IsString()
  @IsNotEmpty()
  asaasCustomerId: string;

  @ApiProperty({
    description: 'ID da carteira do barbeiro no Asaas',
    example: 'wal_000005260178',
  })
  @IsString()
  @IsNotEmpty()
  barberWalletId: string;

  @ApiProperty({
    description: 'Valor do depósito/pagamento',
    example: 50.0,
  })
  @IsNumber()
  @IsNotEmpty()
  depositValue: number;

  @ApiProperty({
    description: 'ID do agendamento associado à transação (UUID)',
    example: 'f1e2d3c4-b5a6-0987-6543-210fedcba987',
  })
  @IsUUID()
  @IsNotEmpty()
  appointmentId: string;
}
