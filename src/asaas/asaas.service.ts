import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  HttpException,
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
export class AsaasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculateTax: CalculateTax,
  ) {}
  private readonly asaasPixFee = Number(process.env.ASAAS_PIX_FEE) || 0.99;
  private readonly apiUrl =
    process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
  private readonly apiKey = process.env.ASAAS_API_KEY;

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
  ) {
    const platformFee =
      await this.calculateTax.calculatePlatformTax(depositValue);

    // O barbeiro sempre paga R$ 0,99 fixo de taxa do gateway Asaas
    const barberAsaasFee = BARBER_ASAAS_PIX_FEE;

    const totalToCharge = Number((depositValue + platformFee).toFixed(2));
    const barberNetValue = Number(
      Math.max(0, depositValue - barberAsaasFee).toFixed(2),
    );

    // Nota: O Asaas cobra R$ 0,99 nos primeiros meses e R$ 1,99 posteriormente.
    // O split fixo transferido para a carteira do barbeiro é garantido em (depositValue - 0.99).
    // Quando o custo do Asaas for R$ 1,99, a plataforma absorve a diferença de R$ 1,00.

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

      const { id: paymentId } = await response.json();

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

      return {
        paymentId: paymentId,
        totalValue: totalToCharge,
        qrCodePayload: payload,
        qrCodeImage: encodedImage,
        expirationDate: expirationDate,
        barberNetValue: barberNetValue,
        platformFee: platformFee,
        asaasFee: barberAsaasFee,
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
}
