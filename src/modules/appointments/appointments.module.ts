import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { AvailabilityService } from './availability.service';
import { CalculateTax } from 'src/helpers/calculate-tax.helper';
import { CalculateDeposit } from 'src/helpers/calculate-deposit.helper';
import { AsaasModule } from 'src/asaas/asaas.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [AsaasModule, MailModule],
  providers: [
    AppointmentsService,
    AvailabilityService,
    CalculateTax,
    CalculateDeposit,
  ],
  controllers: [AppointmentsController],
  exports: [AppointmentsService, AvailabilityService],
})
export class AppointmentsModule {}
