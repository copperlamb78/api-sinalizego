import { Controller } from '@nestjs/common';

import { Body, Post } from '@nestjs/common';
import { CreatePixTransactionDto } from './dto/transactions-create.dto';
import { ApiOperation, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('pix')
  @ApiOperation({ summary: 'Cria uma transação PIX para reserva de horário' })
  @ApiBody({
    type: CreatePixTransactionDto,
    description: 'Dados necessários para criar uma transação PIX',
  })
  @ApiResponse({
    status: 201,
    description: 'Transação PIX criada com sucesso',
    schema: {
      example: {
        paymentId: 'pay_000000000000',
        totalValue: 52.0,
        qrCodePayload:
          '00020126580014BR.GOV.BCB.PIX0136a1b2c3d4-e5f6-7890-1234-567890abcdef520400005303986540552.005802BR5925NOME DO RECEBEDOR LTDA6007BRASIL62070503***6304A1B2',
        qrCodeImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...',
        expirationDate: '2023-10-27T10:00:00.000Z',
      },
    },
  })
  async createPixTransaction(
    @Body() createPixTransactionDto: CreatePixTransactionDto,
  ) {
    return this.transactionsService.createPixTransaction(
      createPixTransactionDto,
    );
  }
}
