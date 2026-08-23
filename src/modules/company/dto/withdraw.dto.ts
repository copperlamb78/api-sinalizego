import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class WithdrawDto {
  @ApiPropertyOptional({
    description:
      'Valor desejado para saque avulso em Reais (opcional. Se omitido, saca todo o saldo disponível liberado)',
    example: 100.0,
    minimum: 0.01,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'O valor do saque deve ser um número válido com até 2 casas decimais.',
    },
  )
  @Min(0.01, { message: 'O valor mínimo para solicitação de saque é R$ 0,01.' })
  amount?: number;
}
