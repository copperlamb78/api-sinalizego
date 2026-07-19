import { Module } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { ProvidersController } from './providers.controller';
import { SlugHelper } from './helpers/create-slug.helper';

@Module({
  providers: [ProvidersService, SlugHelper],
  controllers: [ProvidersController],
})
export class ProvidersModule {}
