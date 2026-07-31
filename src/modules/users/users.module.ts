import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AsaasModule } from 'src/asaas/asaas.module';

@Module({
  imports: [AsaasModule],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
