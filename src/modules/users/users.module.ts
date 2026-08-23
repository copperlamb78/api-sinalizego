import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AsaasModule } from 'src/asaas/asaas.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [AsaasModule, MailModule],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
