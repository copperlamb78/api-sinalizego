import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test_jwt_secret';
    strategy = new JwtStrategy(mockPrisma as any);
    jest.clearAllMocks();
  });

  it('should throw UnauthorizedException when payload has no sub', async () => {
    await expect(strategy.validate({})).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when user does not exist or is inactive', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(strategy.validate({ sub: 'user-1' })).rejects.toThrow(
      UnauthorizedException,
    );

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'joao@test.com',
      role: 'CLIENT',
      isActive: false,
      refreshToken: 'hash',
    });
    await expect(strategy.validate({ sub: 'user-1' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when token has sid and user.refreshToken is null (revoked session)', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'joao@test.com',
      role: 'CLIENT',
      isActive: true,
      refreshToken: null,
    });

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'joao@test.com',
        role: 'CLIENT',
        sid: 'session-uuid-123',
      }),
    ).rejects.toThrow(
      new UnauthorizedException('Sessão encerrada. Faça login novamente.'),
    );
  });

  it('should allow valid active session when sid is present and refreshToken hash exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'joao@test.com',
      role: 'COMPANY_OWNER',
      isActive: true,
      refreshToken: '$2b$10$validhash',
    });

    const result = await strategy.validate({
      sub: 'user-1',
      email: 'joao@test.com',
      role: 'CLIENT',
      sid: 'session-uuid-123',
    });

    expect(result).toEqual({
      sub: 'user-1',
      email: 'joao@test.com',
      role: 'COMPANY_OWNER',
    });
  });
});
