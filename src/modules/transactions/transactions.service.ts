import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AsaasService } from 'src/asaas/asaas.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asaas: AsaasService,
  ) {}

  async createPixForAppointment(appointmentId: string, userId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        clientId: true,
        status: true,
        expiresAt: true,
        downPaymentAmount: true,
        platformFeeAmount: true,
        company: {
          select: {
            isActive: true,
            financialProfile: {
              select: {
                walletId: true,
              },
            },
          },
        },
        client: {
          select: {
            asaasCustomerId: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    if (!appointment.company?.isActive) {
      throw new BadRequestException(
        'Empresa inativa ou suspensa para recebimento de pagamentos.',
      );
    }

    if (appointment.clientId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para pagar por este agendamento.',
      );
    }

    if (appointment.status !== 'PENDING_PAYMENT') {
      throw new ConflictException('Agendamento não está aguardando pagamento.');
    }

    if (appointment.expiresAt && appointment.expiresAt < new Date()) {
      throw new GoneException('Reserva expirada.');
    }

    const walletId = appointment.company?.financialProfile?.walletId;
    if (!walletId) {
      throw new NotFoundException(
        'Empresa não possui perfil financeiro ou carteira Asaas configurada.',
      );
    }

    const asaasCustomerId = appointment.client?.asaasCustomerId;
    if (!asaasCustomerId) {
      throw new BadRequestException(
        'Cliente não possui cadastro financeiro na Asaas.',
      );
    }

    // Idempotência: se já existe Transaction PENDING para esse appointmentId, devolver o Pix existente
    const existingTransaction = await this.prisma.transaction.findFirst({
      where: {
        appointmentId: appointment.id,
        status: 'PENDING',
      },
    });

    if (existingTransaction && existingTransaction.asaasPaymentId) {
      const qrCodeData = await this.asaas.getPixQrCode(
        existingTransaction.asaasPaymentId,
      );
      return {
        paymentId: existingTransaction.asaasPaymentId,
        totalValue: Number(existingTransaction.totalValue),
        qrCodePayload: qrCodeData.qrCodePayload,
        qrCodeImage: qrCodeData.qrCodeImage,
        expirationDate: qrCodeData.expirationDate,
        barberNetValue: Number(existingTransaction.netValue),
        platformFee: Number(existingTransaction.platformFee),
        asaasFee: Number(existingTransaction.asaasFee),
      };
    }

    const deposit = Number(appointment.downPaymentAmount); // do banco, nunca do body
    const platformFee = Number(appointment.platformFeeAmount); // do banco, nunca do body ou recálculo

    const pixData = await this.asaas.createPixChargeWithSplit(
      asaasCustomerId,
      walletId,
      deposit,
      appointment.id,
      platformFee,
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
        customerId: appointment.clientId,
        barberWalletId: walletId,
        appointmentId: appointment.id,
      },
    });

    return pixData;
  }
}
