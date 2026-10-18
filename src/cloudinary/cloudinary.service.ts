import {
  Injectable,
  BadRequestException,
  BadGatewayException,
  Logger,
} from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import 'multer';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.replace(/['"]/g, '').trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.replace(/['"]/g, '').trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.replace(/['"]/g, '').trim();

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folderPath: string,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: folderPath },
        (error, result) => {
          if (error) {
            this.logger.error(
              `Erro no upload para o Cloudinary (folder: ${folderPath}): ${JSON.stringify(error)}`,
            );
            const detailMsg = error.message ? `: ${error.message}` : '';
            return reject(
              new BadGatewayException(
                `Erro ao processar o upload da imagem no servidor externo${detailMsg}.`,
              ),
            );
          }

          if (!result) {
            this.logger.error('Cloudinary não retornou nenhum resultado.');
            return reject(
              new BadRequestException(
                'Cloudinary não retornou nenhum resultado.',
              ),
            );
          }

          this.logger.log(`Imagem enviada com sucesso ao Cloudinary: ${result.secure_url}`);
          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}
