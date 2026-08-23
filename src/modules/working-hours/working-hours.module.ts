import { Module } from '@nestjs/common';
import { WorkingHoursService } from './working-hours.service';
import { WorkingHoursController } from './working-hours.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkingHoursController],
  providers: [WorkingHoursService],
  exports: [WorkingHoursService],
})
export class WorkingHoursModule {}
