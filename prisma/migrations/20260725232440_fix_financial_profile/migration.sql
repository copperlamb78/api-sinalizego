-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "financialProfileId" TEXT;

-- CreateTable
CREATE TABLE "FinancialProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cpfCnpj" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "companyType" TEXT,
    "mobilePhone" TEXT NOT NULL,
    "incomeValue" DOUBLE PRECISION NOT NULL,
    "address" TEXT NOT NULL,
    "addressNumber" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "asaasApiKey" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialProfile_cpfCnpj_key" ON "FinancialProfile"("cpfCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialProfile_walletId_key" ON "FinancialProfile"("walletId");

-- RenameForeignKey
ALTER TABLE "Appointment" RENAME CONSTRAINT "Appointment_providerId_fkey" TO "Appointment_companyId_fkey";

-- RenameForeignKey
ALTER TABLE "Company" RENAME CONSTRAINT "Provider_userId_fkey" TO "Company_userId_fkey";

-- RenameForeignKey
ALTER TABLE "ScheduleException" RENAME CONSTRAINT "ScheduleException_providerId_fkey" TO "ScheduleException_companyId_fkey";

-- RenameForeignKey
ALTER TABLE "Service" RENAME CONSTRAINT "Service_providerId_fkey" TO "Service_companyId_fkey";

-- RenameForeignKey
ALTER TABLE "WorkingHour" RENAME CONSTRAINT "WorkingHour_providerId_fkey" TO "WorkingHour_companyId_fkey";

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_financialProfileId_fkey" FOREIGN KEY ("financialProfileId") REFERENCES "FinancialProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProfile" ADD CONSTRAINT "FinancialProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
