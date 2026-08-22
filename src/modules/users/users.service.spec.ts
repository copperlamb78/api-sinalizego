import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasService } from 'src/asaas/asaas.service';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { USER_PUBLIC_SELECT } from './constants/user-select.constant';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;
  let asaas: AsaasService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAsaas = {
    createCustomer: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: AsaasService,
          useValue: mockAsaas,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    asaas = module.get<AsaasService>(AsaasService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllUsers', () => {
    it('should query all users using USER_PUBLIC_SELECT to protect passwords and tokens', async () => {
      const usersMock = [
        {
          id: 'u1',
          name: 'User 1',
          email: 'u1@test.com',
          phone: '11999999999',
        },
      ];
      mockPrisma.user.findMany.mockResolvedValue(usersMock);

      const result = await service.getAllUsers();

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        select: USER_PUBLIC_SELECT,
      });
      expect(result).toEqual(usersMock);
    });
  });

  describe('updateUser', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUser('invalid-user', { name: 'Novo Nome' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only update name and phone, returning public select', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Old',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        name: 'Novo Nome',
        phone: '11988887777',
      });

      const result = await service.updateUser('user-1', {
        name: 'Novo Nome',
        phone: '11988887777',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Novo Nome', phone: '11988887777' },
        select: USER_PUBLIC_SELECT,
      });
      expect(result.name).toEqual('Novo Nome');
    });
  });

  describe('changePassword', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword456',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if currentPassword does not match', async () => {
      const hashedOld = await bcrypt.hash('correctOldPassword', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        password: hashedOld,
      });

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'wrongOldPassword',
          newPassword: 'newPassword456',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should hash new password, invalidate refresh token, and update user when password matches', async () => {
      const hashedOld = await bcrypt.hash('correctOldPassword', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        password: hashedOld,
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      const result = await service.changePassword('user-1', {
        currentPassword: 'correctOldPassword',
        newPassword: 'newSecurePassword456',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          refreshToken: null,
        }),
      });
      expect(result.message).toEqual('Senha alterada com sucesso.');
    });
  });
});
