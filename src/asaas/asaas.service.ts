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
import { CryptoHelper } from 'src/helpers/crypto.helper';

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
  public gatewayPixCost: number;
  private readonly apiUrl =
    process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
  private readonly apiKey = process.env.ASAAS_API_KEY;

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculateTax: CalculateTax,
  ) {
    this.gatewayPixCost = DEFAULT_ASAAS_GATEWAY_COST;
  }

  async getTransferFee(): Promise<number> {
    try {
      if (!this.apiKey) return 5.0;
      const response = await fetch(`${this.apiUrl}/myAccount/fees`, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        const data = await response.json();
        const fee = data?.transfer?.pix?.feeValue;
        if (
          fee !== undefined &&
          fee !== null &&
          !isNaN(Number(fee)) &&
          Number(fee) >= 0
        ) {
          return Number(fee);
        }
      }
      return 5.0;
    } catch (err: any) {
      this.logger.debug(
        `Falha ao consultar taxas de transferencia no Asaas: ${err?.message || err}`,
      );
      return 5.0; // fallback default
    }
  }

  async fetchAccountFees(): Promise<any> {
    try {
      if (!this.apiKey) return null;
      const response = await fetch(`${this.apiUrl}/myAccount/fees`, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (err: any) {
      this.logger.debug(
        `Falha ao consultar taxas no Asaas: ${err?.message || err}`,
      );
      return null;
    }
  }

  async onModuleInit() {
    if (this.apiKey) {
      try {
        const fees = await this.fetchAccountFees();
        const pixFee = fees?.payment?.pix;
        const dynamicFee =
          pixFee?.fixedFeeValueWithDiscount ??
          pixFee?.fixedFeeValue ??
          pixFee?.minimumFeeValue;

        if (
          dynamicFee !== undefined &&
          dynamicFee !== null &&
          !isNaN(Number(dynamicFee)) &&
          Number(dynamicFee) >= 0
        ) {
          this.gatewayPixCost = Number(dynamicFee);
          this.logger.log(
            `[AsaasService] Custo Pix de referência sincronizado dinamicamente da conta Asaas: R$ ${this.gatewayPixCost.toFixed(2)}`,
          );
          return;
        }
      } catch (err: any) {
        this.logger.debug(
          `Não foi possível obter taxa dinâmica do Asaas: ${err?.message || err}`,
        );
      }
    }

    this.logger.log(
      `[AsaasService] Utilizando custo padrão de fallback para Pix: R$ ${this.gatewayPixCost.toFixed(2)}`,
    );
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
    email?: string,
  ): Promise<AsaasAccountResponse> {
    const contactEmail = email || data.email;
    const payload = {
      name: data.name,
      email: contactEmail,
      cpfCnpj: data.cpfCnpj.replace(/\D/g, ''),
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
          name: 'SinalizeGo Webhook Geral',
          url:
            process.env.ASAAS_WEBHOOK_URL ||
            'https://api.sinalizego.com/webhooks/asaas',
          email: contactEmail,
          enabled: true,
          interrupted: false,
          apiVersion: 3,
          authToken: process.env.ASAAS_WEBHOOK_TOKEN,
          sendType: 'SEQUENTIALLY',
          events: [
            'PAYMENT_CREATED',
            'PAYMENT_AWAITING_RISK_ANALYSIS',
            'PAYMENT_APPROVED_BY_RISK_ANALYSIS',
            'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
            'PAYMENT_AUTHORIZED',
            'PAYMENT_UPDATED',
            'PAYMENT_CONFIRMED',
            'PAYMENT_RECEIVED',
            'PAYMENT_RECEIVED_IN_CASH',
            'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
            'PAYMENT_ANTICIPATED',
            'PAYMENT_OVERDUE',
            'PAYMENT_DELETED',
            'PAYMENT_RESTORED',
            'PAYMENT_REFUNDED',
            'PAYMENT_PARTIALLY_REFUNDED',
            'PAYMENT_REFUND_IN_PROGRESS',
            'PAYMENT_DUNNING_RECEIVED',
            'PAYMENT_CHARGEBACK_REQUESTED',
            'PAYMENT_CHARGEBACK_DISPUTE',
          ],
        },
      ],
    };

    try {
      const response = await fetch(`${this.apiUrl}/accounts`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      const responseData = await response.json();

      if (!response.ok) {
        this.logger.error(
          `[Asaas] Falha ao criar subconta: ${JSON.stringify(responseData)}`,
        );
        throw new BadRequestException(
          'Não foi possível criar a subconta no gateway de pagamentos.',
        );
      }

      return responseData as AsaasAccountResponse;
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Falha na comunicação com a API do Asaas`,
      );
    }
  }

  async listSubAccountById(id: string): Promise<AsaasAccountResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/accounts/${id}`, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(10_000),
      });

      const responseData = await response.json();

      if (!response.ok) {
        this.logger.error(
          `[Asaas] Subconta #${id} não encontrada: ${JSON.stringify(responseData)}`,
        );
        throw new BadRequestException(
          'Subconta não encontrada no gateway de pagamentos.',
        );
      }

      const { apiKey, ...safeSubAccount } = (responseData as any) || {};
      return safeSubAccount as AsaasAccountResponse;
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Falha na comunicação com a API do Asaas`,
      );
    }
  }

  async listAllSubAccounts() {
    try {
      const response = await fetch(`${this.apiUrl}/accounts`, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(10_000),
      });

      const responseData = await response.json();

      if (!response.ok) {
        this.logger.error(
          `[Asaas] Falha ao listar subcontas: ${JSON.stringify(responseData)}`,
        );
        throw new BadRequestException(
          'Não foi possível listar subcontas no gateway de pagamentos.',
        );
      }

      const { cpfCnpj, walletId, incomeValue, ...safeValues } = responseData;

      return safeValues;
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Falha na comunicação com a API do Asaas`,
      );
    }
  }

  async getSubacccountBalance(walletId: string, userId?: string) {
    const whereClause: any = { walletId: walletId };
    if (userId) {
      whereClause.userId = userId;
    }

    const financialProfile = await this.prisma.financialProfile.findFirst({
      where: whereClause,
      select: { asaasApiKey: true },
    });

    if (!financialProfile) {
      throw new NotFoundException('Perfil financeiro não encontrado');
    }

    const encryptedApiKey = financialProfile.asaasApiKey;

    if (!encryptedApiKey) {
      throw new BadRequestException(
        'Asaas API Key não encontrada para este perfil financeiro. Não é possível consultar o saldo.',
      );
    }

    const accountApiKey = CryptoHelper.decrypt(encryptedApiKey);

    try {
      const response = await fetch(`${this.apiUrl}/finance/balance`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          access_token: accountApiKey,
        },
        signal: AbortSignal.timeout(10_000),
      });

      const responseData = await response.json();

      if (!response.ok) {
        this.logger.error(
          `[Asaas] Erro ao buscar saldo da subconta: ${JSON.stringify(responseData)}`,
        );
        throw new BadRequestException(
          'Não foi possível consultar o saldo no gateway de pagamentos.',
        );
      }

      return responseData;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Falha na comunicação com a API do Asaas`,
      );
    }
  }

  /**
   * Realiza transferência de saldo da subconta Asaas para a conta bancária/chave Pix do estabelecimento.
   */
  async transferSubaccountBalance(
    financialProfileId: string,
    value: number,
    options?: {
      isFreeWeekly?: boolean;
      pixAddressKey?: string;
      pixAddressKeyType?: string;
      description?: string;
    },
  ): Promise<any> {
    const financialProfile = await this.prisma.financialProfile.findUnique({
      where: { id: financialProfileId },
      select: { asaasApiKey: true, walletId: true, cpfCnpj: true },
    });

    if (!financialProfile || !financialProfile.asaasApiKey) {
      throw new BadRequestException(
        'Perfil financeiro ou chave Asaas não configurada para transferência.',
      );
    }

    const accountApiKey = CryptoHelper.decrypt(financialProfile.asaasApiKey);

    if (options?.isFreeWeekly) {
      const masterWalletId = process.env.ASAAS_MASTER_WALLET_ID;
      if (masterWalletId) {
        // 1. Transfer to Master Account (Free)
        const hop1Payload = {
          value: Number(value.toFixed(2)),
          walletId: masterWalletId,
          description:
            'Transferência para conta mestre SinalizeGO (subsídio de taxa)',
        };
        const hop1Response = await fetch(`${this.apiUrl}/transfers`, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            access_token: accountApiKey,
          },
          body: JSON.stringify(hop1Payload),
          signal: AbortSignal.timeout(10_000),
        });

        if (!hop1Response.ok) {
          const err = await hop1Response.json();
          this.logger.error(`[Asaas] Erro Hop1: ${JSON.stringify(err)}`);
          throw new BadRequestException(
            'Falha ao processar primeira etapa de transferência no gateway de pagamentos.',
          );
        }

        // 2. Transfer from Master Account to Barber's Pix (Master absorbs the fee)
        const hop2Payload: any = {
          value: Number(value.toFixed(2)),
          description:
            options?.description ||
            'Saque automático semanal gratuito SinalizeGO',
          operationType: 'PIX',
          pixAddressKey: options?.pixAddressKey,
        };
        if (options?.pixAddressKeyType) {
          hop2Payload.pixAddressKeyType = options.pixAddressKeyType;
        }

        const hop2Response = await fetch(`${this.apiUrl}/transfers`, {
          method: 'POST',
          headers: this.headers, // master API key
          body: JSON.stringify(hop2Payload),
          signal: AbortSignal.timeout(10_000),
        });

        if (!hop2Response.ok) {
          const err = await hop2Response.json();
          this.logger.error(`[Asaas] Erro Hop2: ${JSON.stringify(err)}`);
          throw new BadRequestException(
            'Falha ao processar envio de Pix no gateway de pagamentos.',
          );
        }

        return await hop2Response.json();
      }
    }

    const transferPayload: any = {
      value: Number(value.toFixed(2)),
      description:
        options?.description ||
        (options?.isFreeWeekly
          ? 'Saque automático semanal gratuito SinalizeGO'
          : 'Saque avulso sob demanda SinalizeGO'),
    };

    if (options?.pixAddressKey) {
      transferPayload.operationType = 'PIX';
      transferPayload.pixAddressKey = options.pixAddressKey;
      if (options.pixAddressKeyType)
        transferPayload.pixAddressKeyType = options.pixAddressKeyType;
    }

    try {
      const response = await fetch(`${this.apiUrl}/transfers`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          access_token: accountApiKey,
        },
        body: JSON.stringify(transferPayload),
        signal: AbortSignal.timeout(10_000),
      });

      const responseData = await response.json();
      if (!response.ok) {
        this.logger.error(
          `[Asaas] Erro de transferência: ${JSON.stringify(responseData)}`,
        );
        throw new BadRequestException(
          'Falha ao processar transferência no gateway de pagamentos.',
        );
      }

      return responseData;
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Erro ao transferir saldo no Asaas: ${error.message}`);
      throw new InternalServerErrorException(
        `Falha na comunicação com Asaas ao realizar transferência`,
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
    const barberAsaasFee = BARBER_ASAAS_PIX_FEE;

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
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(
          'Erro Asaas ao criar cobrança:',
          typeof errorData === 'object' ? JSON.stringify(errorData) : errorData,
        );
        throw new BadRequestException(
          'Não foi possível gerar a cobrança no gateway de pagamentos.',
        );
      }

      const paymentData = await response.json();
      const paymentId = paymentData.id;

      const pixResponse = await fetch(
        `${this.apiUrl}/payments/${paymentId}/pixQrCode`,
        {
          method: 'GET',
          headers: this.headers,
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!pixResponse.ok) {
        const errorData = await pixResponse.json();
        this.logger.error(
          'Erro Asaas ao obter QR Code:',
          typeof errorData === 'object' ? JSON.stringify(errorData) : errorData,
        );
        throw new BadRequestException(
          'Não foi possível obter o QR Code Pix no gateway de pagamentos.',
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

      // Utiliza a taxa real retornada pelo Asaas se disponível, caso contrário calcula a diferença
      let actualAsaasFee: number;
      if (
        paymentData.fee !== undefined &&
        paymentData.fee !== null &&
        !isNaN(Number(paymentData.fee))
      ) {
        actualAsaasFee = Number(paymentData.fee);
      } else if (
        paymentData.value !== undefined &&
        paymentData.netValue !== undefined
      ) {
        actualAsaasFee = Number(
          (Number(paymentData.value) - Number(paymentData.netValue)).toFixed(2),
        );
      } else {
        actualAsaasFee = this.gatewayPixCost;
      }

      return {
        paymentId: paymentId,
        totalValue: totalToCharge,
        qrCodePayload: payload,
        qrCodeImage: encodedImage,
        expirationDate: expirationDate,
        barberNetValue: barberNetValue,
        platformFee: platformFee,
        asaasFee: actualAsaasFee,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        'Erro ao gerar Pix no Asaas:: ' +
          (typeof (error.response?.data || error.message) === 'object'
            ? JSON.stringify(error.response?.data || error.message)
            : String(error.response?.data || error.message)),
        error.stack,
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
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!pixResponse.ok) {
        const errorData = await pixResponse.json();
        this.logger.error(
          'Erro Asaas ao obter QR Code:',
          typeof errorData === 'object' ? JSON.stringify(errorData) : errorData,
        );
        throw new BadRequestException(
          'Falha ao obter QR Code do Pix no gateway de pagamentos.',
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
      this.logger.error(
        'Erro ao consultar QR Code Pix no Asaas:: ' +
          (typeof (error.response?.data || error.message) === 'object'
            ? JSON.stringify(error.response?.data || error.message)
            : String(error.response?.data || error.message)),
        error.stack,
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
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(
          'Erro Asaas ao criar cliente:',
          typeof errorData === 'object' ? JSON.stringify(errorData) : errorData,
        );
        throw new BadRequestException(
          'Não foi possível cadastrar o cliente no gateway de pagamentos.',
        );
      }
      const { id: customerId } = await response.json();
      return customerId;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        'Erro ao criar cliente no Asaas:: ' +
          (typeof (error.response?.data || error.message) === 'object'
            ? JSON.stringify(error.response?.data || error.message)
            : String(error.response?.data || error.message)),
        error.stack,
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
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(
          'Erro ao cancelar cobrança no Asaas:',
          typeof errorData === 'object'
            ? JSON.stringify(errorData)
            : String(errorData),
        );
        throw new InternalServerErrorException(
          'Erro ao cancelar cobrança no gateway de pagamentos.',
        );
      }

      return true;
    } catch (error: any) {
      this.logger.error(
        'Falha na comunicação com Asaas ao cancelar cobrança:: ' +
          error.message,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Falha na comunicação com Asaas ao cancelar cobrança',
      );
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
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(
          'Erro ao estornar cobrança no Asaas:',
          typeof errorData === 'object'
            ? JSON.stringify(errorData)
            : String(errorData),
        );
        throw new InternalServerErrorException(
          'Erro ao estornar cobrança no gateway de pagamentos.',
        );
      }

      return true;
    } catch (error: any) {
      this.logger.error(
        'Falha na comunicação com Asaas ao estornar cobrança:: ' +
          error.message,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Falha na comunicação com Asaas ao estornar cobrança',
      );
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
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(
          `Erro ao consultar cobrança #${paymentId} no Asaas:`,
          typeof errorData === 'object' ? JSON.stringify(errorData) : errorData,
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
