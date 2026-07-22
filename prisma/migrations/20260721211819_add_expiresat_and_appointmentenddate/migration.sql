/*
  Warnings:

  - Added the required column `appointmentEndDate` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `downPaymentAmount` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platformFeeAmount` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `servicePrice` to the `Appointment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "appointmentEndDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "downPaymentAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "platformFeeAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "servicePrice" DOUBLE PRECISION NOT NULL;
