import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UseGuards,
  Param,
  Req,
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
import { RolesGuard } from 'src/modules/auth/roles/guard/roles.guard';
import { Roles } from 'src/modules/auth/roles/decorators/roles.decorator';
import {
  INTERNAL_NO_EMPLOYEE,
  SYSTEM_MANAGERS,
} from 'src/common/constants/role-groups.constant';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidateImage } from 'src/helpers/validate-image.helper';

@ApiTags('Uploads')
@Controller('upload')
export class UploadController {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly prisma: PrismaService,
    private readonly validateImage: ValidateImage,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Post('image/:companyId/:imageType')
  @ApiOperation({
    summary: 'Faz upload de imagem dinamicamente para a empresa',
  })
  @ApiParam({ name: 'companyId', description: 'ID da empresa (Company)' })
  @ApiParam({
    name: 'imageType',
    description: 'Tipo da imagem (ex: logo, banner, service)',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // Limite máximo de 5MB
    }),
  )
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
    @Param('companyId') companyId: string,
    @Param('imageType') imageType: 'logo' | 'banner' | 'service',
    @Req() req: any,
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

    // Proteção Anti-IDOR: Validação de posse da empresa
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    const isSystemManager = SYSTEM_MANAGERS.includes(req.user?.role);
    if (!isSystemManager && company.userId !== req.user?.sub) {
      throw new ForbiddenException(
        'Você não tem permissão para enviar imagens para esta empresa.',
      );
    }

    // Validação de formato declarado pelo cliente
    if (!file.mimetype || !file.mimetype.match(/\/(jpg|jpeg|png|webp)$/i)) {
      throw new BadRequestException(
        'Formato de imagem inválido. Use JPG, PNG ou WEBP.',
      );
    }

    // Validação real de integridade por Magic Bytes
    if (!this.validateImage.isValidImageMagicBytes(file.buffer)) {
      throw new BadRequestException(
        'O arquivo enviado não possui uma assinatura de imagem válida (JPG, PNG ou WEBP).',
      );
    }

    const folderPath = `sinalizego/${companyId}/${imageType}`;

    const result = await this.cloudinaryService.uploadImage(file, folderPath);

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }
}
