import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import {
  CreateCompanyDto,
  CreateCompanyWithoutUserDto,
} from './dto/company-create.dto';
import { SlugHelper } from './helpers/create-slug.helper';
import { UpdateCompanyDto } from './dto/company-update.dto';
import { FilterCompanyDto } from './dto/company-filter.dto';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slugHelper: SlugHelper,
    private readonly authService: AuthService,
  ) {}

  async createCompanyWithUser(data: CreateCompanyDto) {
    if (await this.prisma.user.findUnique({ where: { email: data.email } })) {
      throw new ConflictException('O e-mail já está em uso');
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const slug = await this.slugHelper.createSlug(data.businessName);

    const companyUser = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: hashedPassword,
        role: 'COMPANY_OWNER',

        companies: {
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
        companies: true,
      },
    });

    const { password, ...companyUserWithoutPassword } = companyUser;

    const tokens = await this.authService.getTokens(
      companyUser.id,
      companyUser.email,
      'COMPANY_OWNER',
    );
    await this.authService.updateRefreshTokenHash(
      companyUser.id,
      tokens.refreshToken,
    );

    return {
      message: 'Empresa criada com sucesso',
      user: companyUserWithoutPassword,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    };
  }

  async createCompany(data: CreateCompanyWithoutUserDto, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const slug = await this.slugHelper.createSlug(data.businessName);

    const company = await this.prisma.company.create({
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

    if (user.role !== 'COMPANY_OWNER') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { role: 'COMPANY_OWNER' },
      });
    }

    const tokens = await this.authService.getTokens(
      user.id,
      user.email,
      'COMPANY_OWNER',
    );
    await this.authService.updateRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      message: 'Empresa criada com sucesso',
      user: company,
      company: company,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    };
  }

  async getCompanyByCompanyId(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Nenhuma empresa encontrada para este ID.');
    }
    return company;
  }

  async getCompanyByUserId(userId: string) {
    const company = await this.prisma.company.findFirst({
      where: { userId: userId },
    });

    if (!company) {
      throw new NotFoundException(
        'Nenhuma empresa encontrada para este usuário.',
      );
    }
    return company;
  }

  async getAllCompaniesByUserId(userId: string, filters?: FilterCompanyDto) {
    const whereClause: any = { userId: userId };
    let orderByClause: any = { createdAt: 'desc' };
    if (filters) {
      if (filters.businessName) whereClause.businessName = filters.businessName;
      if (filters.providerType) whereClause.providerType = filters.providerType;
      if (filters.orderBy) {
        orderByClause = { createdAt: filters.orderBy };
      }
    }

    const companies = await this.prisma.company.findMany({
      where: whereClause,
      orderBy: orderByClause,
    });

    if (!companies) {
      throw new NotFoundException(
        'Nenhuma empresa encontrada para este usuário.',
      );
    }

    return companies;
  }

  async getAllCompanies() {
    const companies = await this.prisma.company.findMany();

    if (!companies) {
      throw new NotFoundException('Nenhuma empresa encontrada.');
    }
    return companies;
  }

  async findBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({
      where: { slug: slug, isActive: true },
      select: {
        id: true,
        businessName: true,
        slug: true,
        providerType: true,
        whatsapp: true,
        chairsCount: true,
        district: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        number: true,
        logoPhoto: true,
        bannerPhoto: true,
        timezone: true,
        createdAt: true,
        workingHours: {
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            lunchStartTime: true,
            lunchEndTime: true,
            isClosed: true,
          },
          orderBy: {
            dayOfWeek: 'asc',
          },
        },
        serviceGroups: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            capacity: true,
            services: {
              where: {
                isActive: true,
              },
              select: {
                id: true,
                name: true,
                description: true,
                durationMinutes: true,
                totalPrice: true,
                downPaymentPercent: true,
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Estabelecimento não encontrado.');
    }

    return company;
  }

  async getCompanyBySlug(slug: string) {
    return this.findBySlug(slug);
  }

  async updateCompany(
    userId: string,
    companyId: string,
    data: UpdateCompanyDto,
  ) {
    const companyExists = await this.prisma.company.findFirst({
      where: { userId: userId, id: companyId },
    });

    if (!companyExists) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    return this.prisma.company.update({
      where: { id: companyExists.id },
      data: data,
    });
  }

  async deactivateCompany(userId: string, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { userId: userId, id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    const updatedCompany = await this.prisma.company.update({
      where: { id: company.id },
      data: { isActive: false, disabledAt: new Date() },
    });

    return updatedCompany;
  }

  async activateCompany(userId: string, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { userId: userId, id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    const updatedCompany = await this.prisma.company.update({
      where: { id: company.id },
      data: { isActive: true, disabledAt: null },
    });

    return updatedCompany;
  }
}
