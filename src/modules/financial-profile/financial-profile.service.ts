import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasService } from 'src/asaas/asaas.service';
import { CreateFinancialProfileDto } from './dto/create-financial-profile.dto';
import { CreatePixKeyDto } from './dto/create-pix-key.dto';
import {
  AdminFiltersFinancialProfileDto,
  FiltersFinancialProfileDto,
} from './dto/filters-financial-profile.dto';
import { FINANCIAL_PROFILE_OWNER_SELECT } from './constants/financial-profile-select.constant';
import { CryptoHelper } from 'src/helpers/crypto.helper';
import { Role } from '@prisma/client';

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
      select: FINANCIAL_PROFILE_OWNER_SELECT,
    });

    if (existingDoc) {
      if (existingDoc.userId === userId) {
        await this.prisma.company.updateMany({
          where: { userId: userId, financialProfileId: null, isActive: true },
          data: { financialProfileId: existingDoc.id },
        });

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

    // CA-07: Herança automática de endereço da empresa ativa caso omitido
    let address = data.address;
    let addressNumber = data.addressNumber;
    let province = data.province;
    let postalCode = data.postalCode;

    if (!address || !addressNumber || !province || !postalCode) {
      const activeCompany = await this.prisma.company.findFirst({
        where: { userId: userId, isActive: true },
      });

      if (activeCompany) {
        address = address || activeCompany.street;
        addressNumber = addressNumber || activeCompany.number;
        province = province || activeCompany.district;
        postalCode = postalCode || activeCompany.zipCode;
      }
    }

    if (!address || !addressNumber || !province || !postalCode) {
      throw new BadRequestException(
        'Endereço completo (logradouro, número, bairro e CEP) é obrigatório para abertura de conta de recebimento.',
      );
    }

    const subAccountPayload = {
      ...data,
      address,
      addressNumber,
      province,
      postalCode,
    };

    const assasWalletId =
      await this.asaasService.createSubAccount(subAccountPayload);

    // Criptografa a chave da subconta Asaas em repouso
    const encryptedApiKey = assasWalletId.apiKey
      ? CryptoHelper.encrypt(assasWalletId.apiKey)
      : null;

    const newProfile = await this.prisma.financialProfile.create({
      data: {
        name: data.name,
        email: data.email,
        cpfCnpj: cleanDocument,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        companyType: data.companyType || null,
        mobilePhone: data.mobilePhone.replace(/\D/g, ''),
        incomeValue: data.incomeValue,
        address: address,
        addressNumber: addressNumber,
        province: province,
        postalCode: postalCode.replace(/\D/g, ''),
        walletId: assasWalletId.walletId,
        pixAddressKey: data.pixAddressKey,
        pixAddressKeyType: data.pixAddressKeyType,
        asaasApiKey: encryptedApiKey,
        userId: userId,
      },
      select: FINANCIAL_PROFILE_OWNER_SELECT,
    });

    // Vincula empresas ativas do usuário ao novo perfil financeiro criado
    await this.prisma.company.updateMany({
      where: { userId: userId, financialProfileId: null, isActive: true },
      data: { financialProfileId: newProfile.id },
    });

    if (user.role !== 'COMPANY_OWNER') {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role: 'COMPANY_OWNER' },
      });
    }

    return {
      ...newProfile,
      birthDate: newProfile.birthDate
        ? newProfile.birthDate.toISOString().split('T')[0]
        : undefined,
      companyType: newProfile.companyType || undefined,
    };
  }

  async getFinancialProfileByUserId(userId: string, id: string) {
    const profile = await this.prisma.financialProfile.findFirst({
      where: { id: id, userId: userId },
      select: FINANCIAL_PROFILE_OWNER_SELECT,
    });

    if (!profile) {
      throw new NotFoundException('Perfil não encontrado');
    }

    return profile;
  }

  // Rota para o dono da conta (INTERNAL_NO_EMPLOYEE)
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
      select: FINANCIAL_PROFILE_OWNER_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    if (!profiles || profiles.length === 0) {
      throw new NotFoundException('Nenhum perfil encontrado');
    }

    return profiles;
  }

  async getFinancialProfileById(
    id: string,
    userId?: string,
    role?: Role | string,
  ) {
    const isSystemManager = role === Role.ADMIN || role === Role.SUPER_ADMIN;

    const profile = isSystemManager
      ? await this.prisma.financialProfile.findUnique({
          where: { id },
          select: FINANCIAL_PROFILE_OWNER_SELECT,
        })
      : userId
        ? await this.prisma.financialProfile.findFirst({
            where: { id, userId, isActive: true },
            select: FINANCIAL_PROFILE_OWNER_SELECT,
          })
        : null;

    if (!profile) {
      throw new NotFoundException('Perfil não encontrado');
    }

    return profile;
  }

  // Permitido apenas para SYSTEM_MANAGERS (nunca retorna asaasApiKey)
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
      select: FINANCIAL_PROFILE_OWNER_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    if (!profiles || profiles.length === 0) {
      throw new NotFoundException('Nenhum perfil encontrado');
    }

    return profiles;
  }

  // Rota permitida apenas para INTERNAL_NO_EMPLOYEE
  async deactivateFinancialProfile(id: string, userId: string) {
    const profile = await this.prisma.financialProfile.findFirst({
      where: { id: id, userId: userId },
      select: FINANCIAL_PROFILE_OWNER_SELECT,
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
      select: FINANCIAL_PROFILE_OWNER_SELECT,
    });

    return updatedProfile;
  }

  // Rota permitida apenas para INTERNAL_NO_EMPLOYEE
  async activateFinancialProfile(id: string, userId: string) {
    const profile = await this.prisma.financialProfile.findFirst({
      where: { id: id, userId: userId },
      select: FINANCIAL_PROFILE_OWNER_SELECT,
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
      select: FINANCIAL_PROFILE_OWNER_SELECT,
    });

    return updatedProfile;
  }

  async getFinancialProfileBalance(id: string, userId: string) {
    const profile = await this.prisma.financialProfile.findFirst({
      where: { id: id, userId: userId },
      select: { walletId: true },
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

  /**
   * Retorna todas as chaves Pix cadastradas no perfil financeiro do usuário logado.
   * Realiza migração transparente caso o perfil possua pixAddressKey mas nenhum registro em PixKey.
   */
  async getPixKeys(userId: string) {
    const profile = await this.prisma.financialProfile.findFirst({
      where: { userId, isActive: true },
      select: { id: true, pixAddressKey: true, pixAddressKeyType: true },
    });

    if (!profile) {
      throw new NotFoundException('Perfil financeiro não encontrado para este usuário.');
    }

    let keys = await this.prisma.pixKey.findMany({
      where: { financialProfileId: profile.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    // Migração suave: se não houver registros em PixKey mas o perfil já possuir pixAddressKey salvo
    if (keys.length === 0 && profile.pixAddressKey && profile.pixAddressKeyType) {
      const migrated = await this.prisma.pixKey.create({
        data: {
          financialProfileId: profile.id,
          key: profile.pixAddressKey,
          type: profile.pixAddressKeyType,
          isDefault: true,
        },
      });
      keys = [migrated];
    }

    return keys.map((k) => ({
      id: k.id,
      key: k.key,
      type: k.type,
      isDefault: k.isDefault,
      createdAt: k.createdAt,
    }));
  }

  /**
   * Cadastra uma nova chave Pix para recebimento de saques no perfil financeiro.
   */
  async addPixKey(userId: string, data: CreatePixKeyDto) {
    const profile = await this.prisma.financialProfile.findFirst({
      where: { userId, isActive: true },
      select: { id: true, pixAddressKey: true },
    });

    if (!profile) {
      throw new NotFoundException('Perfil financeiro não encontrado para este usuário.');
    }

    const cleanKey = data.type === 'PHONE'
      ? data.key.replace(/\D/g, '')
      : data.type === 'CPF' || data.type === 'CNPJ'
        ? data.key.replace(/\D/g, '')
        : data.key.trim();

    const existingKey = await this.prisma.pixKey.findFirst({
      where: {
        financialProfileId: profile.id,
        key: cleanKey,
      },
    });

    if (existingKey) {
      throw new ConflictException('Esta chave Pix já está cadastrada no seu perfil financeiro.');
    }

    const currentKeysCount = await this.prisma.pixKey.count({
      where: { financialProfileId: profile.id },
    });

    const shouldBeDefault = data.isDefault || currentKeysCount === 0;

    if (shouldBeDefault) {
      // Remove o default das outras chaves
      await this.prisma.pixKey.updateMany({
        where: { financialProfileId: profile.id },
        data: { isDefault: false },
      });
    }

    const newPixKey = await this.prisma.pixKey.create({
      data: {
        financialProfileId: profile.id,
        key: cleanKey,
        type: data.type,
        isDefault: shouldBeDefault,
      },
    });

    // Se for a chave padrão, sincroniza com o FinancialProfile para saques imediatos e crons
    if (shouldBeDefault) {
      await this.prisma.financialProfile.update({
        where: { id: profile.id },
        data: {
          pixAddressKey: cleanKey,
          pixAddressKeyType: data.type,
        },
      });
    }

    return {
      id: newPixKey.id,
      key: newPixKey.key,
      type: newPixKey.type,
      isDefault: newPixKey.isDefault,
      createdAt: newPixKey.createdAt,
    };
  }

  /**
   * Remove uma chave Pix cadastrada.
   */
  async deletePixKey(userId: string, pixKeyId: string) {
    const profile = await this.prisma.financialProfile.findFirst({
      where: { userId, isActive: true },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Perfil financeiro não encontrado.');
    }

    const key = await this.prisma.pixKey.findFirst({
      where: { id: pixKeyId, financialProfileId: profile.id },
    });

    if (!key) {
      throw new NotFoundException('Chave Pix não encontrada neste perfil financeiro.');
    }

    await this.prisma.pixKey.delete({
      where: { id: pixKeyId },
    });

    // Se a chave deletada era a chave padrão, promove a próxima chave restante
    if (key.isDefault) {
      const remainingKey = await this.prisma.pixKey.findFirst({
        where: { financialProfileId: profile.id },
        orderBy: { createdAt: 'asc' },
      });

      if (remainingKey) {
        await this.prisma.pixKey.update({
          where: { id: remainingKey.id },
          data: { isDefault: true },
        });

        await this.prisma.financialProfile.update({
          where: { id: profile.id },
          data: {
            pixAddressKey: remainingKey.key,
            pixAddressKeyType: remainingKey.type,
          },
        });
      } else {
        await this.prisma.financialProfile.update({
          where: { id: profile.id },
          data: {
            pixAddressKey: null,
            pixAddressKeyType: null,
          },
        });
      }
    }

    return {
      success: true,
      message: 'Chave Pix removida com sucesso.',
    };
  }

  /**
   * Define uma chave Pix existente como a principal para saques.
   */
  async setDefaultPixKey(userId: string, pixKeyId: string) {
    const profile = await this.prisma.financialProfile.findFirst({
      where: { userId, isActive: true },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Perfil financeiro não encontrado.');
    }

    const key = await this.prisma.pixKey.findFirst({
      where: { id: pixKeyId, financialProfileId: profile.id },
    });

    if (!key) {
      throw new NotFoundException('Chave Pix não encontrada neste perfil financeiro.');
    }

    await this.prisma.pixKey.updateMany({
      where: { financialProfileId: profile.id },
      data: { isDefault: false },
    });

    const updatedKey = await this.prisma.pixKey.update({
      where: { id: pixKeyId },
      data: { isDefault: true },
    });

    await this.prisma.financialProfile.update({
      where: { id: profile.id },
      data: {
        pixAddressKey: updatedKey.key,
        pixAddressKeyType: updatedKey.type,
      },
    });

    return {
      id: updatedKey.id,
      key: updatedKey.key,
      type: updatedKey.type,
      isDefault: updatedKey.isDefault,
      message: 'Chave Pix definida como principal com sucesso.',
    };
  }
}

