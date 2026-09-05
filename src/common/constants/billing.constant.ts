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
 * Tarifa padrão de transferência bancária / saque avulso Asaas (R$ 5,00 fallback estimado).
 */
export const ASAAS_TRANSFER_FEE = 5.0;
export const FALLBACK_TRANSFER_FEE_ESTIMATE = 5.0;

/**
 * Piso mínimo para saque avulso sob demanda (R$ 10,00).
 */
export const MIN_INSTANT_WITHDRAWAL = 10.0;

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

/**
 * Passo padrão da grade de horários de agendamento (30 minutos — AG-05).
 */
export const DEFAULT_SLOT_STEP_MINUTES = 30;

/**
 * Constantes fiscais para emissão de NFS-e via Asaas (Regime MEI da SinalizeGO)
 */
export const DEFAULT_MEI_TAXES = {
  retainIss: false,
  iss: 0,
  cofins: 0,
  csll: 0,
  inss: 0,
  ir: 0,
  pis: 0,
};

export const INVOICE_DESCRIPTION_TEMPLATE =
  'Serviços de intermediação de negócios, agendamento eletrônico e disponibilização de plataforma online de software. Competência: {{MES}}/{{ANO}}. Prestado em conformidade com o item 10.05 da LC 116/03. Código de Serviço Municipal: 1005.';

export const DEFAULT_MUNICIPAL_SERVICE_ID = '10.05';
