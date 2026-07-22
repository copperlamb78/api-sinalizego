import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { CalculateTax } from 'src/helpers/calculate-tax.helper';

@Module({
  providers: [AppointmentsService, CalculateTax],
  controllers: [AppointmentsController],
})
export class AppointmentsModule {}
