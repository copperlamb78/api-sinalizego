import { CryptoHelper } from './crypto.helper';

describe('CryptoHelper (AES-256-GCM)', () => {
  const secretData = '$aact_YTU5YTE0M2NmN2Y5...secret_api_key_12345';

  beforeAll(() => {
    process.env.ENCRYPTION_SECRET = 'test-secret-key-12345';
  });

  afterAll(() => {
    delete process.env.ENCRYPTION_SECRET;
  });

  it('should encrypt plaintext into iv:authTag:ciphertext format', () => {
    const encrypted = CryptoHelper.encrypt(secretData);
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toEqual(secretData);

    const parts = encrypted.split(':');
    expect(parts.length).toBe(3);
    expect(parts[0].length).toBe(32); // 16 bytes = 32 hex chars (IV)
    expect(parts[1].length).toBe(32); // 16 bytes = 32 hex chars (Auth Tag)
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('should decrypt encrypted text back to original plaintext', () => {
    const encrypted = CryptoHelper.encrypt(secretData);
    const decrypted = CryptoHelper.decrypt(encrypted);
    expect(decrypted).toBe(secretData);
  });

  it('should handle empty strings gracefully', () => {
    expect(CryptoHelper.encrypt('')).toBe('');
    expect(CryptoHelper.decrypt('')).toBe('');
  });

  it('should return original text if ciphertext is not in iv:authTag:data format (legacy fallback)', () => {
    const legacyPlaintext = 'legacy_plain_key';
    expect(CryptoHelper.decrypt(legacyPlaintext)).toBe(legacyPlaintext);
  });

  it('should return original ciphertext if auth tag fails during decryption', () => {
    const encrypted = CryptoHelper.encrypt(secretData);
    const [iv, , data] = encrypted.split(':');
    const tamperedAuthTag = '00000000000000000000000000000000';
    const tampered = `${iv}:${tamperedAuthTag}:${data}`;

    expect(CryptoHelper.decrypt(tampered)).toBe(tampered);
  });
});
