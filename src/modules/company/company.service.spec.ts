import { Test, TestingModule } from '@nestjs/testing';
import { CompanyService } from './company.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SlugHelper } from './helpers/create-slug.helper';
import { AuthService } from '../auth/auth.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('CompanyService', () => {
  let service: CompanyService;
  let prisma: PrismaService;
  let slugHelper: SlugHelper;
  let authService: AuthService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockSlugHelper = {
    createSlug: jest.fn().mockResolvedValue('barbearia-vip'),
  };

  const mockAuthService = {
    getTokens: jest.fn().mockResolvedValue({
      accessToken: 'access.token.owner',
      refreshToken: 'refresh.token.owner',
    }),
    updateRefreshTokenHash: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: SlugHelper,
          useValue: mockSlugHelper,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
    prisma = module.get<PrismaService>(PrismaService);
    slugHelper = module.get<SlugHelper>(SlugHelper);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCompanyWithUser', () => {
    const dto = {
      name: 'João Barbeiro',
      email: 'joao@barber.com',
      phone: '75999998888',
      password: 'password123',
      businessName: 'Barbearia VIP',
      providerType: 'Barbearia',
      district: 'Centro',
      street: 'Rua Central',
      city: 'Feira de Santana',
      state: 'BA',
      zipCode: '44000000',
      number: '100',
    };

    it('should throw ConflictException if email is already in use', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.createCompanyWithUser(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create company and user with COMPANY_OWNER role and return auth tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const createdUser = {
        id: 'user-1',
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        password: 'hashed_password',
        role: 'COMPANY_OWNER',
        companies: [
          {
            id: 'company-1',
            businessName: dto.businessName,
            slug: 'barbearia-vip',
          },
        ],
      };
      mockPrisma.user.create.mockResolvedValue(createdUser);

      const result = await service.createCompanyWithUser(dto as any);

      expect(mockAuthService.getTokens).toHaveBeenCalledWith(
        'user-1',
        'joao@barber.com',
        'COMPANY_OWNER',
      );
      expect(mockAuthService.updateRefreshTokenHash).toHaveBeenCalledWith(
        'user-1',
        'refresh.token.owner',
      );
      expect(result.access_token).toBe('access.token.owner');
      expect(result.refresh_token).toBe('refresh.token.owner');
      expect(result.user).not.toHaveProperty('password');
    });
  });

  describe('createCompany (to existing user)', () => {
    const dto = {
      businessName: 'Barbearia VIP',
      providerType: 'Barbearia',
      district: 'Centro',
      street: 'Rua Central',
      city: 'Feira de Santana',
      state: 'BA',
      zipCode: '44000000',
      number: '100',
      phone: '75999998888',
    };

    it('should throw NotFoundException if user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createCompany(dto as any, 'user-unknown'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create company, promote user to COMPANY_OWNER and return refreshed tokens', async () => {
      const existingUser = {
        id: 'user-client-1',
        name: 'Cliente Promovido',
        email: 'cliente@test.com',
        role: 'CLIENT',
      };
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      const createdCompany = {
        id: 'company-1',
        ...dto,
        slug: 'barbearia-vip',
        userId: 'user-client-1',
      };
      mockPrisma.company.create.mockResolvedValue(createdCompany);
      mockPrisma.user.update.mockResolvedValue({
        ...existingUser,
        role: 'COMPANY_OWNER',
      });

      const result = await service.createCompany(dto as any, 'user-client-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-client-1' },
        data: { role: 'COMPANY_OWNER' },
      });
      expect(mockAuthService.getTokens).toHaveBeenCalledWith(
        'user-client-1',
        'cliente@test.com',
        'COMPANY_OWNER',
      );
      expect(result.access_token).toBe('access.token.owner');
      expect(result.refresh_token).toBe('refresh.token.owner');
      expect(result.company).toEqual(createdCompany);
    });
  });
});
