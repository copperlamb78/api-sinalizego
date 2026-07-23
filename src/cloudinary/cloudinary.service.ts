import { Injectable, BadRequestException } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import 'multer';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  async uploadImage(
    file: Express.Multer.File,
    folderPath: string,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: folderPath },
        (error, result) => {
          if (error) return reject(error);

          if (!result)
            return reject(
              new BadRequestException(
                'Cloudinary não retornou nenhum resultado',
              ),
            );
          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}
