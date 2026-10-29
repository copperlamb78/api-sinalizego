import {
  parseAllowedOrigins,
  isOriginAllowed,
  createCorsOriginValidator,
  getCorsConfig,
  createCorsOptions,
  DEFAULT_PRODUCTION_ORIGINS,
  DEFAULT_STAGING_ORIGINS,
  DEFAULT_DEV_ORIGINS,
  CORS_ALLOWED_METHODS,
  CORS_ALLOWED_HEADERS,
  normalizeOrigin,
} from './cors.config';

describe('CORS Configuration Module (cors.config.ts)', () => {
  describe('normalizeOrigin', () => {
    it('should strip trailing slashes from valid URL', () => {
      expect(normalizeOrigin('https://app.sinalizego.com.br/')).toBe(
        'https://app.sinalizego.com.br',
      );
    });

    it('should trim whitespace', () => {
      expect(normalizeOrigin('  https://sinalizego.com.br   ')).toBe(
        'https://sinalizego.com.br',
      );
    });

    it('should return empty string for empty input', () => {
      expect(normalizeOrigin('')).toBe('');
      expect(normalizeOrigin('   ')).toBe('');
    });

    it('should gracefully handle non-URL strings', () => {
      expect(normalizeOrigin('custom-domain.internal/')).toBe(
        'custom-domain.internal',
      );
    });
  });

  describe('parseAllowedOrigins', () => {
    describe('Production Environment', () => {
      it('should return default institutional domains when CORS_ORIGINS is absent', () => {
        const origins = parseAllowedOrigins(undefined, undefined, 'production');
        expect(origins).toEqual(DEFAULT_PRODUCTION_ORIGINS);
        expect(origins).toContain('https://app.sinalizego.com.br');
        expect(origins).toContain('https://sinalizego.com.br');
      });

      it('should parse valid HTTPS origins configured via CORS_ORIGINS', () => {
        const origins = parseAllowedOrigins(
          'https://admin.sinalizego.com.br, https://painel.sinalizego.com.br/',
          undefined,
          'production',
        );
        expect(origins).toEqual([
          'https://admin.sinalizego.com.br',
          'https://painel.sinalizego.com.br',
        ]);
      });

      it('should reject and discard wildcard (*) in production', () => {
        const origins = parseAllowedOrigins(
          '*',
          undefined,
          'production',
        );
        expect(origins).toEqual(DEFAULT_PRODUCTION_ORIGINS);
        expect(origins).not.toContain('*');
      });

      it('should discard insecure http://, localhost and 127.0.0.1 in production', () => {
        const origins = parseAllowedOrigins(
          'http://localhost:5173,http://127.0.0.1:3000,http://sinalizego.com.br,https://app.sinalizego.com.br',
          undefined,
          'production',
        );
        expect(origins).toEqual(['https://app.sinalizego.com.br']);
      });

      it('should fallback to default institutional domains if all specified origins are invalid in production', () => {
        const origins = parseAllowedOrigins(
          '*,http://insecure.site,localhost:3000',
          undefined,
          'production',
        );
        expect(origins).toEqual(DEFAULT_PRODUCTION_ORIGINS);
      });
    });

    describe('Staging Environment', () => {
      it('should return default staging domains when CORS_ORIGINS is absent', () => {
        const origins = parseAllowedOrigins(undefined, undefined, 'staging');
        expect(origins).toEqual(DEFAULT_STAGING_ORIGINS);
        expect(origins).toContain('https://app-staging.sinalizego.com.br');
      });

      it('should discard wildcard in staging', () => {
        const origins = parseAllowedOrigins(
          '*,https://qa.sinalizego.com.br',
          undefined,
          'staging',
        );
        expect(origins).toEqual(['https://qa.sinalizego.com.br']);
      });
    });

    describe('Development Environment', () => {
      it('should include default dev origins when CORS_ORIGINS is not set', () => {
        const origins = parseAllowedOrigins(undefined, undefined, 'development');
        DEFAULT_DEV_ORIGINS.forEach((devOrigin) => {
          expect(origins).toContain(devOrigin);
        });
      });

      it('should merge custom origins with dev defaults', () => {
        const origins = parseAllowedOrigins(
          'http://localhost:8080,https://custom-preview.dev',
          undefined,
          'development',
        );
        expect(origins).toContain('http://localhost:8080');
        expect(origins).toContain('https://custom-preview.dev');
        expect(origins).toContain('http://localhost:5173');
      });
    });
  });

  describe('isOriginAllowed', () => {
    describe('Production Policy (Zero-Trust Fail-Closed)', () => {
      const allowed = ['https://app.sinalizego.com.br', 'https://sinalizego.com.br'];

      it('should allow requests with no Origin header (server-to-server / Asaas webhooks / cURL)', () => {
        expect(isOriginAllowed(undefined, allowed, 'production')).toBe(true);
        expect(isOriginAllowed('', allowed, 'production')).toBe(true);
      });

      it('should allow explicitly configured official institutional origins', () => {
        expect(
          isOriginAllowed('https://app.sinalizego.com.br', allowed, 'production'),
        ).toBe(true);
        expect(
          isOriginAllowed('https://sinalizego.com.br', allowed, 'production'),
        ).toBe(true);
      });

      it('should reject unconfigured arbitrary domains in production', () => {
        expect(
          isOriginAllowed('https://evil-attacker.com', allowed, 'production'),
        ).toBe(false);
        expect(
          isOriginAllowed('https://fake-sinalizego.com', allowed, 'production'),
        ).toBe(false);
      });

      it('should strictly reject arbitrary vercel.app domains in production', () => {
        expect(
          isOriginAllowed('https://arbitrary-clone.vercel.app', allowed, 'production'),
        ).toBe(false);
      });

      it('should strictly reject arbitrary ngrok tunnels in production', () => {
        expect(
          isOriginAllowed('https://random.ngrok-free.app', allowed, 'production'),
        ).toBe(false);
        expect(
          isOriginAllowed('https://tunnel.ngrok.io', allowed, 'production'),
        ).toBe(false);
      });

      it('should strictly reject localhost or 127.0.0.1 in production', () => {
        expect(
          isOriginAllowed('http://localhost:5173', allowed, 'production'),
        ).toBe(false);
        expect(
          isOriginAllowed('http://127.0.0.1:3000', allowed, 'production'),
        ).toBe(false);
      });

      it('should reject malformed or invalid URLs fail-closed in production', () => {
        expect(isOriginAllowed('javascript:void(0)', allowed, 'production')).toBe(
          false,
        );
        expect(isOriginAllowed('invalid-domain://!@#$', allowed, 'production')).toBe(
          false,
        );
      });
    });

    describe('Development Policy', () => {
      const allowed = DEFAULT_DEV_ORIGINS;

      it('should allow localhost and 127.0.0.1 ports in development', () => {
        expect(
          isOriginAllowed('http://localhost:5173', allowed, 'development'),
        ).toBe(true);
        expect(
          isOriginAllowed('http://127.0.0.1:3000', allowed, 'development'),
        ).toBe(true);
      });

      it('should allow vercel preview domains in development for review testing', () => {
        expect(
          isOriginAllowed('https://sinalizego-feat.vercel.app', allowed, 'development'),
        ).toBe(true);
      });

      it('should allow ngrok tunnels in development for Asaas sandbox testing', () => {
        expect(
          isOriginAllowed('https://subdomain.ngrok-free.app', allowed, 'development'),
        ).toBe(true);
        expect(
          isOriginAllowed('https://subdomain.ngrok.dev', allowed, 'development'),
        ).toBe(true);
      });
    });
  });

  describe('createCorsOriginValidator', () => {
    it('should invoke callback(null, true) when origin is undefined', (done) => {
      const validator = createCorsOriginValidator(
        ['https://app.sinalizego.com.br'],
        'production',
      );
      validator(undefined, (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should invoke callback(null, true) when origin is allowed in production', (done) => {
      const validator = createCorsOriginValidator(
        ['https://app.sinalizego.com.br'],
        'production',
      );
      validator('https://app.sinalizego.com.br', (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should invoke callback with Error when origin is not allowed in production', (done) => {
      const validator = createCorsOriginValidator(
        ['https://app.sinalizego.com.br'],
        'production',
      );
      validator('https://unauthorized-domain.com', (err, allow) => {
        expect(err).toBeInstanceOf(Error);
        expect(err?.message).toContain('não permitida pelas políticas de CORS');
        expect(allow).toBeUndefined();
        done();
      });
    });
  });

  describe('getCorsConfig & createCorsOptions', () => {
    it('should return complete CorsOptions object with credentials, methods and allowedHeaders', () => {
      const config = getCorsConfig({
        nodeEnv: 'production',
        corsOriginsEnv: 'https://app.sinalizego.com.br',
      });

      expect(config.credentials).toBe(true);
      expect(config.methods).toBe(CORS_ALLOWED_METHODS);
      expect(config.allowedHeaders).toEqual(CORS_ALLOWED_HEADERS);
      expect(config.allowedHeaders).toContain('asaas-access-token');
      expect(config.allowedHeaders).toContain('Authorization');
      expect(typeof config.origin).toBe('function');
    });

    it('createCorsOptions alias should behave identically to getCorsConfig', () => {
      const config1 = getCorsConfig({ nodeEnv: 'test' });
      const config2 = createCorsOptions({ nodeEnv: 'test' });

      expect(config1.credentials).toBe(config2.credentials);
      expect(config1.methods).toBe(config2.methods);
      expect(config1.allowedHeaders).toEqual(config2.allowedHeaders);
    });
  });
});
