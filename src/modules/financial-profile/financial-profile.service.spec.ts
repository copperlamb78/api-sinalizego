import { Test, TestingModule } from '@nestjs/testing';
import { FinancialProfileService } from './financial-profile.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasService } from 'src/asaas/asaas.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FINANCIAL_PROFILE_OWNER_SELECT } from './constants/financial-profile-select.constant';
import { Role } from '@prisma/client';

describe('FinancialProfileService', () => {
  let service: FinancialProfileService;
  let prisma: PrismaService;
  let asaasService: AsaasService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    financialProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    company: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockAsaasService = {
    createSubAccount: jest.fn(),
    getSubacccountBalance: jest.fn(),
  };

  beforeAll(() => {
    process.env.ENCRYPTION_SECRET = 'test-secret';
  });

  afterAll(() => {
    delete process.env.ENCRYPTION_SECRET;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialProfileService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: AsaasService,
          useValue: mockAsaasService,
        },
      ],
    }).compile();

    service = module.get<FinancialProfileService>(FinancialProfileService);
    prisma = module.get<PrismaService>(PrismaService);
    asaasService = module.get<AsaasService>(AsaasService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createFinancialProfile', () => {
    const mockUser = { id: 'user-1', role: 'CLIENT' };
    const createDto = {
      name: 'Barbearia VIP',
      email: 'contato@vip.com',
      cpfCnpj: '12345678000195',
      companyType: 'MEI',
      mobilePhone: '75999998888',
      incomeValue: 5000,
      address: 'Rua Central',
      addressNumber: '100',
      province: 'Centro',
      postalCode: '44000000',
      pixAddressKey: '12345678000195',
      pixAddressKeyType: 'CNPJ',
    };

    it('should create subaccount in Asaas, encrypt apiKey at rest and return safe fields', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.financialProfile.findUnique.mockResolvedValue(null);
      mockAsaasService.createSubAccount.mockResolvedValue({
        walletId: 'wallet-asaas-123',
        apiKey: '$aact_secret_key_123',
      });

      const createdRecord = {
        id: 'fp-1',
        ...createDto,
        birthDate: null,
        walletId: 'wallet-asaas-123',
        userId: 'user-1',
        isActive: true,
        disabledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.financialProfile.create.mockResolvedValue(createdRecord);

      const result = await service.createFinancialProfile(createDto, 'user-1');

      expect(mockPrisma.financialProfile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          walletId: 'wallet-asaas-123',
          pixAddressKey: '12345678000195',
          pixAddressKeyType: 'CNPJ',
          asaasApiKey: expect.stringMatching(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/), // encrypted
          userId: 'user-1',
        }),
        select: FINANCIAL_PROFILE_OWNER_SELECT,
      });
      expect(result).not.toHaveProperty('asaasApiKey');
      expect(mockPrisma.company.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', financialProfileId: null, isActive: true },
        data: { financialProfileId: 'fp-1' },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: 'COMPANY_OWNER' },
      });
    });

    it('should link company and return existing profile if same user resubmits document', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.financialProfile.findUnique.mockResolvedValue({
        id: 'fp-existing',
        userId: 'user-1',
        cpfCnpj: '12345678000195',
        birthDate: new Date('1990-01-01'),
        companyType: 'MEI',
      });

      const result = await service.createFinancialProfile(createDto, 'user-1');

      expect(mockPrisma.company.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', financialProfileId: null, isActive: true },
        data: { financialProfileId: 'fp-existing' },
      });
      expect(result.id).toBe('fp-existing');
    });

    it('should inherit address from active company when address fields are omitted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.financialProfile.findUnique.mockResolvedValue(null);
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        street: 'Rua da Empresa',
        number: '200',
        district: 'Bairro Comercial',
        zipCode: '44000111',
      });
      mockAsaasService.createSubAccount.mockResolvedValue({
        walletId: 'wallet-asaas-auto-address',
        apiKey: '$aact_secret_key_auto',
      });
      mockPrisma.financialProfile.create.mockResolvedValue({
        id: 'fp-auto',
        ...createDto,
        address: 'Rua da Empresa',
        addressNumber: '200',
        province: 'Bairro Comercial',
        postalCode: '44000111',
        walletId: 'wallet-asaas-auto-address',
        userId: 'user-1',
      });

      const dtoWithoutAddress = {
        ...createDto,
        address: undefined,
        addressNumber: undefined,
        province: undefined,
        postalCode: undefined,
      };

      const result = await service.createFinancialProfile(
        dtoWithoutAddress as any,
        'user-1',
      );

      expect(mockPrisma.company.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', isActive: true },
      });
      expect(mockAsaasService.createSubAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          address: 'Rua da Empresa',
          addressNumber: '200',
          province: 'Bairro Comercial',
          postalCode: '44000111',
        }),
      );
      expect(result.id).toBe('fp-auto');
    });

    it('should throw BadRequestException if address is omitted and user has no active company', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.financialProfile.findUnique.mockResolvedValue(null);
      mockPrisma.company.findFirst.mockResolvedValue(null);

      const dtoWithoutAddress = {
        ...createDto,
        address: undefined,
        addressNumber: undefined,
        province: undefined,
        postalCode: undefined,
      };

      await expect(
        service.createFinancialProfile(dtoWithoutAddress as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createFinancialProfile(createDto, 'unknown-user'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if document is already associated with another user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.financialProfile.findUnique.mockResolvedValue({
        id: 'fp-other',
        userId: 'other-user',
        cpfCnpj: '12345678000195',
      });

      await expect(
        service.createFinancialProfile(createDto, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getFinancialProfileByUserId', () => {
    it('should query with FINANCIAL_PROFILE_OWNER_SELECT and return profile without asaasApiKey', async () => {
      const mockProfile = {
        id: 'fp-1',
        name: 'Barbearia VIP',
        walletId: 'wallet-123',
        userId: 'user-1',
      };
      mockPrisma.financialProfile.findFirst.mockResolvedValue(mockProfile);

      const result = await service.getFinancialProfileByUserId(
        'user-1',
        'fp-1',
      );

      expect(mockPrisma.financialProfile.findFirst).toHaveBeenCalledWith({
        where: { id: 'fp-1', userId: 'user-1' },
        select: FINANCIAL_PROFILE_OWNER_SELECT,
      });
      expect(result).toEqual(mockProfile);
      expect(result).not.toHaveProperty('asaasApiKey');
    });

    it('should throw NotFoundException if profile is not found', async () => {
      mockPrisma.financialProfile.findFirst.mockResolvedValue(null);

      await expect(
        service.getFinancialProfileByUserId('user-1', 'fp-unknown'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFinancialProfileById (Tenant Security)', () => {
    it('should restrict search to userId for regular users', async () => {
      const mockProfile = {
        id: 'fp-1',
        name: 'Barbearia VIP',
        walletId: 'wallet-123',
        userId: 'user-1',
      };
      mockPrisma.financialProfile.findFirst.mockResolvedValue(mockProfile);

      const result = await service.getFinancialProfileById(
        'fp-1',
        'user-1',
        'COMPANY_OWNER',
      );

      expect(mockPrisma.financialProfile.findFirst).toHaveBeenCalledWith({
        where: { id: 'fp-1', userId: 'user-1', isActive: true },
        select: FINANCIAL_PROFILE_OWNER_SELECT,
      });
      expect(result).toEqual(mockProfile);
    });

    it('should allow ADMIN to search globally without userId scoping', async () => {
      const mockProfile = {
        id: 'fp-1',
        name: 'Barbearia VIP',
        walletId: 'wallet-123',
        userId: 'user-2',
      };
      mockPrisma.financialProfile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.getFinancialProfileById(
        'fp-1',
        'admin-id',
        Role.ADMIN,
      );

      expect(mockPrisma.financialProfile.findUnique).toHaveBeenCalledWith({
        where: { id: 'fp-1' },
        select: FINANCIAL_PROFILE_OWNER_SELECT,
      });
      expect(result).toEqual(mockProfile);
    });

    it('should throw NotFoundException if profile belongs to another tenant', async () => {
      mockPrisma.financialProfile.findFirst.mockResolvedValue(null);

      await expect(
        service.getFinancialProfileById('fp-1', 'attacker-user', 'CLIENT'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllFinancialProfiles (Admin)', () => {
    it('should query all profiles using FINANCIAL_PROFILE_OWNER_SELECT and exclude asaasApiKey even for admin', async () => {
      const mockProfiles = [
        { id: 'fp-1', name: 'Barbearia A', walletId: 'w-1' },
        { id: 'fp-2', name: 'Barbearia B', walletId: 'w-2' },
      ];
      mockPrisma.financialProfile.findMany.mockResolvedValue(mockProfiles);

      const result = await service.getAllFinancialProfiles();

      expect(mockPrisma.financialProfile.findMany).toHaveBeenCalledWith({
        where: {},
        select: FINANCIAL_PROFILE_OWNER_SELECT,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockProfiles);
      for (const p of result) {
        expect(p).not.toHaveProperty('asaasApiKey');
      }
    });
  });

  describe('deactivate / activate FinancialProfile', () => {
    it('should deactivate profile and return sanitized fields', async () => {
      mockPrisma.financialProfile.findFirst.mockResolvedValue({
        id: 'fp-1',
        userId: 'user-1',
        isActive: true,
      });
      mockPrisma.financialProfile.update.mockResolvedValue({
        id: 'fp-1',
        isActive: false,
      });

      const result = await service.deactivateFinancialProfile('fp-1', 'user-1');

      expect(mockPrisma.financialProfile.update).toHaveBeenCalledWith({
        where: { id: 'fp-1' },
        data: { isActive: false, disabledAt: expect.any(Date) },
        select: FINANCIAL_PROFILE_OWNER_SELECT,
      });
      expect(result).not.toHaveProperty('asaasApiKey');
    });
  });
});
