import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../cloudinary.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/jwt/guard/jwt-auth.guard';
import { Roles } from 'src/modules/auth/roles/decorators/roles.decorator';
import { INTERNAL_NO_EMPLOYEE } from 'src/common/constants/role-groups.constant';

@ApiTags('Uploads')
@Controller('upload')
export class UploadController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Post('image/:providerId/:imageType')
  @ApiOperation({
    summary: 'Faz upload de imagem dinamicamente para o negócio',
  })
  @ApiParam({ name: 'providerId', description: 'ID do negócio (Provider)' })
  @ApiParam({
    name: 'imageType',
    description: 'Tipo da imagem (ex: logo, banner, service)',
  })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Param('providerId') providerId: string,
    @Param('imageType') imageType: 'logo' | 'banner' | 'service',
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo de imagem foi enviado.');
    }

    const allowedTypes = ['logo', 'banner', 'service'];
    if (!allowedTypes.includes(imageType)) {
      throw new BadRequestException(
        'O imageType deve ser: logo, banner ou service.',
      );
    }

    if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
      throw new BadRequestException(
        'Formato de imagem inválido. Use JPG, PNG ou WEBP.',
      );
    }

    const folderPath = `sinalizego/${providerId}/${imageType}`;

    const result = await this.cloudinaryService.uploadImage(file, folderPath);

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }
}
