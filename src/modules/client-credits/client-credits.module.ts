import { Module } from '@nestjs/common';
import { ClientCreditsService } from './client-credits.service';
import { ClientCreditsController } from './client-credits.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClientCreditsController],
  providers: [ClientCreditsService],
  exports: [ClientCreditsService],
})
export class ClientCreditsModule {}
