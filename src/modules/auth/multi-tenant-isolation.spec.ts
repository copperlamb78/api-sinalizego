import {
  NotFoundException,
  ForbiddenException,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, ApptStatus } from '@prisma/client';
import { CompanyService } from '../company/company.service';
import { EmployeesService } from '../employees/employees.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { UploadController } from '../../cloudinary/upload/upload.controller';
import { UsersService } from '../users/users.service';
import { RolesGuard } from './roles/guard/roles.guard';
import { SYSTEM_MANAGERS } from '../../common/constants/role-groups.constant';

describe('Multi-Tenant SaaS Security & Anti-IDOR Isolation Suite (TN-01 to TN-09)', () => {
  // Tenant A Fixtures
  const ownerAUserId = '11111111-1111-4111-8111-111111111111';
  const companyAId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const clientAUserId = '22222222-2222-4222-8222-222222222222';
  const employeeAId = '33333333-3333-4333-8333-333333333333';
  const appointmentAId = '44444444-4444-4444-8444-444444444444';

  // Tenant B Fixtures (Victim Tenant)
  const ownerBUserId = '55555555-5555-4555-8555-555555555555';
  const companyBId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const clientBUserId = '66666666-6666-4666-8666-666666666666';
  const employeeBId = '77777777-7777-4777-8777-777777777777';
  const appointmentBId = '88888888-8888-4888-8888-888888888888';

  describe('TN-01: Cross-Tenant Company Update Protection', () => {
    let companyService: CompanyService;
    const mockPrisma = {
      company: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      companyService = new CompanyService(
        mockPrisma as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
    });

    it('should reject when Owner A attempts to update Company B (returns 404 Not Found without leaking existence)', async () => {
      // Cláusula where: { userId: ownerAUserId, id: companyBId } retorna null
      mockPrisma.company.findFirst.mockResolvedValueOnce(null);

      await expect(
        companyService.updateCompany(ownerAUserId, companyBId, {
          businessName: 'Hacked Barbearia',
        } as any),
      ).rejects.toThrow(new NotFoundException('Empresa não encontrada.'));

      expect(mockPrisma.company.findFirst).toHaveBeenCalledWith({
        where: { userId: ownerAUserId, id: companyBId },
      });
      expect(mockPrisma.company.update).not.toHaveBeenCalled();
    });
  });

  describe('TN-02 & TN-03: Cross-Tenant Employee & Stats Protection', () => {
    let employeesService: EmployeesService;
    const mockPrisma = {
      company: {
        findFirst: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
      },
      appointment: {
        count: jest.fn(),
      },
      review: {
        aggregate: jest.fn(),
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      employeesService = new EmployeesService(mockPrisma as any);
    });

    it('TN-02: should reject when Owner A queries Employee B belonging to Company B (returns 404 Not Found)', async () => {
      // Owner A resolve para Company A
      mockPrisma.company.findFirst.mockResolvedValueOnce({
        id: companyAId,
        userId: ownerAUserId,
      });
      // Busca pelo funcionário B na Company A retorna null
      mockPrisma.employee.findFirst.mockResolvedValueOnce(null);

      await expect(
        employeesService.findOne(employeeBId, ownerAUserId),
      ).rejects.toThrow(
        new NotFoundException(
          'Funcionário não encontrado ou não pertence à sua empresa.',
        ),
      );

      expect(mockPrisma.employee.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: employeeBId,
            companyId: companyAId,
          },
        }),
      );
    });

    it('TN-03: should reject when Owner A requests stats for Employee B (fail-closed, 404 Not Found)', async () => {
      // Owner A resolve para Company A
      mockPrisma.company.findFirst.mockResolvedValueOnce({
        id: companyAId,
        userId: ownerAUserId,
      });
      // Funcionário B não existe na Company A
      mockPrisma.employee.findFirst.mockResolvedValueOnce(null);

      await expect(
        employeesService.getStats(employeeBId, ownerAUserId),
      ).rejects.toThrow(
        new NotFoundException(
          'Funcionário não encontrado ou não pertence à sua empresa.',
        ),
      );
      expect(mockPrisma.appointment.count).not.toHaveBeenCalled();
    });
  });

  describe('TN-04 & TN-05: Cross-Tenant Appointment & Calendar ICS Protection', () => {
    let appointmentsService: AppointmentsService;
    const mockPrisma = {
      appointment: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      appointmentsService = new AppointmentsService(
        mockPrisma as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
    });

    it('TN-04: should reject when Client A attempts to access Appointment B belonging to Client B (returns 404 Not Found)', async () => {
      // Agendamento pertence ao Client B e Company B (Owner B)
      mockPrisma.appointment.findUnique.mockResolvedValueOnce({
        id: appointmentBId,
        clientId: clientBUserId,
        company: {
          userId: ownerBUserId,
        },
      });

      await expect(
        appointmentsService.getAppointmentById(
          appointmentBId,
          clientAUserId,
          Role.CLIENT,
        ),
      ).rejects.toThrow(new NotFoundException('Agendamento não encontrado.'));
    });

    it('TN-05: should reject when Client A attempts to generate/download ICS for Appointment B (returns 404 Not Found)', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValueOnce({
        id: appointmentBId,
        clientId: clientBUserId,
        appointmentDate: new Date('2026-11-01T14:00:00Z'),
        appointmentEndDate: new Date('2026-11-01T14:30:00Z'),
        service: { name: 'Corte Degrade', durationMinutes: 30 },
        company: {
          userId: ownerBUserId,
          businessName: 'Barbearia B',
        },
      });

      await expect(
        appointmentsService.generateAppointmentIcs(
          appointmentBId,
          clientAUserId,
          Role.CLIENT,
        ),
      ).rejects.toThrow(new NotFoundException('Agendamento não encontrado.'));
    });
  });

  describe('TN-06: Cross-Tenant Media Upload Protection (IDOR Prevention)', () => {
    let uploadController: UploadController;
    const mockPrisma = {
      company: {
        findUnique: jest.fn(),
      },
    };
    const mockCloudinary = {
      uploadImage: jest.fn(),
    };
    const mockValidateImage = {
      isValidImageMagicBytes: jest.fn().mockReturnValue(true),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      uploadController = new UploadController(
        mockCloudinary as any,
        mockPrisma as any,
        mockValidateImage as any,
      );
    });

    it('should reject with 403 Forbidden when Owner A attempts to upload logo for Company B', async () => {
      // Company B pertence a Owner B
      mockPrisma.company.findUnique.mockResolvedValueOnce({
        id: companyBId,
        userId: ownerBUserId,
      });

      const fakeFile: Express.Multer.File = {
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        mimetype: 'image/png',
        originalname: 'logo.png',
        fieldname: 'file',
        encoding: '7bit',
        size: 1024,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const reqMock = {
        user: {
          sub: ownerAUserId,
          role: Role.COMPANY_OWNER,
        },
      };

      await expect(
        uploadController.uploadImage(fakeFile, companyBId, 'logo', reqMock),
      ).rejects.toThrow(
        new ForbiddenException(
          'Você não tem permissão para enviar imagens para esta empresa.',
        ),
      );

      expect(mockCloudinary.uploadImage).not.toHaveBeenCalled();
    });
  });

  describe('TN-07: Mass Assignment Immunity (Role Escalation Protection)', () => {
    let usersService: UsersService;
    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      usersService = new UsersService(mockPrisma as any, {} as any);
    });

    it('should ignore role field when client attempts privilege escalation via updateUser', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: clientAUserId,
        role: Role.CLIENT,
        name: 'Cliente A',
      });
      mockPrisma.user.update.mockResolvedValueOnce({
        id: clientAUserId,
        role: Role.CLIENT,
        name: 'Cliente Atualizado',
      });

      // Atacante injeta role: SUPER_ADMIN no objeto de atualização
      const maliciousDto: any = {
        name: 'Cliente Atualizado',
        role: Role.SUPER_ADMIN,
        isAdmin: true,
      };

      await usersService.updateUser(clientAUserId, maliciousDto);

      // Prisma update só recebe campos permitidos explicitamente (name, phone)
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: clientAUserId },
          data: {
            name: 'Cliente Atualizado',
          },
        }),
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: Role.SUPER_ADMIN,
          }),
        }),
      );
    });
  });

  describe('TN-08: Broken Function Level Authorization (BFLA Defense)', () => {
    let rolesGuard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      rolesGuard = new RolesGuard(reflector);
    });

    it('should reject with 403 Forbidden when Employee attempts to access SYSTEM_MANAGERS endpoints', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(SYSTEM_MANAGERS);

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              sub: employeeAId,
              role: Role.EMPLOYEE,
            },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => rolesGuard.canActivate(mockContext)).toThrow(
        new ForbiddenException(
          'Você não tem permissão para acessar este recurso.',
        ),
      );
    });

    it('should allow access when SUPER_ADMIN accesses SYSTEM_MANAGERS endpoints', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(SYSTEM_MANAGERS);

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              sub: 'admin-uuid',
              role: Role.SUPER_ADMIN,
            },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(rolesGuard.canActivate(mockContext)).toBe(true);
    });
  });

  describe('TN-09: Financial Data Scoping via JWT Identity', () => {
    let appointmentsService: AppointmentsService;
    const mockPrisma = {
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      appointmentsService = new AppointmentsService(
        mockPrisma as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
    });

    it('should strictly bind appointment queries to clientId from JWT claims without accepting client overrides', async () => {
      await appointmentsService.getAppointmentByUserId(clientAUserId);

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: clientAUserId,
          }),
        }),
      );
    });
  });
});
