import { Injectable } from '@nestjs/common';

/**
 * Validador de assinaturas binárias (Magic Bytes) de arquivos de imagem.
 * Impede que arquivos maliciosos ou não-imagem com mimetype forjado sejam processados.
 */
@Injectable()
export class ValidateImage {
  /**
   * Verifica se o buffer corresponde a uma assinatura de imagem válida (JPEG, PNG ou WEBP).
   */
  isValidImageMagicBytes(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 12) {
      return false;
    }

    // 1. JPEG: FF D8 FF
    const isJpeg =
      buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (isJpeg) return true;

    // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    if (isPng) return true;

    // 3. WEBP: RIFF (bytes 0..3) + WEBP (bytes 8..11)
    const isWebp =
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50;
    if (isWebp) return true;

    return false;
  }
}
