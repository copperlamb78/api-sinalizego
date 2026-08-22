/**
 * Projeção segura de campos públicos do modelo FinancialProfile.
 * NUNCA inclui campos sensíveis como `asaasApiKey`.
 */
export const FINANCIAL_PROFILE_PUBLIC_SELECT = {
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
