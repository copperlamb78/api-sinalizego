import { Module } from '@nestjs/common';
import { ServiceGroupService } from './service-group.service';
import { ServiceGroupController } from './service-group.controller';

@Module({
  controllers: [ServiceGroupController],
  providers: [ServiceGroupService],
})
export class ServiceGroupModule {}
