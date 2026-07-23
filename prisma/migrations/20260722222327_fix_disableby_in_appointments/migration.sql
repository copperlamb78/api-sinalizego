/*
  Warnings:

  - You are about to drop the column `canceledBy` on the `Provider` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "disabledBy" TEXT;

-- AlterTable
ALTER TABLE "Provider" DROP COLUMN "canceledBy";
