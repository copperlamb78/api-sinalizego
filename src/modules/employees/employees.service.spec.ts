import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from './employees.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApptStatus } from '@prisma/client';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: PrismaService;

  const mockCompany = {
    id: 'company-uuid-1',
    userId: 'user-uuid-1',
    businessName: 'Barbearia Modelo',
    timezone: 'America/Sao_Paulo',
    isActive: true,
  };

  const mockEmployee = {
    id: 'employee-uuid-1',
    companyId: 'company-uuid-1',
    name: 'Carlos Silva',
    email: 'carlos@modelo.com',
    phone: '11999999999',
    photoUrl: 'https://exemplo.com/foto.jpg',
    roleTitle: 'Barbeiro Sênior',
    isActive: true,
    disabledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    groups: [],
    services: [],
  };

  const mockPrisma = {
    company: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    employee: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    serviceGroup: {
      findMany: jest.fn(),
    },
    service: {
      findMany: jest.fn(),
    },
    appointment: {
      count: jest.fn(),
    },
    review: {
      aggregate: jest.fn(),
    },
    employeeGroup: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    employeeService: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve cadastrar um funcionário com sucesso', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.employee.create.mockResolvedValue(mockEmployee);

      const result = await service.create(
        {
          name: 'Carlos Silva',
          roleTitle: 'Barbeiro Sênior',
          email: 'carlos@modelo.com',
          phone: '11999999999',
        },
        'user-uuid-1',
      );

      expect(result).toEqual(mockEmployee);
      expect(mockPrisma.employee.create).toHaveBeenCalled();
    });

    it('deve lançar erro se os grupos informados não pertencerem à empresa', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.serviceGroup.findMany.mockResolvedValue([]); // Nenhum grupo achado

      await expect(
        service.create(
          {
            name: 'Carlos Silva',
            groupIds: ['group-invalid'],
          },
          'user-uuid-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar erro se os serviços informados não pertencerem à empresa', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.service.findMany.mockResolvedValue([]); // Nenhum serviço achado

      await expect(
        service.create(
          {
            name: 'Carlos Silva',
            serviceIds: ['service-invalid'],
          },
          'user-uuid-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('deve listar funcionários da empresa com paginação', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.employee.findMany.mockResolvedValue([mockEmployee]);
      mockPrisma.employee.count.mockResolvedValue(1);

      const result = await service.findAll('user-uuid-1', { page: 1, limit: 10 });

      expect(result.items).toEqual([mockEmployee]);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('findOne', () => {
    it('deve retornar detalhes do funcionário se pertencer à empresa', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);

      const result = await service.findOne('employee-uuid-1', 'user-uuid-1');

      expect(result).toEqual(mockEmployee);
    });

    it('deve lançar NotFoundException se funcionário for de outra empresa (Anti-IDOR)', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('employee-other-company', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('deve calcular estatísticas reais delegando agregações ao banco', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);

      mockPrisma.appointment.count
        .mockResolvedValueOnce(3) // hoje
        .mockResolvedValueOnce(15) // mês
        .mockResolvedValueOnce(45); // total

      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { ratingEmployee: 4.8 },
        _count: { ratingEmployee: 12 },
      });

      const stats = await service.getStats('employee-uuid-1', 'user-uuid-1');

      expect(stats).toEqual({
        employeeId: 'employee-uuid-1',
        completedToday: 3,
        completedMonth: 15,
        completedTotal: 45,
        averageRating: 4.8,
        ratingsCount: 12,
      });
    });
  });

  describe('toggleStatus', () => {
    it('deve alternar status para inativo e definir disabledAt sem apagar registro', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.employee.findFirst.mockResolvedValue({
        ...mockEmployee,
        isActive: true,
      });
      mockPrisma.employee.update.mockResolvedValue({
        id: mockEmployee.id,
        name: mockEmployee.name,
        isActive: false,
        disabledAt: new Date(),
      });

      const result = await service.toggleStatus(mockEmployee.id, 'user-uuid-1');

      expect(result.isActive).toBe(false);
      expect(mockPrisma.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });
});
