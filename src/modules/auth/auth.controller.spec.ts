import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    refreshTokens: jest.fn(),
    logout: jest.fn(),
    me: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should authenticate user and return tokens', async () => {
      const loginDto = { email: 'user@test.com', password: 'password123' };
      const expectedResult = {
        access_token: 'access_token_jwt',
        refresh_token: 'refresh_token_jwt',
        user: { id: 'user-1', email: 'user@test.com', name: 'User Test', role: 'USER' },
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens when provided valid refresh token in req.user', async () => {
      const req = {
        user: {
          sub: 'user-1',
          refreshToken: 'valid_refresh_token',
        },
      } as any;

      const expectedResult = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
      };

      mockAuthService.refreshTokens.mockResolvedValue(expectedResult);

      const result = await controller.refreshTokens(req);
      expect(authService.refreshTokens).toHaveBeenCalledWith(
        'user-1',
        'valid_refresh_token',
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('me', () => {
    it('should return profile data for authenticated user', async () => {
      const req = {
        user: {
          sub: 'user-1',
        },
      } as any;

      const expectedUser = {
        id: 'user-1',
        name: 'User Test',
        email: 'user@test.com',
      };

      mockAuthService.me.mockResolvedValue(expectedUser);

      const result = await controller.me(req);
      expect(authService.me).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expectedUser);
    });
  });

  describe('logout', () => {
    it('should invalidate refresh token for authenticated user', async () => {
      const req = {
        user: {
          sub: 'user-1',
        },
      } as any;

      mockAuthService.logout.mockResolvedValue({ message: 'Logout realizado com sucesso.' });

      const result = await controller.logout(req);
      expect(authService.logout).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ message: 'Logout realizado com sucesso.' });
    });
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword', async () => {
      const dto = { email: 'user@test.com' };
      const expected = {
        message: 'Se o e-mail informado estiver cadastrado, as instruções para redefinição de senha foram enviadas.',
      };
      mockAuthService.forgotPassword.mockResolvedValue(expected);

      const result = await controller.forgotPassword(dto);
      expect(authService.forgotPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('resetPassword', () => {
    it('should call authService.resetPassword', async () => {
      const dto = { token: 'jwt.token.here', newPassword: 'newSecurePassword123' };
      const expected = { message: 'Senha redefinida com sucesso.' };
      mockAuthService.resetPassword.mockResolvedValue(expected);

      const result = await controller.resetPassword(dto);
      expect(authService.resetPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });
});
