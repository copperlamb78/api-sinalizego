import * as crypto from 'crypto';
import 'dotenv/config';

/**
 * Utilitário de Criptografia Simétrica em Repouso (AES-256-GCM).
 * Usado para proteger credenciais sensíveis como chaves de subcontas Asaas (`asaasApiKey`).
 */
export class CryptoHelper {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;

  private static getSecretKey(): Buffer {
    const secret =
      process.env.ENCRYPTION_SECRET ||
      process.env.JWT_SECRET ||
      'sinalizego-fallback-encryption-secret-32b';
    return crypto.createHash('sha256').update(String(secret)).digest();
  }

  /**
   * Criptografa uma string usando AES-256-GCM.
   * Retorna no formato seguro: "iv:authTag:encryptedData" (em hexadecimal).
   */
  static encrypt(plaintext: string): string {
    if (!plaintext) return '';

    const iv = crypto.randomBytes(this.IV_LENGTH);
    const key = this.getSecretKey();
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decriptografa uma string usando AES-256-GCM.
   * Valida a tag de autenticação para garantir integridade.
   */
  static decrypt(ciphertext: string): string {
    if (!ciphertext) return '';

    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      // Retorna o valor original caso seja dado legado não criptografado
      return ciphertext;
    }

    try {
      const [ivHex, authTagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const key = this.getSecretKey();

      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch {
      return ciphertext;
    }
  }
}
