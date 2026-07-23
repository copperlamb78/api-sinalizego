import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import {
  CreateProviderDto,
  CreateProviderWithoutUserDto,
} from './dto/providers-create.dto';
import { SlugHelper } from './helpers/create-slug.helper';
import { UpdateProviderDto } from './dto/providers-update.dto';
import { FilterProviderDto } from './dto/providers-filter.dto';

@Injectable()
export class ProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slugHelper: SlugHelper,
  ) {}

  async createProviderWithUser(data: CreateProviderDto) {
    if (await this.prisma.user.findUnique({ where: { email: data.email } })) {
      throw new ConflictException('O e-mail já está em uso');
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const slug = await this.slugHelper.createSlug(data.businessName);

    const providerUser = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: hashedPassword,
        role: 'PROVIDER',

        businesses: {
          create: {
            businessName: data.businessName,
            slug: slug,
            providerType: data.providerType,
            district: data.district,
            street: data.street,
            city: data.city,
            state: data.state,
            zipCode: data.zipCode,
            number: data.number,
            whatsapp: data.phone,
          },
        },
      },
      include: {
        businesses: true,
      },
    });

    const { password, ...providerUserWithoutPassword } = providerUser;

    return {
      message: 'Negócio criado com sucesso',
      user: providerUserWithoutPassword,
    };
  }

  async createProvider(data: CreateProviderWithoutUserDto, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const slug = await this.slugHelper.createSlug(data.businessName);

    const provider = await this.prisma.provider.create({
      data: {
        businessName: data.businessName,
        slug: slug,
        providerType: data.providerType,
        district: data.district,
        street: data.street,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        number: data.number,
        whatsapp: data.phone,
        userId: userId,
      },
    });

    if (user.role !== 'PROVIDER') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { role: 'PROVIDER' },
      });
    }

    return {
      message: 'Negócio criado com sucesso',
      user: provider,
    };
  }

  async getProviderByProviderId(providerId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException('Nenhum negócio encontrado para este ID.');
    }
    return provider;
  }

  async getProviderByUserId(userId: string) {
    const provider = await this.prisma.provider.findFirst({
      where: { userId: userId },
    });

    if (!provider) {
      throw new NotFoundException(
        'Nenhum negócio encontrado para este usuário.',
      );
    }
    return provider;
  }

  async getAllProvidersByUserId(userId: string, filters?: FilterProviderDto) {
    const whereClause: any = { userId: userId };
    let orderByClause: any = { createdAt: 'desc' };
    if (filters) {
      if (filters.businessName) whereClause.businessName = filters.businessName;
      if (filters.providerType) whereClause.providerType = filters.providerType;
      if (filters.orderBy) {
        orderByClause = { createdAt: filters.orderBy };
      }
    }

    const providers = await this.prisma.provider.findMany({
      where: whereClause,
      orderBy: orderByClause,
    });

    return providers;
  }

  async getAllProviders() {
    const providers = await this.prisma.provider.findMany();
    return providers;
  }

  async getProviderBySlug(slug: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { slug: slug },
    });

    return provider;
  }

  async updateProvider(
    userId: string,
    providerId: string,
    data: UpdateProviderDto,
  ) {
    const providerExists = await this.prisma.provider.findFirst({
      where: { userId: userId, id: providerId },
    });

    if (!providerExists) {
      throw new NotFoundException('Negócio não encontrado.');
    }

    return this.prisma.provider.update({
      where: { id: providerExists.id },
      data: data,
    });
  }

  async deactivateProvider(userId: string, providerId: string) {
    const provider = await this.prisma.provider.findFirst({
      where: { userId: userId, id: providerId },
    });

    if (!provider) {
      throw new NotFoundException('Negócio não encontrado.');
    }

    const updatedProvider = await this.prisma.provider.update({
      where: { id: provider.id },
      data: { isActive: false, disabledAt: new Date() },
    });

    return updatedProvider;
  }

  async activateProvider(userId: string, providerId: string) {
    const provider = await this.prisma.provider.findFirst({
      where: { userId: userId, id: providerId },
    });

    if (!provider) {
      throw new NotFoundException('Negócio não encontrado.');
    }

    const updatedProvider = await this.prisma.provider.update({
      where: { id: provider.id },
      data: { isActive: true, disabledAt: null },
    });

    return updatedProvider;
  }
}
