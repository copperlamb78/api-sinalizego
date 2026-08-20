import { Test, TestingModule } from '@nestjs/testing';
import { ServiceGroupService } from './service-group.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

describe('ServiceGroupService', () => {
  let service: ServiceGroupService;
  let prisma: PrismaService;

  const mockPrisma = {
    serviceGroup: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceGroupService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ServiceGroupService>(ServiceGroupService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw NotFoundException if company does not exist', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { name: 'Grupo A', capacity: 2, companyId: 'company-1' },
          'owner-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not company owner and not admin', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'company-1',
        userId: 'other-owner',
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: Role.COMPANY_OWNER,
      });

      await expect(
        service.create(
          { name: 'Grupo A', capacity: 2, companyId: 'company-1' },
          'owner-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create service group if user is company owner', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'company-1',
        userId: 'owner-1',
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: Role.COMPANY_OWNER,
      });
      mockPrisma.serviceGroup.create.mockResolvedValue({
        id: 'group-1',
        name: 'Grupo A',
        capacity: 2,
        companyId: 'company-1',
      });

      const result = await service.create(
        { name: 'Grupo A', capacity: 2, companyId: 'company-1' },
        'owner-1',
      );

      expect(mockPrisma.serviceGroup.create).toHaveBeenCalledWith({
        data: { name: 'Grupo A', capacity: 2, companyId: 'company-1' },
      });
      expect(result.id).toEqual('group-1');
    });
  });

  describe('update', () => {
    const serviceGroupMock = {
      id: 'group-1',
      name: 'Grupo A',
      capacity: 2,
      company: {
        id: 'company-1',
        userId: 'owner-1',
      },
    };

    it('should throw NotFoundException if service group does not exist', async () => {
      mockPrisma.serviceGroup.findUnique.mockResolvedValue(null);

      await expect(
        service.update('invalid-id', 'owner-1', { name: 'Novo Nome' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own the company', async () => {
      mockPrisma.serviceGroup.findUnique.mockResolvedValue(serviceGroupMock);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'stranger-id',
        role: Role.COMPANY_OWNER,
      });

      await expect(
        service.update('group-1', 'stranger-id', { name: 'Novo Nome' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully update service group for owner', async () => {
      mockPrisma.serviceGroup.findUnique.mockResolvedValue(serviceGroupMock);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: Role.COMPANY_OWNER,
      });
      mockPrisma.serviceGroup.update.mockResolvedValue({
        ...serviceGroupMock,
        name: 'Novo Nome',
      });

      const result = await service.update('group-1', 'owner-1', {
        name: 'Novo Nome',
      });

      expect(mockPrisma.serviceGroup.update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: { name: 'Novo Nome' },
      });
      expect(result.name).toEqual('Novo Nome');
    });
  });

  describe('remove', () => {
    const serviceGroupMock = {
      id: 'group-1',
      name: 'Grupo A',
      company: {
        id: 'company-1',
        userId: 'owner-1',
      },
      services: [],
    };

    it('should throw NotFoundException if service group does not exist', async () => {
      mockPrisma.serviceGroup.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid-id', 'owner-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not company owner', async () => {
      mockPrisma.serviceGroup.findUnique.mockResolvedValue(serviceGroupMock);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'stranger-id',
        role: Role.COMPANY_OWNER,
      });

      await expect(service.remove('group-1', 'stranger-id')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if service group still has active services attached', async () => {
      mockPrisma.serviceGroup.findUnique.mockResolvedValue({
        ...serviceGroupMock,
        services: [{ id: 'service-1', isActive: true }],
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: Role.COMPANY_OWNER,
      });

      await expect(service.remove('group-1', 'owner-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should deactivate (soft delete) service group when no active services attached', async () => {
      mockPrisma.serviceGroup.findUnique.mockResolvedValue(serviceGroupMock);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: Role.COMPANY_OWNER,
      });
      mockPrisma.serviceGroup.update.mockResolvedValue({
        ...serviceGroupMock,
        isActive: false,
      });

      const result = await service.remove('group-1', 'owner-1');

      expect(mockPrisma.serviceGroup.update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: expect.objectContaining({
          isActive: false,
        }),
      });
      expect(result.isActive).toBe(false);
    });
  });
});
