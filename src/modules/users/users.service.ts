import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/user-create.dto';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/user-update.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        isActive: true,
      },
    });

    return { message: 'Usuário criado com sucesso', user: user };
  }

  async getAllUsers() {
    const users = await this.prisma.user.findMany();
    return users;
  }

  async updateUser(userId: string, data: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: data,
    });
  }

  async deactivateUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { isActive: false, disabledAt: new Date() },
    });

    return updatedUser;
  }
}
