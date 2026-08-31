/**
 * Projeção completa de campos do modelo FinancialProfile para consultas do próprio dono ou SYSTEM_MANAGERS.
 * NUNCA inclui credenciais como `asaasApiKey`.
 */
export const FINANCIAL_PROFILE_OWNER_SELECT = {
  id: true,
  name: true,
  email: true,
  cpfCnpj: true,
  birthDate: true,
  companyType: true,
  mobilePhone: true,
  incomeValue: true,
  address: true,
  addressNumber: true,
  province: true,
  postalCode: true,
  walletId: true,
  userId: true,
  isActive: true,
  disabledAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Projeção segura e higienizada do FinancialProfile (sem CPF/CNPJ, renda, walletId, endereço ou telefone).
 */
export const FINANCIAL_PROFILE_SAFE_SELECT = {
  id: true,
  name: true,
  companyType: true,
  isActive: true,
  createdAt: true,
} as const;

/**
 * @deprecated Use FINANCIAL_PROFILE_OWNER_SELECT para consultas autenticadas do dono/admin ou FINANCIAL_PROFILE_SAFE_SELECT para públicas/sanitizadas.
 */
export const FINANCIAL_PROFILE_PUBLIC_SELECT = FINANCIAL_PROFILE_OWNER_SELECT;
