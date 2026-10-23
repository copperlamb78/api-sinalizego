import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let mailService: MailService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    decode: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockMailService = {
    sendPasswordResetEmail: jest.fn(),
  };

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test_jwt_secret';
    process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret';
    process.env.FRONTEND_URL = 'http://localhost:3000';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    mailService = module.get<MailService>(MailService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('forgotPassword', () => {
    it('should return generic response without sending email if user is not found (prevents enumeration)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'nonexistent@test.com',
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'nonexistent@test.com' },
        select: expect.any(Object),
      });
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
      expect(mockMailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(result.message).toContain(
        'Se o e-mail informado estiver cadastrado',
      );
    });

    it('should generate JWT with dynamic secret (JWT_SECRET + user.password) and send email when user exists', async () => {
      const userMock = {
        id: 'user-1',
        name: 'João Silva',
        email: 'joao@test.com',
        password: 'hashedPassword123',
      };
      mockPrisma.user.findUnique.mockResolvedValue(userMock);
      mockJwtService.signAsync.mockResolvedValue('dynamic.jwt.token');
      mockMailService.sendPasswordResetEmail.mockResolvedValue(true);

      const result = await service.forgotPassword({ email: 'joao@test.com' });

      const expectedSecret = 'test_jwt_secrethashedPassword123';
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-1', email: 'joao@test.com' },
        { secret: expectedSecret, expiresIn: '15m' },
      );
      expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'joao@test.com',
        'João Silva',
        'http://localhost:3000/reset-password?token=dynamic.jwt.token',
      );
      expect(result.message).toContain(
        'Se o e-mail informado estiver cadastrado',
      );
    });
  });

  describe('resetPassword', () => {
    it('should throw BadRequestException if token is malformed', async () => {
      mockJwtService.decode.mockImplementation(() => {
        throw new Error('Malformed token');
      });

      await expect(
        service.resetPassword({
          token: 'invalid.token',
          newPassword: 'newPassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if token payload has no sub', async () => {
      mockJwtService.decode.mockReturnValue({});

      await expect(
        service.resetPassword({
          token: 'invalid.token',
          newPassword: 'newPassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user in token does not exist', async () => {
      mockJwtService.decode.mockReturnValue({ sub: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'valid.token',
          newPassword: 'newPassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if dynamic signature verification fails (e.g. expired or password already changed)', async () => {
      mockJwtService.decode.mockReturnValue({ sub: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'joao@test.com',
        password: 'currentHashedPassword',
      });
      mockJwtService.verifyAsync.mockRejectedValue(
        new Error('Invalid signature / expired'),
      );

      await expect(
        service.resetPassword({
          token: 'token.signed.with.old.password',
          newPassword: 'newPassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should successfully update password, invalidate refresh token and confirm on valid token', async () => {
      mockJwtService.decode.mockReturnValue({ sub: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'joao@test.com',
        password: 'currentHashedPassword',
      });
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      const result = await service.resetPassword({
        token: 'valid.token',
        newPassword: 'newSecurePassword456',
      });

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid.token', {
        secret: 'test_jwt_secretcurrentHashedPassword',
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          refreshToken: null,
        }),
      });
      expect(result.message).toEqual('Senha redefinida com sucesso.');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException("Credenciais inválidas") if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@test.com',
          password: 'password123',
        }),
      ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
    });

    it('should throw UnauthorizedException("Credenciais inválidas") if password is invalid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'joao@test.com',
        password: await bcrypt.hash('correctPassword123', 10),
        isActive: true,
      });

      await expect(
        service.login({
          email: 'joao@test.com',
          password: 'wrongPassword',
        }),
      ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
    });

    it('should throw UnauthorizedException if account is deactivated (isActive === false)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'desativado@test.com',
        password: 'hashedPassword',
        isActive: false,
      });

      await expect(
        service.login({
          email: 'desativado@test.com',
          password: 'password123',
        }),
      ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
    });

    it('should authenticate active user, return tokens and persist refreshToken with sid:hash format', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const activeUser = {
        id: 'user-1',
        name: 'João Silva',
        email: 'joao@test.com',
        role: 'CLIENT',
        password: hashedPassword,
        isActive: true,
      };
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      mockJwtService.signAsync
        .mockResolvedValueOnce('access.token.123')
        .mockResolvedValueOnce('refresh.token.123');
      mockPrisma.user.update.mockResolvedValue(activeUser);

      const result = await service.login({
        email: 'joao@test.com',
        password: 'password123',
      });

      expect(result.access_token).toBe('access.token.123');
      expect(result.refresh_token).toBe('refresh.token.123');
      expect(result.user.email).toBe('joao@test.com');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          refreshToken: expect.stringMatching(/^[0-9a-f-]+:\$2b\$10\$/),
        },
      });
    });
  });

  describe('refreshTokens', () => {
    it('should throw ForbiddenException if user is deactivated', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        refreshToken: 'hashedRefreshToken',
        isActive: false,
      });

      await expect(
        service.refreshTokens('user-1', 'rawRefreshToken'),
      ).rejects.toThrow(new ForbiddenException('Acesso Negado'));
    });

    it('should throw ForbiddenException if user has no refreshToken (logged out session)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        refreshToken: null,
        isActive: true,
      });

      await expect(
        service.refreshTokens('user-1', 'rawRefreshToken'),
      ).rejects.toThrow(new ForbiddenException('Acesso Negado'));
    });

    it('should throw ForbiddenException if storedSid does not match rtPayload.sid', async () => {
      const rawToken = 'rawRefreshToken';
      const hash = await bcrypt.hash(rawToken, 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'joao@test.com',
        role: 'CLIENT',
        refreshToken: `active-sid-2:${hash}`,
        isActive: true,
      });
      mockJwtService.decode.mockReturnValue({ sid: 'old-sid-1' });

      await expect(service.refreshTokens('user-1', rawToken)).rejects.toThrow(
        new ForbiddenException('Acesso Negado'),
      );
    });

    it('should throw ForbiddenException if bcrypt.compare fails for refreshToken', async () => {
      const hash = await bcrypt.hash('differentToken', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'joao@test.com',
        role: 'CLIENT',
        refreshToken: `active-sid-1:${hash}`,
        isActive: true,
      });
      mockJwtService.decode.mockReturnValue({ sid: 'active-sid-1' });

      await expect(
        service.refreshTokens('user-1', 'wrongRawToken'),
      ).rejects.toThrow(new ForbiddenException('Acesso Negado'));
    });

    it('should successfully rotate tokens and persist with optimistic lock when valid', async () => {
      const rawToken = 'validRawRefreshToken';
      const hash = await bcrypt.hash(rawToken, 10);
      const activeUser = {
        id: 'user-1',
        email: 'joao@test.com',
        role: 'CLIENT',
        refreshToken: `sid-123:${hash}`,
        isActive: true,
      };
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      mockJwtService.decode.mockReturnValue({ sid: 'sid-123' });
      mockJwtService.signAsync
        .mockResolvedValueOnce('new.access.token')
        .mockResolvedValueOnce('new.refresh.token');
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.refreshTokens('user-1', rawToken);

      expect(result.access_token).toBe('new.access.token');
      expect(result.refresh_token).toBe('new.refresh.token');
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
          isActive: true,
          refreshToken: `sid-123:${hash}`,
        },
        data: {
          refreshToken: expect.stringMatching(/^[0-9a-f-]+:\$2b\$10\$/),
        },
      });
    });

    it('should throw ForbiddenException if race condition occurs (updateMany returns count 0)', async () => {
      const rawToken = 'validRawRefreshToken';
      const hash = await bcrypt.hash(rawToken, 10);
      const activeUser = {
        id: 'user-1',
        email: 'joao@test.com',
        role: 'CLIENT',
        refreshToken: `sid-123:${hash}`,
        isActive: true,
      };
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      mockJwtService.decode.mockReturnValue({ sid: 'sid-123' });
      mockJwtService.signAsync
        .mockResolvedValueOnce('new.access.token')
        .mockResolvedValueOnce('new.refresh.token');
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.refreshTokens('user-1', rawToken)).rejects.toThrow(
        new ForbiddenException('Sessão revogada durante a renovação.'),
      );
    });

    it('should support legacy refreshToken without colon delimiter', async () => {
      const rawToken = 'legacyRawRefreshToken';
      const hash = await bcrypt.hash(rawToken, 10);
      const activeUser = {
        id: 'user-1',
        email: 'joao@test.com',
        role: 'CLIENT',
        refreshToken: hash,
        isActive: true,
      };
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      mockJwtService.decode.mockReturnValue({});
      mockJwtService.signAsync
        .mockResolvedValueOnce('new.access.token')
        .mockResolvedValueOnce('new.refresh.token');
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.refreshTokens('user-1', rawToken);

      expect(result.access_token).toBe('new.access.token');
      expect(result.refresh_token).toBe('new.refresh.token');
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
          isActive: true,
          refreshToken: hash,
        },
        data: {
          refreshToken: expect.stringMatching(/^[0-9a-f-]+:\$2b\$10\$/),
        },
      });
    });
  });

  describe('getTokens & session revocation (sid + me)', () => {
    it('should include a UUID sid claim in both accessToken and refreshToken payloads', async () => {
      mockJwtService.signAsync
        .mockResolvedValueOnce('access.token.sid')
        .mockResolvedValueOnce('refresh.token.sid');

      await service.getTokens('user-1', 'joao@test.com', 'CLIENT');

      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
      const firstPayload = mockJwtService.signAsync.mock.calls[0][0];
      const secondPayload = mockJwtService.signAsync.mock.calls[1][0];
      expect(firstPayload).toEqual(
        expect.objectContaining({
          sub: 'user-1',
          email: 'joao@test.com',
          role: 'CLIENT',
          sid: expect.any(String),
        }),
      );
      expect(firstPayload.sid).toBe(secondPayload.sid);
      expect(firstPayload.sid.length).toBeGreaterThan(10);
    });

    it('should throw UnauthorizedException in me() if user is null or isActive is false', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.me('user-missing')).rejects.toThrow(
        UnauthorizedException,
      );

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-inactive',
        email: 'inactive@test.com',
        isActive: false,
      });
      await expect(service.me('user-inactive')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return user profile in me() when user is active', async () => {
      const activeUser = {
        id: 'user-1',
        name: 'João',
        email: 'joao@test.com',
        role: 'CLIENT',
        isActive: true,
      };
      mockPrisma.user.findUnique.mockResolvedValueOnce(activeUser);
      const result = await service.me('user-1');
      expect(result).toEqual(activeUser);
    });

    it('should clear refreshToken on logout()', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' });
      mockPrisma.user.update.mockResolvedValueOnce({ id: 'user-1' });

      const res = await service.logout('user-1');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshToken: null },
      });
      expect(res.message).toContain('Logout realizado com sucesso');
    });
  });
});
