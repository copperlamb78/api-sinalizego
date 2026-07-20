import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateProviderDto } from './dto/providers-create.dto';
import { SlugHelper } from './helpers/create-slug.helper';

@Injectable()
export class ProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slugHelper: SlugHelper,
  ) {}

  async createProvider(data: CreateProviderDto) {
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
      message: 'Prestador de serviços criado com sucesso',
      user: providerUserWithoutPassword,
    };
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

  async getAllProviders() {
    const providers = await this.prisma.provider.findMany();
    return providers;
  }
}
