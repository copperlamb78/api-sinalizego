import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/user-create.dto';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/user-update.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AsaasService } from 'src/asaas/asaas.service';
import { USER_PUBLIC_SELECT } from './constants/user-select.constant';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asaas: AsaasService,
  ) {}

  async createUser(data: CreateUserDto) {
    if (await this.prisma.user.findUnique({ where: { email: data.email } })) {
      throw new ConflictException('O e-mail já está em uso');
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
      select: USER_PUBLIC_SELECT,
    });

    return { message: 'Usuário criado com sucesso', user: user };
  }

  async getAllUsers() {
    const users = await this.prisma.user.findMany({
      select: USER_PUBLIC_SELECT,
    });
    return users;
  }

  async updateUser(userId: string, data: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.phone && { phone: data.phone }),
      },
      select: USER_PUBLIC_SELECT,
    });

    return updatedUser;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    const newHashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: newHashedPassword,
        refreshToken: null, // Invalida sessões ativas com o refresh token antigo
      },
    });

    return { message: 'Senha alterada com sucesso.' };
  }

  async updateCpfCnpjAndCreateCustomerId(userId: string, cpfCnpj: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (user.cpfCnpj) {
      throw new ConflictException('CPF/CNPJ já está cadastrado.');
    }

    const asaasCustomerId = await this.asaas.createCustomer(cpfCnpj, user.name);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { cpfCnpj: cpfCnpj, asaasCustomerId: asaasCustomerId },
      select: {
        id: true,
        cpfCnpj: true,
        asaasCustomerId: true,
      },
    });

    return {
      message: 'CPF atualizado e cliente financeiro gerado com sucesso!',
      user: updatedUser,
    };
  }

  async deactivateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { isActive: false, disabledAt: new Date() },
      select: USER_PUBLIC_SELECT,
    });

    return updatedUser;
  }

  async activateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { isActive: true, disabledAt: null },
      select: USER_PUBLIC_SELECT,
    });

    return updatedUser;
  }
}
