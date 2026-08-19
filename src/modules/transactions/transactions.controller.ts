import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { TransactionsService } from './transactions.service';

@ApiTags('Transações')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('pix/:appointmentId')
  @ApiOperation({
    summary: 'Cria ou recupera a cobrança PIX para reserva de agendamento',
  })
  @ApiParam({
    name: 'appointmentId',
    description: 'ID do agendamento (UUID)',
    example: 'f1e2d3c4-b5a6-0987-6543-210fedcba987',
  })
  @ApiResponse({
    status: 201,
    description: 'Cobrança PIX gerada ou recuperada com sucesso',
    schema: {
      example: {
        paymentId: 'pay_000000000000',
        totalValue: 52.0,
        qrCodePayload:
          '00020126580014BR.GOV.BCB.PIX0136a1b2c3d4-e5f6-7890-1234-567890abcdef520400005303986540552.005802BR5925NOME DO RECEBEDOR LTDA6007BRASIL62070503***6304A1B2',
        qrCodeImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...',
        expirationDate: '2023-10-27T10:00:00.000Z',
        barberNetValue: 49.01,
        platformFee: 2.0,
        asaasFee: 0.99,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'ID inválido (não UUID) ou cliente sem cadastro financeiro' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado para este agendamento' })
  @ApiResponse({ status: 404, description: 'Agendamento ou empresa não encontrada' })
  @ApiResponse({ status: 409, description: 'Agendamento não está aguardando pagamento' })
  @ApiResponse({ status: 410, description: 'Reserva expirada' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async createPix(
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.transactionsService.createPixForAppointment(
      appointmentId,
      userId,
    );
  }
}
