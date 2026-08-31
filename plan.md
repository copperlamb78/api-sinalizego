1. **WP-01: Decouple Split from Gateway Cost in `src/asaas/asaas.service.ts`**
   - **Action**: In `createPixChargeWithSplit`, modify `barberAsaasFee` to use `BARBER_ASAAS_PIX_FEE` instead of `this.asaasPixFee`.
   - **Verification**: Run `cat src/asaas/asaas.service.ts` to verify the change.

2. **WP-02: Beneficiary Bank and Pix Key**
   - **Action**: Update `prisma/schema.prisma` to add `pixAddressKey` (String?) and `pixAddressKeyType` (String?) to `FinancialProfile`.
   - **Action**: Update `src/modules/financial-profile/dto/create-financial-profile.dto.ts` to include `pixAddressKey` and `pixAddressKeyType` with class-validator decorators.
   - **Action**: Update `src/modules/company/company.service.ts` to query `pixAddressKey` and `pixAddressKeyType` from `FinancialProfile` in `requestInstantWithdrawal` and `executeWeeklyFreePayouts`. If missing, throw a `BadRequestException`.
   - **Action**: Update `src/asaas/asaas.service.ts` `transferSubaccountBalance` to accept `pixAddressKeyType` and pass both `pixAddressKey` and `pixAddressKeyType` to the Asaas API payload.
   - **Verification**: Run `npx prisma generate` to apply schema. Use `read_file` to verify updates in the 3 files.

3. **WP-03: Net Balance in Ledger (`src/modules/company/company.service.ts`)**
   - **Action**: In `getCompanyBalance`, replace `completedAgg` and `escrowAgg` (which aggregate `Appointment.downPaymentAmount`) with new Prisma queries aggregating `Transaction.netValue`. The query will filter by `TransactionStatus.CONFIRMED`, `TransactionType.DEPOSIT`, and `appointment.status` (`COMPLETED` for available balance, `CONFIRMED` for escrow).
   - **Action**: In `getDashboardMetrics`, update the balance calculation logic to also use `Transaction.netValue` by aggregating from confirmed transactions instead of using `completedDepositsNet` derived from `downPaymentAmount`.
   - **Verification**: Use `read_file` to verify the query aggregations.

4. **WP-04 & WP-05: Withdrawal Fee Transparency**
   - **Action**: Add `ASAAS_MASTER_WALLET_ID` to `.env.example`.
   - **Action**: In `src/asaas/asaas.service.ts`, add `getTransferFee()` that fetches `transfer.pix.feeValue` dynamically from Asaas via `GET /v3/myAccount/fees`. Use `this.headers` for auth.
   - **Action**: In `src/modules/company/company.service.ts` `requestInstantWithdrawal`, call `asaasService.getTransferFee()` instead of using the hardcoded `ASAAS_TRANSFER_FEE = 5.0` to calculate `transferFee` and `netTransferred`.
   - **Action**: Modify `AsaasService.transferSubaccountBalance` to implement a two-hop process when `options?.isFreeWeekly` is true:
     1. Retrieve the master account wallet ID from `process.env.ASAAS_MASTER_WALLET_ID`. If missing, fallback to standard transfer.
     2. Transfer the amount from the subaccount to the master account via `POST ${this.apiUrl}/transfers` using `access_token: accountApiKey` and the master `walletId`.
     3. Transfer the amount from the master account to the destination Pix key via `POST ${this.apiUrl}/transfers` using `this.headers`. Return the response from this final transfer.
   - **Verification**: Use `read_file` to check `.env.example`, `asaas.service.ts`, and `company.service.ts`.

5. **WP-06 & WP-07: Error Handling for Refunds and Chargebacks**
   - **Action**: In `src/asaas/asaas.service.ts`, update `cancelPayment` and `refundPayment` to throw `InternalServerErrorException` instead of returning `false` on API errors.
   - **Action**: In `src/asaas/webhook-asaas/webhooks.service.ts` `handleAsaasEvent`, for the events `PAYMENT_CHARGEBACK_REQUESTED` and `PAYMENT_CHARGEBACK_DISPUTE`, calculate the negative balance by creating a new `Transaction` of type `WITHDRAWAL` with a negative value equal to the original `transaction.netValue` and setting `asaasFee` to 0.
   - **Verification**: Use `read_file` to verify error throws and chargeback logic.

6. **WP-09: Robustness and Idempotency of Webhooks**
   - **Action**: Create `src/asaas/webhook-asaas/dto/asaas-webhook.dto.ts` with a strongly typed DTO (`AsaasWebhookDto`).
   - **Action**: In `src/asaas/webhook-asaas/webhooks.controller.ts`, update the `handleAsaasWebhook` method to use `AsaasWebhookDto` instead of `any`.
   - **Action**: In `src/asaas/webhook-asaas/webhooks.service.ts` `handleAsaasEvent`, add a `try/catch` at the top level to catch errors, log them, and `return { received: true, error: err.message }` (HTTP 200). Ensure `PAYMENT_CONFIRMED` checks if `transaction.status` is already `REFUNDED` or `CANCELED` to prevent state regression.
   - **Verification**: Run `cat src/asaas/webhook-asaas/webhooks.service.ts`, `cat src/asaas/webhook-asaas/webhooks.controller.ts`, and `cat src/asaas/webhook-asaas/dto/asaas-webhook.dto.ts` to verify the code logic and file creation.

7. **WP-11a / WP-12: Anti-IDOR for Financial Routes**
   - **Action**: In `src/modules/company/company.service.ts` `getDashboardMetrics`, add a check to throw a `ForbiddenException` if `dto?.companyId` is provided and does not match the user's company ID when the user is not an `ADMIN` or `SUPER_ADMIN`.
   - **Verification**: Read the controller and service files to verify IDOR protections.

8. **Tests and Validation**
   - **Action**: Run `npm run lint` and `npm run test` to verify there are no syntax errors or test failures.
   - **Verification**: Ensure test command outputs success.

9. **Pre-commit and Submission**
   - **Action**: Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
   - **Action**: Execute `submit` to push the changes.
