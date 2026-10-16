import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailOutboxService } from './mail-outbox.service';

@Module({
  providers: [MailService, MailOutboxService],
  exports: [MailService, MailOutboxService],
})
export class MailModule {}
