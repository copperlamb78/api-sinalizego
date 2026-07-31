import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AsaasService } from 'src/asaas/asaas.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePixTransactionDto } from './dto/transactions-create.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asaas: AsaasService,
  ) {}

  async createPixTransaction(data: CreatePixTransactionDto) {
    const existingCustomer = await this.prisma.user.findUnique({
      where: { id: data.customerId },
      select: { id: true, asaasCustomerId: true },
    });
    if (!existingCustomer) {
      throw new NotFoundException('Cliente não encontrado');
    }
    if (!existingCustomer.asaasCustomerId) {
      throw new BadRequestException(
        'Cliente não possui cadastro financeiro na Asaas',
      );
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: data.appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    const existingBarber = await this.prisma.financialProfile.findUnique({
      where: { walletId: data.barberWalletId },
    });

    if (!existingBarber) {
      throw new NotFoundException(
        'Barbearia não encontrada ou sem carteira cadastrada.',
      );
    }

    const pixData = await this.asaas.createPixChargeWithSplit(
      data.asaasCustomerId,
      data.barberWalletId,
      data.depositValue,
      data.appointmentId,
    );

    await this.prisma.transaction.create({
      data: {
        asaasPaymentId: pixData.paymentId,
        totalValue: pixData.totalValue,
        netValue: pixData.barberNetValue,
        platformFee: pixData.platformFee,
        asaasFee: pixData.asaasFee,
        status: 'PENDING',
        type: 'DEPOSIT',
        billingType: 'PIX',
        customerId: data.customerId,
        barberWalletId: data.barberWalletId,
        appointmentId: data.appointmentId,
      },
    });

    return pixData;
  }
}
