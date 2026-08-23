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
 * Taxa fixa Asaas repassada/cobrada do Barbeiro no split (R$ 0,99).
 */
export const BARBER_ASAAS_PIX_FEE = 0.99;

/**
 * Custo padrão do gateway Asaas (R$ 0,99 inicial / R$ 1,99 pós-promoção).
 */
export const DEFAULT_ASAAS_GATEWAY_COST = 0.99;

/**
 * Piso mínimo de taxa da plataforma (R$ 2,00).
 */
export const MIN_PLATFORM_TAX = 2.0;

/**
 * Tarifa padrão de transferência bancária / saque avulso Asaas (R$ 5,00).
 */
export const ASAAS_TRANSFER_FEE = 5.0;
