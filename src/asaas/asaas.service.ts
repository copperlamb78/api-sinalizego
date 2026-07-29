import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { CreateFinancialProfileDto } from 'src/modules/financial-profile/dto/create-financial-profile.dto';
import 'dotenv/config';

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
}
