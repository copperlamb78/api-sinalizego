import { Injectable, NotFoundException } from '@nestjs/common';
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
      where: { id: data.customerId, asaasCustomerId: data.asaasCustomerId },
    });
    if (!existingCustomer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const existingBarber = await this.prisma.financialProfile.findUnique({
      where: { walletId: data.barberWalletId },
    });

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
