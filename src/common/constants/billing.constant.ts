/**
 * Constantes financeiras e de cobrança do SinalizeGO
 */

/**
 * Trava de Microtransações (Safety Gate):
 * Depósito mínimo absoluto permitido para pagamentos parciais (sinal).
 * Se o percentual resultar em valor inferior a R$ 15,00, força 100% upfront.
 */
export const MIN_MICROTRANSACTION_DEPOSIT = 15.0;

/**
 * Taxa fixa Asaas repassada/cobrada do Barbeiro no split (R$ 0,99 fixos para sempre — Regra N2).
 * NUNCA sincronizar da API: o excedente da tarifa real é absorvido pela plataforma.
 */
export const BARBER_ASAAS_PIX_FEE = 0.99;

/**
 * Custo padrão de referência do gateway Asaas (R$ 1,99 pós-promoção / R$ 0,99 promocional).
 * Métrica de CUSTO apenas — NUNCA usar no cálculo do split do barbeiro.
 */
export const DEFAULT_ASAAS_GATEWAY_COST = 1.99;

/**
 * Piso mínimo de taxa da plataforma (R$ 2,00).
 */
export const MIN_PLATFORM_TAX = 2.0;

/**
 * Tarifa padrão de transferência bancária / saque avulso Asaas (R$ 5,00).
 */
export const ASAAS_TRANSFER_FEE = 5.0;

/**
 * Piso mínimo de saldo acumulado para saque automático semanal gratuito (R$ 100,00).
 * Garante a viabilidade financeira da plataforma, acumulando saldos menores para semanas subsequentes.
 */
export const MIN_FREE_WEEKLY_PAYOUT = 100.0;

/**
 * Limite máximo de agendamentos ativos simultâneos por cliente (Anti-DoS / Concorrência).
 */
export const MAX_ACTIVE_APPOINTMENTS_PER_CLIENT = 2;

/**
 * Limite máximo de cancelamentos permitidos por cliente na mesma semana (7 dias) antes do bloqueio temporário.
 */
export const MAX_WEEKLY_CANCELLATIONS_LIMIT = 3;
