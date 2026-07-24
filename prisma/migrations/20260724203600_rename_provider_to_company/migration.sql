/*
  Warnings:

  - The values [PROVIDER] on the enum `Role` will be removed.
  - Renaming `Provider` table to `Company`.
  - Renaming `providerId` columns to `companyId`.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'COMPANY_OWNER';

-- Rename Table
ALTER TABLE "Provider" RENAME TO "Company";

-- Rename Columns
ALTER TABLE "Service" RENAME COLUMN "providerId" TO "companyId";
ALTER TABLE "Appointment" RENAME COLUMN "providerId" TO "companyId";
ALTER TABLE "WorkingHour" RENAME COLUMN "providerId" TO "companyId";
ALTER TABLE "ScheduleException" RENAME COLUMN "providerId" TO "companyId";

-- Rename Indexes & Constraints
ALTER INDEX "Provider_pkey" RENAME TO "Company_pkey";
ALTER INDEX "Provider_slug_key" RENAME TO "Company_slug_key";
ALTER INDEX "WorkingHour_providerId_dayOfWeek_key" RENAME TO "WorkingHour_companyId_dayOfWeek_key";
