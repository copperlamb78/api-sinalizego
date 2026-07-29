import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasAccountResponse, AsaasService } from 'src/asaas/asaas.service';
import { CreateFinancialProfileDto } from './dto/create-financial-profile.dto';

@Injectable()
export class FinancialProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasService: AsaasService,
  ) {}

  async createFinancialProfile(
    data: CreateFinancialProfileDto,
    userId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const cleanDocument = data.cpfCnpj.replace(/\D/g, '');
    const existingDoc = await this.prisma.financialProfile.findUnique({
      where: { cpfCnpj: cleanDocument },
    });
    // verifica se já existe alguma conta com esse documento, caso exista
    // verifica se esse documento está vinculado a esse usuário
    if (existingDoc) {
      if (existingDoc.userId === userId) {
        return {
          ...existingDoc,
          birthDate: existingDoc.birthDate
            ? existingDoc.birthDate.toISOString().split('T')[0]
            : undefined,
          companyType: existingDoc.companyType || undefined,
        };
      } else {
        throw new ConflictException(
          'Este CPF/CNPJ já está vinculado a outra conta no sistema',
        );
      }
    }

    const assasWalletId = await this.asaasService.createSubAccount(data);

    const newProfile = await this.prisma.financialProfile.create({
      data: {
        name: data.name,
        email: data.email,
        cpfCnpj: cleanDocument,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        companyType: data.companyType || null,
        mobilePhone: data.mobilePhone.replace(/\D/g, ''),
        incomeValue: data.incomeValue,
        address: data.address,
        addressNumber: data.addressNumber,
        province: data.province,
        postalCode: data.postalCode.replace(/\D/g, ''),
        walletId: assasWalletId.walletId,
        asaasApiKey: assasWalletId.apiKey || null,
        userId: userId,
      },
    });

    if (user.role !== 'COMPANY_OWNER') {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role: 'COMPANY_OWNER' },
      });
    }

    const { asaasApiKey, walletId, incomeValue, cpfCnpj, ...safeData } =
      newProfile;

    return {
      ...safeData,
      birthDate: safeData.birthDate
        ? safeData.birthDate.toISOString().split('T')[0]
        : undefined,
      companyType: safeData.companyType || undefined,
    };
  }
}
