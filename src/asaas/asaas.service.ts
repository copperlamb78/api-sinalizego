import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  HttpException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { CreateFinancialProfileDto } from 'src/modules/financial-profile/dto/create-financial-profile.dto';
import 'dotenv/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { CalculateTax } from 'src/helpers/calculate-tax.helper';
import {
  BARBER_ASAAS_PIX_FEE,
  DEFAULT_ASAAS_GATEWAY_COST,
} from 'src/common/constants/billing.constant';

export interface AsaasAccountResponse {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  birthDate?: string;
  companyType?: string;
  mobilePhone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
  walletId: string;
  apiKey?: string;
  accountNumber?: {
    agency: string;
    account: string;
    accountDigit: string;
  };
}

@Injectable()
export class AsaasService implements OnModuleInit {
  private readonly logger = new Logger(AsaasService.name);
  public readonly asaasPixFee: number;
  private readonly apiUrl =
    process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
  private readonly apiKey = process.env.ASAAS_API_KEY;

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculateTax: CalculateTax,
  ) {
    const rawFee = process.env.ASAAS_PIX_FEE;
    if (rawFee !== undefined && rawFee !== '') {
      const parsed = Number(rawFee);
      this.asaasPixFee =
        !isNaN(parsed) && parsed >= 0 ? parsed : BARBER_ASAAS_PIX_FEE;
    } else {
      this.asaasPixFee = BARBER_ASAAS_PIX_FEE;
    }
  }

  onModuleInit() {
    const rawFee = process.env.ASAAS_PIX_FEE;
    if (rawFee === undefined || rawFee === '') {
      this.logger.warn(
        `[AsaasService] ASAAS_PIX_FEE não definida nas variáveis de ambiente. Utilizando taxa padrão de fallback: R$ ${BARBER_ASAAS_PIX_FEE.toFixed(2)}`,
      );
    } else if (isNaN(Number(rawFee)) || Number(rawFee) < 0) {
      this.logger.error(
        `[AsaasService] ASAAS_PIX_FEE inválida ("${rawFee}"). Utilizando taxa padrão de fallback: R$ ${BARBER_ASAAS_PIX_FEE.toFixed(2)}`,
      );
    } else {
      this.logger.log(
        `[AsaasService] ASAAS_PIX_FEE inicializada com sucesso: R$ ${this.asaasPixFee.toFixed(2)}`,
      );
    }
  }

  private get headers() {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'Chave de API do Asaas (ASAAS_API_KEY) não está configurada.',
      );
    }
    return {
      accept: 'application/json',
      'content-type': 'application/json',
      access_token: this.apiKey,
    };
  }

  /**
   * Cria uma subconta (Conta de Prestador/Empresa) no Asaas
   * Documentação Asaas: POST /v3/accounts
   */
  async createSubAccount(
    data: CreateFinancialProfileDto,
  ): Promise<AsaasAccountResponse> {
    const payload = {
      name: data.name,
      email: data.email,
      cpfCnpj: data.cpfCnpj.replace(/\D/g, ''), // Remove pontuações se houver
      birthDate: data.birthDate || undefined,
      companyType: data.companyType || undefined,
      mobilePhone: data.mobilePhone.replace(/\D/g, ''),
      incomeValue: data.incomeValue,
      address: data.address,
      addressNumber: data.addressNumber,
      province: data.province,
      postalCode: data.postalCode.replace(/\D/g, ''),

      webhooks: [
        {
          name: 'Webhook Plataforma SinalizeGo',
          url: process.env.ASAAS_WEBHOOK_URL,
          email: process.env.ASAAS_WEBHOOK_EMAIL,
          enabled: true,
          interrupted: false,
          apiVersion: 3,
          authToken: process.env.ASAAS_WEBHOOK_TOKEN,
          sendType: 'SEQUENTIALLY',
          events: [
            'PAYMENT_CREATED',
            'PAYMENT_UPDATED',
            'PAYMENT_CONFIRMED',
            'PAYMENT_RECEIVED',
            'PAYMENT_OVERDUE',
            'PAYMENT_DELETED',
            'PAYMENT_REFUNDED',
            'PAYMENT_REFUND_IN_PROGRESS',
            'PAYMENT_DUNNING_RECEIVED',
            'PAYMENT_CHARGEBACK_REQUESTED',
            'PAYMENT_CHARGEBACK_DISPUTE',
            'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
          ],
        },
      ],
    };

    try {
      const response = await fetch(`${this.apiUrl}/accounts`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage =
          responseData?.errors?.[0]?.description ||
          'Erro desconhecido ao criar subconta no Asaas.';
        throw new BadRequestException(`Asaas: ${errorMessage}`);
      }

      return responseData as AsaasAccountResponse;
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Falha na comunicação com a API do Asaas: ${error.message}`,
      );
    }
  }

  async listSubAccountById(id: string): Promise<AsaasAccountResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/accounts/${id}`, {
        method: 'GET',
        headers: this.headers,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage =
          responseData?.errors?.[0]?.description ||
          'Erro desconhecido ao buscar subconta no Asaas.';
        throw new BadRequestException(`Asaas: ${errorMessage}`);
      }

      return responseData as AsaasAccountResponse;
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Falha na comunicação com a API do Asaas: ${error.message}`,
      );
    }
  }

  async listAllSubAccounts() {
    try {
      const response = await fetch(`${this.apiUrl}/accounts`, {
        method: 'GET',
        headers: this.headers,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage =
          responseData?.errors?.[0]?.description ||
          'Erro desconhecido ao listar subcontas no Asaas.';
        throw new BadRequestException(`Asaas: ${errorMessage}`);
      }

      const { cpfCnpj, walletId, incomeValue, ...safeValues } = responseData;

      return safeValues;
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Falha na comunicação com a API do Asaas: ${error.message}`,
      );
    }
  }

  async getSubacccountBalance(walletId: string, userId: string) {
    const financialProfile = await this.prisma.financialProfile.findUnique({
      where: { walletId: walletId, userId: userId },
    });

    if (!financialProfile) {
      throw new NotFoundException('Perfil financeiro não encontrado');
    }

    const accountApiKey = financialProfile.asaasApiKey;

    if (!accountApiKey) {
      throw new BadRequestException(
        'Asaas API Key não encontrada para este perfil financeiro. Não é possível consultar o saldo.',
      );
    }

    try {
      const response = await fetch(`${this.apiUrl}/finance/balance`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          access_token: accountApiKey,
        },
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage =
          responseData?.errors?.[0]?.description ||
          'Erro desconhecido ao buscar saldo da subconta no Asaas.';
        throw new BadRequestException(`Asaas: ${errorMessage}`);
      }

      return responseData;
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Falha na comunicação com a API do Asaas ao buscar saldo: ${error.message}`,
      );
    }
  }

  async createPixChargeWithSplit(
    asaasCustomerId: string,
    barberWalletId: string,
    depositValue: number,
    appointmentId: string,
    persistedPlatformFee?: number,
  ) {
    const platformFee =
      persistedPlatformFee !== undefined
        ? persistedPlatformFee
        : this.calculateTax.calculatePlatformTax(depositValue);

    // O barbeiro paga a taxa configurada do gateway Asaas (ASAAS_PIX_FEE ou BARBER_ASAAS_PIX_FEE)
    const barberAsaasFee = this.asaasPixFee;

    const totalToCharge = Number((depositValue + platformFee).toFixed(2));
    const barberNetValue = Number(
      Math.max(0, depositValue - barberAsaasFee).toFixed(2),
    );

    // Nota: O Asaas cobra a taxa de Pix conforme o plano configurado.
    // O split fixo transferido para a carteira do barbeiro é garantido em (depositValue - barberAsaasFee).

    try {
      const response = await fetch(`${this.apiUrl}/payments`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType: 'PIX',
          value: totalToCharge,
          dueDate: new Date().toISOString().split('T')[0],
          description: `SinalizeGo - Reserva de Horário #${appointmentId}`,
          externalReference: appointmentId,
          split: [
            {
              walletId: barberWalletId,
              fixedValue: Number(barberNetValue.toFixed(2)),
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(errorData);
        throw new BadRequestException(errorData.errors[0].description);
      }

      const paymentData = await response.json();
      const paymentId = paymentData.id;

      const pixResponse = await fetch(
        `${this.apiUrl}/payments/${paymentId}/pixQrCode`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!pixResponse.ok) {
        const errorData = await pixResponse.json();
        console.error(errorData);
        throw new BadRequestException(errorData.errors[0].description);
      }

      const {
        encodedImage,
        payload,
        expirationDate,
      }: {
        encodedImage: string;
        payload: string;
        expirationDate: Date;
      } = await pixResponse.json();

      // Ler a taxa real retornada pelo Asaas (fee ou value - netValue), com fallback para a taxa configurada
      const realAsaasFee =
        paymentData?.fee !== undefined && paymentData?.fee !== null
          ? Number(paymentData.fee)
          : paymentData?.value !== undefined &&
              paymentData?.netValue !== undefined
            ? Number(
                (
                  Number(paymentData.value) - Number(paymentData.netValue)
                ).toFixed(2),
              )
            : barberAsaasFee;

      return {
        paymentId: paymentId,
        totalValue: totalToCharge,
        qrCodePayload: payload,
        qrCodeImage: encodedImage,
        expirationDate: expirationDate,
        barberNetValue: barberNetValue,
        platformFee: platformFee,
        asaasFee: realAsaasFee,
      };
    } catch (error: any) {
      // O error.response?.data ajuda a ver se o Asaas reclamou de algo
      if (error instanceof HttpException) {
        throw error;
      }
      console.error(
        'Erro ao gerar Pix no Asaas:',
        error.response?.data || error.message,
      );
      throw new InternalServerErrorException('Falha ao processar pagamento');
    }
  }

  async getPixQrCode(paymentId: string) {
    try {
      const pixResponse = await fetch(
        `${this.apiUrl}/payments/${paymentId}/pixQrCode`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!pixResponse.ok) {
        const errorData = await pixResponse.json();
        console.error(errorData);
        throw new BadRequestException(
          errorData?.errors?.[0]?.description ||
            'Falha ao obter QR Code do Pix no Asaas.',
        );
      }

      const {
        encodedImage,
        payload,
        expirationDate,
      }: {
        encodedImage: string;
        payload: string;
        expirationDate: Date;
      } = await pixResponse.json();

      return {
        qrCodePayload: payload,
        qrCodeImage: encodedImage,
        expirationDate: expirationDate,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error(
        'Erro ao consultar QR Code Pix no Asaas:',
        error.response?.data || error.message,
      );
      throw new InternalServerErrorException(
        'Falha ao obter QR Code do Pix no Asaas',
      );
    }
  }

  async createCustomer(cpfCnpj: string, name: string) {
    try {
      const response = await fetch(`${this.apiUrl}/customers`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          cpfCnpj: cpfCnpj,
          name: name,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error(errorData);
        throw new BadRequestException(errorData.errors[0].description);
      }
      const { id: customerId } = await response.json();
      return customerId;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error(
        'Erro ao criar cliente no Asaas:',
        error.response?.data || error.message,
      );
      throw new InternalServerErrorException('Falha ao criar cliente no Asaas');
    }
  }

  /**
   * Cancela uma cobrança no Asaas (DELETE /v3/payments/{id})
   */
  async cancelPayment(paymentId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/payments/${paymentId}`, {
        method: 'DELETE',
        headers: this.headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro ao cancelar cobrança no Asaas:', errorData);
        return false;
      }

      return true;
    } catch (error: any) {
      console.error(
        'Falha na comunicação com Asaas ao cancelar cobrança:',
        error.message,
      );
      return false;
    }
  }

  /**
   * Estorna uma cobrança no Asaas (POST /v3/payments/{id}/refund)
   */
  async refundPayment(
    paymentId: string,
    value?: number,
    description?: string,
  ): Promise<boolean> {
    try {
      const payload: { value?: number; description?: string } = {};
      if (value !== undefined) payload.value = value;
      if (description) payload.description = description;

      const response = await fetch(
        `${this.apiUrl}/payments/${paymentId}/refund`,
        {
          method: 'POST',
          headers: this.headers,
          body:
            Object.keys(payload).length > 0
              ? JSON.stringify(payload)
              : undefined,
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro ao estornar cobrança no Asaas:', errorData);
        return false;
      }

      return true;
    } catch (error: any) {
      console.error(
        'Falha na comunicação com Asaas ao estornar cobrança:',
        error.message,
      );
      return false;
    }
  }

  /**
   * Consulta os dados de uma cobrança no Asaas (GET /v3/payments/{id})
   */
  async getPaymentById(paymentId: string): Promise<any | null> {
    try {
      const response = await fetch(`${this.apiUrl}/payments/${paymentId}`, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(
          `Erro ao consultar cobrança #${paymentId} no Asaas:`,
          errorData,
        );
        return null;
      }

      return await response.json();
    } catch (error: any) {
      this.logger.error(
        `Falha na comunicação com Asaas ao consultar cobrança #${paymentId}: ${error.message}`,
      );
      return null;
    }
  }
}
