import { Test, TestingModule } from '@nestjs/testing';
import { ValidateImage } from './validate-image.helper';

describe('ValidateImage Helper', () => {
  let helper: ValidateImage;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidateImage],
    }).compile();

    helper = module.get<ValidateImage>(ValidateImage);
  });

  it('should be defined', () => {
    expect(helper).toBeDefined();
  });

  describe('isValidImageMagicBytes', () => {
    it('should return false for null, undefined, empty or short buffers', () => {
      expect(helper.isValidImageMagicBytes(null as any)).toBe(false);
      expect(helper.isValidImageMagicBytes(undefined as any)).toBe(false);
      expect(helper.isValidImageMagicBytes(Buffer.from([]))).toBe(false);
      expect(helper.isValidImageMagicBytes(Buffer.from([0xff, 0xd8]))).toBe(
        false,
      );
    });

    it('should return true for valid JPEG buffer', () => {
      // JPEG magic bytes: FF D8 FF
      const jpegHeader = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      ]);
      expect(helper.isValidImageMagicBytes(jpegHeader)).toBe(true);
    });

    it('should return true for valid PNG buffer', () => {
      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);
      expect(helper.isValidImageMagicBytes(pngHeader)).toBe(true);
    });

    it('should return true for valid WEBP buffer', () => {
      // WEBP: RIFF....WEBP
      const webpHeader = Buffer.from([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x00,
        0x00,
        0x00,
        0x00, // file size
        0x57,
        0x45,
        0x42,
        0x50, // WEBP
      ]);
      expect(helper.isValidImageMagicBytes(webpHeader)).toBe(true);
    });

    it('should return false for fake images (e.g. text/html/executable files with .jpg extension)', () => {
      const textFile = Buffer.from('<html><body>Fake Image</body></html>');
      expect(helper.isValidImageMagicBytes(textFile)).toBe(false);

      const exeFile = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00');
      expect(helper.isValidImageMagicBytes(exeFile)).toBe(false);
    });
  });
});
