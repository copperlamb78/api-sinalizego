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

      const result = await service.forgotPassword({ email: 'nonexistent@test.com' });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'nonexistent@test.com' },
        select: expect.any(Object),
      });
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
      expect(mockMailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(result.message).toContain('Se o e-mail informado estiver cadastrado');
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
      expect(result.message).toContain('Se o e-mail informado estiver cadastrado');
    });
  });

  describe('resetPassword', () => {
    it('should throw BadRequestException if token is malformed', async () => {
      mockJwtService.decode.mockImplementation(() => {
        throw new Error('Malformed token');
      });

      await expect(
        service.resetPassword({ token: 'invalid.token', newPassword: 'newPassword123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if token payload has no sub', async () => {
      mockJwtService.decode.mockReturnValue({});

      await expect(
        service.resetPassword({ token: 'invalid.token', newPassword: 'newPassword123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user in token does not exist', async () => {
      mockJwtService.decode.mockReturnValue({ sub: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'valid.token', newPassword: 'newPassword123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if dynamic signature verification fails (e.g. expired or password already changed)', async () => {
      mockJwtService.decode.mockReturnValue({ sub: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'joao@test.com',
        password: 'currentHashedPassword',
      });
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid signature / expired'));

      await expect(
        service.resetPassword({ token: 'token.signed.with.old.password', newPassword: 'newPassword123' }),
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

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(
        'valid.token',
        { secret: 'test_jwt_secretcurrentHashedPassword' },
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          refreshToken: null,
        }),
      });
      expect(result.message).toEqual('Senha redefinida com sucesso.');
    });
  });
});
