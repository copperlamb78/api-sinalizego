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
    await expect(strategy.validate({})).rejects.toThrow(
      new UnauthorizedException('Token JWT inválido.'),
    );
  });

  it('should throw UnauthorizedException when user does not exist or is inactive', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(strategy.validate({ sub: 'user-1' })).rejects.toThrow(
      new UnauthorizedException('Conta desativada ou usuário não encontrado.'),
    );

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'joao@test.com',
      role: 'CLIENT',
      isActive: false,
      refreshToken: 'hash',
    });
    await expect(strategy.validate({ sub: 'user-1' })).rejects.toThrow(
      new UnauthorizedException('Conta desativada ou usuário não encontrado.'),
    );
  });

  it('should throw UnauthorizedException when token has sid and user.refreshToken is null (revoked session on logout)', async () => {
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
        sid: 'session-uuid-1',
      }),
    ).rejects.toThrow(
      new UnauthorizedException('Sessão encerrada. Faça login novamente.'),
    );
  });

  it('should reject old token with sid1 when user.refreshToken has sid2 (new login / replaced session)', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'joao@test.com',
      role: 'CLIENT',
      isActive: true,
      refreshToken: 'session-uuid-2:$2b$10$newHashValue',
    });

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'joao@test.com',
        role: 'CLIENT',
        sid: 'session-uuid-1',
      }),
    ).rejects.toThrow(
      new UnauthorizedException(
        'Sessão expirada ou substituída por outro login.',
      ),
    );
  });

  it('should accept token with sid1 when user.refreshToken has matching sid1', async () => {
    const validSid = 'd7e8a912-3456-4abc-9def-0123456789ab';
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'joao@test.com',
      role: 'COMPANY_OWNER',
      isActive: true,
      refreshToken: `${validSid}:$2b$10$validhash`,
    });

    const result = await strategy.validate({
      sub: 'user-1',
      email: 'joao@test.com',
      role: 'CLIENT',
      sid: validSid,
    });

    expect(result).toEqual({
      sub: 'user-1',
      email: 'joao@test.com',
      role: 'COMPANY_OWNER',
    });
  });

  it('should maintain backward compatibility for legacy hashes without colon', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'joao@test.com',
      role: 'PROVIDER',
      isActive: true,
      refreshToken: '$2b$10$legacyHashWithoutColon',
    });

    const result = await strategy.validate({
      sub: 'user-1',
      email: 'joao@test.com',
      role: 'PROVIDER',
      sid: 'any-sid',
    });

    expect(result).toEqual({
      sub: 'user-1',
      email: 'joao@test.com',
      role: 'PROVIDER',
    });
  });

  it('should allow valid tokens without sid claim (legacy access tokens)', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'joao@test.com',
      role: 'CLIENT',
      isActive: true,
      refreshToken: null,
    });

    const result = await strategy.validate({
      sub: 'user-1',
      email: 'joao@test.com',
      role: 'CLIENT',
    });

    expect(result).toEqual({
      sub: 'user-1',
      email: 'joao@test.com',
      role: 'CLIENT',
    });
  });
});
