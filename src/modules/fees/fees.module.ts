import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FeesService } from './fees.service';

@Module({
  imports: [PrismaModule],
  providers: [FeesService],
  exports: [FeesService],
})
export class FeesModule {}
