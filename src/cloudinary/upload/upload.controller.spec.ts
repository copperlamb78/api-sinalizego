import { Test, TestingModule } from '@nestjs/testing';
import { UploadController } from './upload.controller';
import { CloudinaryService } from '../cloudinary.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidateImage } from 'src/helpers/validate-image.helper';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

describe('UploadController', () => {
  let controller: UploadController;
  let cloudinaryService: CloudinaryService;
  let prisma: PrismaService;
  let validateImage: ValidateImage;

  const mockCloudinaryService = {
    uploadImage: jest.fn(),
  };

  const mockPrisma = {
    company: {
      findUnique: jest.fn(),
    },
  };

  const mockValidateImage = {
    isValidImageMagicBytes: jest.fn(),
  };

  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'foto.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: validJpegBuffer,
    size: 1024,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  const mockCompany = {
    id: 'company-1',
    userId: 'owner-1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        {
          provide: CloudinaryService,
          useValue: mockCloudinaryService,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ValidateImage,
          useValue: mockValidateImage,
        },
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
    cloudinaryService = module.get<CloudinaryService>(CloudinaryService);
    prisma = module.get<PrismaService>(PrismaService);
    validateImage = module.get<ValidateImage>(ValidateImage);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadImage', () => {
    it('should throw BadRequestException if file is missing', async () => {
      const req = { user: { sub: 'owner-1', role: Role.COMPANY_OWNER } };
      await expect(
        controller.uploadImage(null as any, 'company-1', 'logo', req),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if imageType is invalid', async () => {
      const req = { user: { sub: 'owner-1', role: Role.COMPANY_OWNER } };
      await expect(
        controller.uploadImage(mockFile, 'company-1', 'avatar' as any, req),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if company does not exist', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);
      const req = { user: { sub: 'owner-1', role: Role.COMPANY_OWNER } };

      await expect(
        controller.uploadImage(mockFile, 'company-not-found', 'logo', req),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not company owner (Anti-IDOR)', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(mockCompany); // owner-1
      const req = { user: { sub: 'attacker-user', role: Role.COMPANY_OWNER } };

      await expect(
        controller.uploadImage(mockFile, 'company-1', 'logo', req),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if file mimetype is invalid', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
      const req = { user: { sub: 'owner-1', role: Role.COMPANY_OWNER } };
      const invalidMimeFile = {
        ...mockFile,
        mimetype: 'application/pdf',
      };

      await expect(
        controller.uploadImage(invalidMimeFile, 'company-1', 'logo', req),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if magic bytes validation fails (fake image content)', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
      mockValidateImage.isValidImageMagicBytes.mockReturnValue(false);
      const req = { user: { sub: 'owner-1', role: Role.COMPANY_OWNER } };

      await expect(
        controller.uploadImage(mockFile, 'company-1', 'logo', req),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully upload image for company owner when valid', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
      mockValidateImage.isValidImageMagicBytes.mockReturnValue(true);
      mockCloudinaryService.uploadImage.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/logo.jpg',
        public_id: 'sinalizego/company-1/logo/12345',
      });

      const req = { user: { sub: 'owner-1', role: Role.COMPANY_OWNER } };

      const result = await controller.uploadImage(
        mockFile,
        'company-1',
        'logo',
        req,
      );

      expect(mockCloudinaryService.uploadImage).toHaveBeenCalledWith(
        mockFile,
        'sinalizego/company-1/logo',
      );
      expect(result).toEqual({
        url: 'https://res.cloudinary.com/demo/image/upload/v1/logo.jpg',
        publicId: 'sinalizego/company-1/logo/12345',
      });
    });

    it('should allow system manager (ADMIN / SUPER_ADMIN) to upload even if not the owner', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
      mockValidateImage.isValidImageMagicBytes.mockReturnValue(true);
      mockCloudinaryService.uploadImage.mockResolvedValue({
        secure_url:
          'https://res.cloudinary.com/demo/image/upload/v1/banner.jpg',
        public_id: 'sinalizego/company-1/banner/12345',
      });

      const req = { user: { sub: 'admin-user', role: Role.ADMIN } };

      const result = await controller.uploadImage(
        mockFile,
        'company-1',
        'banner',
        req,
      );

      expect(result.url).toBe(
        'https://res.cloudinary.com/demo/image/upload/v1/banner.jpg',
      );
    });
  });
});
