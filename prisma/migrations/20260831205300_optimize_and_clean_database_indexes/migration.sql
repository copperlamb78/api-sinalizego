-- DropIndex
DROP INDEX "transactions_appointmentId_idx";

-- DropIndex
DROP INDEX "transactions_asaasPaymentId_idx";

-- DropIndex
DROP INDEX "webhook_events_eventId_idx";

-- CreateIndex
CREATE INDEX "Appointment_serviceId_idx" ON "Appointment"("serviceId");

-- CreateIndex
CREATE INDEX "Appointment_companyId_appointmentDate_idx" ON "Appointment"("companyId", "appointmentDate");

-- CreateIndex
CREATE INDEX "Company_userId_idx" ON "Company"("userId");

-- CreateIndex
CREATE INDEX "FinancialProfile_userId_idx" ON "FinancialProfile"("userId");

-- CreateIndex
CREATE INDEX "ScheduleException_companyId_date_idx" ON "ScheduleException"("companyId", "date");

-- CreateIndex
CREATE INDEX "Service_companyId_idx" ON "Service"("companyId");

-- CreateIndex
CREATE INDEX "Service_serviceGroupId_idx" ON "Service"("serviceGroupId");

-- CreateIndex
CREATE INDEX "ServiceGroup_companyId_idx" ON "ServiceGroup"("companyId");

-- CreateIndex
CREATE INDEX "transactions_barberWalletId_idx" ON "transactions"("barberWalletId");

-- CreateIndex
CREATE INDEX "transactions_customerId_idx" ON "transactions"("customerId");
