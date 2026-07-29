-- AlterTable
ALTER TABLE "FinancialProfile" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
