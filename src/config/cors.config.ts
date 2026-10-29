import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export interface CorsConfigParams {
  corsOriginsEnv?: string;
  frontendUrlEnv?: string;
  nodeEnv?: string;
}

export const DEFAULT_PRODUCTION_ORIGINS = [
  'https://app.sinalizego.com.br',
  'https://sinalizego.com.br',
];

export const DEFAULT_STAGING_ORIGINS = [
  'https://app-staging.sinalizego.com.br',
  'https://staging.sinalizego.com.br',
];

export const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4200',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

export const CORS_ALLOWED_METHODS =
  'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';

export const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'asaas-access-token',
  'Accept',
];

/**
 * Normaliza uma string de origem removendo espaços e barras finais,
 * ou extraindo protocolo e host caso seja uma URL válida.
 */
export function normalizeOrigin(origin: string): string {
  const trimmed = origin.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

/**
 * Faz o parse e sanitização das origens permitidas conforme o ambiente de execução.
 * Em produção e staging, curingas (*), hosts locais e protocolos inseguros são descartados.
 */
export function parseAllowedOrigins(
  corsOriginsEnv?: string,
  frontendUrlEnv?: string,
  nodeEnv?: string,
): string[] {
  const env = (nodeEnv || process.env.NODE_ENV || 'development').toLowerCase();
  const rawCorsOrigins = corsOriginsEnv ?? frontendUrlEnv;

  if (env === 'production') {
    if (!rawCorsOrigins) {
      return [...DEFAULT_PRODUCTION_ORIGINS];
    }

    const sanitized = rawCorsOrigins
      .split(',')
      .map(normalizeOrigin)
      .filter((origin) => {
        if (!origin) return false;
        // Rejeita explicitamente curingas (*), localhost, 127.0.0.1 e protocolos inseguros em produção
        if (origin.includes('*')) return false;
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) return false;
        if (!origin.startsWith('https://')) return false;
        return true;
      });

    return sanitized.length > 0 ? sanitized : [...DEFAULT_PRODUCTION_ORIGINS];
  }

  if (env === 'staging') {
    if (!rawCorsOrigins) {
      return [...DEFAULT_STAGING_ORIGINS];
    }

    const sanitized = rawCorsOrigins
      .split(',')
      .map(normalizeOrigin)
      .filter((origin) => {
        if (!origin) return false;
        if (origin.includes('*')) return false;
        return true;
      });

    return sanitized.length > 0 ? sanitized : [...DEFAULT_STAGING_ORIGINS];
  }

  // Ambiente de Desenvolvimento ou Testes
  const devOrigins = new Set<string>(DEFAULT_DEV_ORIGINS);
  if (rawCorsOrigins) {
    rawCorsOrigins
      .split(',')
      .map(normalizeOrigin)
      .filter(Boolean)
      .forEach((origin) => devOrigins.add(origin));
  }

  return Array.from(devOrigins);
}

/**
 * Avalia se uma origem solicitante é autorizada segundo as regras do ambiente.
 * - Requisições sem origem (!origin): sempre autorizadas (Server-to-Server, Asaas webhooks, cURL).
 * - Produção/Staging: correspondência estrita contra allowedOrigins (zero curingas, zero ngrok/vercel arbitrário).
 * - Desenvolvimento/Testes: permite localhost, 127.0.0.1, túneis ngrok e domínios preview vercel.
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
  nodeEnv?: string,
): boolean {
  // Permite requisições sem origin (mobile apps nativos, Postman, cURL, webhooks do Asaas)
  if (!origin) {
    return true;
  }

  const env = (nodeEnv || process.env.NODE_ENV || 'development').toLowerCase();
  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return false;
  }

  // Validação estrita para Produção e Staging
  if (env === 'production' || env === 'staging') {
    let originHostUrl = '';
    try {
      const parsed = new URL(origin);
      originHostUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {
      return false; // Fail-closed em caso de URL malformada
    }

    return (
      allowedOrigins.includes(normalizedOrigin) ||
      allowedOrigins.includes(originHostUrl)
    );
  }

  // Validação em Desenvolvimento / Testes
  if (allowedOrigins.includes(normalizedOrigin) || allowedOrigins.includes('*')) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    const host = originUrl.hostname;

    return (
      allowedOrigins.includes(origin) ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      /\.vercel\.app$/i.test(host) ||
      /(^|\.)ngrok(-free)?\.(app|dev|io)$/i.test(host)
    );
  } catch {
    return allowedOrigins.includes(normalizedOrigin);
  }
}

/**
 * Cria a função validadora de CORS para ser utilizada no CorsOptions do NestJS/Express.
 */
export function createCorsOriginValidator(
  allowedOrigins: string[],
  nodeEnv?: string,
): (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => void {
  const env = nodeEnv || process.env.NODE_ENV || 'development';

  return (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const allowed = isOriginAllowed(origin, allowedOrigins, env);
    if (allowed) {
      return callback(null, true);
    }

    return callback(
      new Error(`Origem ${origin} não permitida pelas políticas de CORS.`),
    );
  };
}

/**
 * Retorna as opções completas de CORS configuradas para a aplicação NestJS.
 */
export function getCorsConfig(params?: CorsConfigParams): CorsOptions {
  const nodeEnv = params?.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const corsOrigins =
    params?.corsOriginsEnv ?? process.env.CORS_ORIGINS;
  const frontendUrl =
    params?.frontendUrlEnv ?? process.env.FRONTEND_URL;

  const allowedOrigins = parseAllowedOrigins(
    corsOrigins,
    frontendUrl,
    nodeEnv,
  );

  return {
    origin: createCorsOriginValidator(allowedOrigins, nodeEnv),
    methods: CORS_ALLOWED_METHODS,
    credentials: true,
    allowedHeaders: CORS_ALLOWED_HEADERS,
  };
}

/**
 * Alias de getCorsConfig para compatibilidade semântica.
 */
export const createCorsOptions = getCorsConfig;
