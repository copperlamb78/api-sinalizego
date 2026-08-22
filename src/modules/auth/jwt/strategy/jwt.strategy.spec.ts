import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from 'src/prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test_jwt_secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should validate and return user payload when user exists and isActive is true', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'joao@test.com',
        role: 'CLIENT',
        isActive: true,
      });

      const payload = { sub: 'user-1', email: 'joao@test.com', role: 'CLIENT' };
      const result = await strategy.validate(payload);

      expect(result).toEqual({
        sub: 'user-1',
        email: 'joao@test.com',
        role: 'CLIENT',
      });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { id: true, email: true, role: true, isActive: true },
      });
    });

    it('should throw UnauthorizedException if user does not exist in database', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: 'user-not-found' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user account is deactivated (isActive === false)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'joao@test.com',
        role: 'CLIENT',
        isActive: false,
      });

      await expect(strategy.validate({ sub: 'user-1' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
