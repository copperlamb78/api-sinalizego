import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUsersService = {
    createUser: jest.fn(),
    getAllUsers: jest.fn(),
    updateUser: jest.fn(),
    changePassword: jest.fn(),
    updateCpfCnpjAndCreateCustomerId: jest.fn(),
    deactivateUser: jest.fn(),
    activateUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createUser', () => {
    it('should call usersService.createUser with provided DTO', async () => {
      const dto = {
        name: 'Cliente Teste',
        email: 'cliente@test.com',
        phone: '75999998888',
        password: 'password123',
      };
      const expected = {
        message: 'Usuário criado com sucesso',
        user: {
          id: 'user-1',
          name: 'Cliente Teste',
          email: 'cliente@test.com',
        },
      };
      mockUsersService.createUser.mockResolvedValue(expected);

      const result = await controller.createUser(dto);
      expect(usersService.createUser).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('getAllUsers', () => {
    it('should return list of all users without sensitive fields', async () => {
      const expected = [{ id: 'user-1', name: 'User 1', email: 'u1@test.com' }];
      mockUsersService.getAllUsers.mockResolvedValue(expected);

      const result = await controller.getAllUsers();
      expect(usersService.getAllUsers).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('updateUser', () => {
    it('should update user if authorized', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const updateDto = { name: 'Nome Atualizado' };
      const expected = { id: 'user-1', name: 'Nome Atualizado' };
      mockUsersService.updateUser.mockResolvedValue(expected);

      const result = await controller.updateUser(req, updateDto);
      expect(usersService.updateUser).toHaveBeenCalledWith('user-1', updateDto);
      expect(result).toEqual(expected);
    });
  });

  describe('changePassword', () => {
    it('should change password for authenticated user', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const dto = {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword456',
      };
      const expected = { message: 'Senha alterada com sucesso.' };
      mockUsersService.changePassword.mockResolvedValue(expected);

      const result = await controller.changePassword(req, dto);
      expect(usersService.changePassword).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('updateCpfCnpj', () => {
    it('should update CPF and link Asaas customer id', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const dto = { cpfCnpj: '12345678909' };
      const expected = {
        message: 'CPF atualizado e cliente financeiro gerado com sucesso!',
        user: {
          id: 'user-1',
          cpfCnpj: '12345678909',
          asaasCustomerId: 'cus_123456',
        },
      };
      mockUsersService.updateCpfCnpjAndCreateCustomerId.mockResolvedValue(
        expected,
      );

      const result = await controller.updateCpfCnpj(req, dto);
      expect(
        usersService.updateCpfCnpjAndCreateCustomerId,
      ).toHaveBeenCalledWith('user-1', '12345678909');
      expect(result).toEqual(expected);
    });
  });

  describe('deactivateMyAccount', () => {
    it('should deactivate the authenticated user account', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = { id: 'user-1', isActive: false };
      mockUsersService.deactivateUser.mockResolvedValue(expected);

      const result = await controller.deactivateMyAccount(req);
      expect(usersService.deactivateUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('deactivateUserByAdmin', () => {
    it('should allow admin to deactivate specific user by userId param', async () => {
      const expected = { id: 'target-user-123', isActive: false };
      mockUsersService.deactivateUser.mockResolvedValue(expected);

      const result = await controller.deactivateUserByAdmin('target-user-123');
      expect(usersService.deactivateUser).toHaveBeenCalledWith(
        'target-user-123',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('activateUserByAdmin', () => {
    it('should allow admin to activate specific user by userId param', async () => {
      const expected = { id: 'target-user-123', isActive: true };
      mockUsersService.activateUser.mockResolvedValue(expected);

      const result = await controller.activateUserByAdmin('target-user-123');
      expect(usersService.activateUser).toHaveBeenCalledWith('target-user-123');
      expect(result).toEqual(expected);
    });
  });
});
