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
import { FeesService } from '../fees/fees.service';
import { BARBER_ASAAS_PIX_FEE } from 'src/common/constants/billing.constant';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asaas: AsaasService,
    private readonly feesService: FeesService,
  ) {}

  async createPixForAppointment(appointmentId: string, userId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        companyId: true,
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
      try {
        const qrCodeData = await this.asaas.getPixQrCode(
          existingTransaction.asaasPaymentId,
        );
        return {
          paymentId: existingTransaction.asaasPaymentId,
          totalValue: Number(existingTransaction.totalValue),
          qrCodePayload: qrCodeData.qrCodePayload,
          qrCodeImage: qrCodeData.qrCodeImage,
          expirationDate: appointment.expiresAt ?? qrCodeData.expirationDate,
          barberNetValue: Number(existingTransaction.netValue),
          platformFee: Number(existingTransaction.platformFee),
          asaasFee: Number(existingTransaction.asaasFee),
        };
      } catch (err: any) {
        // Se a cobrança não puder mais ser paga, verifica se já foi liquidada/recebida no Asaas
        try {
          const paymentData = await this.asaas.getPaymentById(
            existingTransaction.asaasPaymentId,
          );
          if (
            paymentData?.status === 'RECEIVED' ||
            paymentData?.status === 'CONFIRMED' ||
            paymentData?.status === 'RECEIVED_IN_CASH'
          ) {
            await this.prisma.$transaction([
              this.prisma.transaction.update({
                where: { id: existingTransaction.id },
                data: { status: 'CONFIRMED' },
              }),
              this.prisma.appointment.update({
                where: { id: appointment.id },
                data: { status: 'CONFIRMED' },
              }),
            ]);
            throw new ConflictException(
              'Este agendamento já foi pago e confirmado com sucesso!',
            );
          }
        } catch (innerErr) {
          if (innerErr instanceof ConflictException) throw innerErr;
        }
        throw err;
      }
    }

    const deposit = Number(appointment.downPaymentAmount); // do banco, nunca do body
    const platformFee = Number(appointment.platformFeeAmount); // do banco, nunca do body ou recálculo

    const effectiveFeeResult = await this.feesService.getEffectiveBarberFee(
      appointment.companyId,
    );

    const pixData = await this.asaas.createPixChargeWithSplit(
      asaasCustomerId,
      walletId,
      deposit,
      appointment.id,
      platformFee,
      effectiveFeeResult.fee,
    );

    const barberFeeApplied = pixData.barberFeeApplied ?? effectiveFeeResult.fee;
    const promoSubsidy = Number(
      Math.max(0, BARBER_ASAAS_PIX_FEE - barberFeeApplied).toFixed(2),
    );

    await this.prisma.transaction.create({
      data: {
        asaasPaymentId: pixData.paymentId,
        totalValue: pixData.totalValue,
        netValue: pixData.barberNetValue,
        platformFee: pixData.platformFee,
        asaasFee: pixData.asaasFee,
        barberFeeApplied: barberFeeApplied,
        promoSubsidy: promoSubsidy > 0 ? promoSubsidy : 0,
        feeOverrideId: effectiveFeeResult.overrideId,
        status: 'PENDING',
        type: 'DEPOSIT',
        billingType: 'PIX',
        customerId: appointment.clientId,
        barberWalletId: walletId,
        appointmentId: appointment.id,
      },
    });

    return {
      ...pixData,
      expirationDate: appointment.expiresAt ?? pixData.expirationDate,
    };
  }
}
