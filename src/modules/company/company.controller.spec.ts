import { Test, TestingModule } from '@nestjs/testing';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

describe('CompanyController', () => {
  let controller: CompanyController;
  let companyService: CompanyService;

  const mockCompanyService = {
    createCompanyWithUser: jest.fn(),
    createCompany: jest.fn(),
    getCompanyByUserId: jest.fn(),
    getCompanyByCompanyId: jest.fn(),
    getAllCompaniesByUserId: jest.fn(),
    getAllCompanies: jest.fn(),
    getCompanyBySlug: jest.fn(),
    updateCompany: jest.fn(),
    deactivateCompany: jest.fn(),
    activateCompany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyController],
      providers: [
        {
          provide: CompanyService,
          useValue: mockCompanyService,
        },
      ],
    }).compile();

    controller = module.get<CompanyController>(CompanyController);
    companyService = module.get<CompanyService>(CompanyService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createCompany', () => {
    it('should create company along with new user', async () => {
      const dto = {
        name: 'Dono Barbearia',
        email: 'dono@barber.com',
        phone: '75999998888',
        password: 'password123',
        businessName: 'Barbearia VIP',
        providerType: 'Barbearia',
        district: 'Centro',
        street: 'Rua Principal',
        city: 'Feira de Santana',
        state: 'BA',
        zipCode: '44000000',
        number: '100',
      };
      const expected = { message: 'Empresa criada com sucesso' };
      mockCompanyService.createCompanyWithUser.mockResolvedValue(expected);

      const result = await controller.createCompany(dto as any);
      expect(companyService.createCompanyWithUser).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('createCompanyToUser', () => {
    it('should create company for authenticated existing user', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const dto = {
        businessName: 'Barbearia VIP',
        providerType: 'Barbearia',
        district: 'Centro',
        street: 'Rua Principal',
        city: 'Feira de Santana',
        state: 'BA',
        zipCode: '44000000',
        number: '100',
      };
      const expected = { id: 'company-1', ...dto, userId: 'user-1' };
      mockCompanyService.createCompany.mockResolvedValue(expected);

      const result = await controller.createCompanyToUser(dto as any, req);
      expect(companyService.createCompany).toHaveBeenCalledWith(dto, 'user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getCompanyBySlug', () => {
    it('should return public company data by slug', async () => {
      const expected = {
        id: 'company-1',
        businessName: 'Barbearia VIP',
        slug: 'barbearia-vip',
      };
      mockCompanyService.getCompanyBySlug.mockResolvedValue(expected);

      const result = await controller.getCompanyBySlug('barbearia-vip');
      expect(companyService.getCompanyBySlug).toHaveBeenCalledWith(
        'barbearia-vip',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getCompanyById', () => {
    it('should return company by companyId', async () => {
      const expected = { id: 'company-1', businessName: 'Barbearia VIP' };
      mockCompanyService.getCompanyByCompanyId.mockResolvedValue(expected);

      const result = await controller.getCompanyById('company-1');
      expect(companyService.getCompanyByCompanyId).toHaveBeenCalledWith(
        'company-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getAllCompaniesByUserId', () => {
    it('should return companies for authenticated user', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = [{ id: 'company-1', businessName: 'Barbearia VIP' }];
      mockCompanyService.getAllCompaniesByUserId.mockResolvedValue(expected);

      const result = await controller.getAllCompaniesByUserId(req);
      expect(companyService.getAllCompaniesByUserId).toHaveBeenCalledWith(
        'user-1',
        undefined,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('updateCompany', () => {
    it('should update company data', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const updateDto = { businessName: 'Barbearia VIP Premium' };
      const expected = {
        id: 'company-1',
        businessName: 'Barbearia VIP Premium',
      };
      mockCompanyService.updateCompany.mockResolvedValue(expected);

      const result = await controller.updateCompany(
        'company-1',
        updateDto as any,
        req,
      );
      expect(companyService.updateCompany).toHaveBeenCalledWith(
        'user-1',
        'company-1',
        updateDto,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('deactivateCompany', () => {
    it('should deactivate company', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = { id: 'company-1', isActive: false };
      mockCompanyService.deactivateCompany.mockResolvedValue(expected);

      const result = await controller.deactivateCompany('company-1', req);
      expect(companyService.deactivateCompany).toHaveBeenCalledWith(
        'user-1',
        'company-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('activateCompany', () => {
    it('should activate company', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = { id: 'company-1', isActive: true };
      mockCompanyService.activateCompany.mockResolvedValue(expected);

      const result = await controller.activateCompany('company-1', req);
      expect(companyService.activateCompany).toHaveBeenCalledWith(
        'user-1',
        'company-1',
      );
      expect(result).toEqual(expected);
    });
  });
});
