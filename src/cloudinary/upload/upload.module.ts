import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { CloudinaryModule } from '../cloudinary.module';
import { ValidateImage } from 'src/helpers/validate-image.helper';

@Module({
  imports: [CloudinaryModule],
  controllers: [UploadController],
  providers: [ValidateImage],
})
export class UploadModule {}
