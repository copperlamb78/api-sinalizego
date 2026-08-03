/*
  Warnings:

  - You are about to drop the column `availableEmployers` on the `Service` table. All the data in the column will be lost.
  - Added the required column `serviceGroupId` to the `Service` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Service" DROP COLUMN "availableEmployers",
ADD COLUMN     "serviceGroupId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ServiceGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ServiceGroup_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ServiceGroup" ADD CONSTRAINT "ServiceGroup_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_serviceGroupId_fkey" FOREIGN KEY ("serviceGroupId") REFERENCES "ServiceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
