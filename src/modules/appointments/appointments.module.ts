import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { CalculateTax } from 'src/helpers/calculate-tax.helper';
import { CalculateDeposit } from 'src/helpers/calculate-deposit.helper';

@Module({
  providers: [AppointmentsService, CalculateTax, CalculateDeposit],
  controllers: [AppointmentsController],
})
export class AppointmentsModule {}
