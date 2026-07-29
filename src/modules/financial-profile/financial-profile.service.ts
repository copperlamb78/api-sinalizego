import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasAccountResponse, AsaasService } from 'src/asaas/asaas.service';
import { CreateFinancialProfileDto } from './dto/create-financial-profile.dto';
import { UpdateFinancialProfileDto } from './dto/update-financial-profile.dto';
import {
  AdminFiltersFinancialProfileDto,
  FiltersFinancialProfileDto,
} from './dto/filters-financial-profile.dto';

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

    if (cleanDocument.length === 11) {
      if (!data.birthDate) {
        throw new BadRequestException(
          'Data de nascimento é obrigatória para CPF',
        );
      }

      if (data.companyType) {
        data.companyType = null;
      }
    } else if (cleanDocument.length === 14) {
      if (!data.companyType) {
        throw new BadRequestException(
          'Tipo da empresa é obrigatório para CNPJ',
        );
      }

      if (data.birthDate) {
        data.birthDate = null;
      }
    }

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

  async getFinancialProfileByUserId(userId: string, id: string) {
    const profile = await this.prisma.financialProfile.findUnique({
      where: { id: id, userId: userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil não encontrado');
    }

    return profile;
  }

  // essa rota vai ser usada apenas pelo INTERNAL_NO_EMPLOYEE
  async getAllFinancialProfilesByUserId(
    userId: string,
    filters?: FiltersFinancialProfileDto,
  ) {
    const whereClause: any = { userId: userId };

    if (filters) {
      if (filters.cpfCnpj) whereClause.cpfCnpj = filters.cpfCnpj;
      if (filters.name) whereClause.name = filters.name;
    }

    const profiles = await this.prisma.financialProfile.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    if (!profiles) {
      throw new NotFoundException('Nenhum perfil encontrado');
    }

    return profiles;
  }

  async getFinancialProfileById(id: string) {
    const profile = await this.prisma.financialProfile.findUnique({
      where: { id: id },
    });

    if (!profile) {
      throw new NotFoundException('Perfil não encontrado');
    }

    const { asaasApiKey, walletId, incomeValue, cpfCnpj, ...safeData } =
      profile;

    return safeData;
  }

  // Permitido apenas para SYESTEM_MANAGERS
  async getAllFinancialProfiles(filters?: AdminFiltersFinancialProfileDto) {
    const whereClause: any = {};

    if (filters) {
      if (filters.cpfCnpj) whereClause.cpfCnpj = filters.cpfCnpj;
      if (filters.name) whereClause.name = filters.name;
      if (filters.userId) whereClause.userId = filters.userId;
      if (filters.address) whereClause.address = filters.address;
    }

    const profiles = await this.prisma.financialProfile.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    if (!profiles) {
      throw new NotFoundException('Nenhum perfil encontrado');
    }
    // aqui vai retornar com todos os dados, pois é uma rota de administração
    return profiles;
  }
  // Rota permitida apenas para INTERNAL_NO_EMPLOYEE
  async deactivateFinancialProfile(id: string, userId: string) {
    const profile = await this.prisma.financialProfile.findUnique({
      where: { id: id, userId: userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil não encontrado');
    }

    if (!profile.isActive) {
      throw new BadRequestException('Perfil já está desativado');
    }

    const updatedProfile = await this.prisma.financialProfile.update({
      where: { id: id },
      data: { isActive: false, disabledAt: new Date() },
    });

    const { asaasApiKey, walletId, incomeValue, ...safeData } = updatedProfile;

    return safeData;
  }
  // Rota permitida apenas para INTERNAL_NO_EMPLOYEE
  async activateFinancialProfile(id: string, userId: string) {
    const profile = await this.prisma.financialProfile.findUnique({
      where: { id: id, userId: userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil não encontrado');
    }

    if (profile.isActive) {
      throw new BadRequestException('Perfil já está ativado');
    }

    const updatedProfile = await this.prisma.financialProfile.update({
      where: { id: id },
      data: { isActive: true, disabledAt: null },
    });

    const { asaasApiKey, walletId, incomeValue, ...safeData } = updatedProfile;

    return safeData;
  }

  async getFinancialProfileBalance(id: string, userId: string) {
    const profile = await this.prisma.financialProfile.findUnique({
      where: { id: id, userId: userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil não encontrado');
    }

    const balance = await this.asaasService.getSubacccountBalance(
      profile.walletId,
      userId,
    );

    return balance;
  }
}
