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

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slugHelper: SlugHelper,
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

    return {
      message: 'Empresa criada com sucesso',
      user: companyUserWithoutPassword,
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

    return {
      message: 'Empresa criada com sucesso',
      user: company,
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

  async getCompanyBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({
      where: { slug: slug },
    });

    if (!company) {
      throw new NotFoundException('Nenhuma empresa encontrada para este slug.');
    }

    return company;
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
