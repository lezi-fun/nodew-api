import { createHmac, randomBytes } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32_LOOKUP = new Map(BASE32_ALPHABET.split('').map((char, index) => [char, index] as const));

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const BACKUP_CODE_LENGTH = 8;
const BACKUP_CODE_COUNT = 4;
const BACKUP_CODE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const toBase32 = (buffer: Buffer) => {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
      value &= (1 << bits) - 1;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

const fromBase32 = (value: string) => {
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, '');

  if (!clean) {
    throw new Error('Invalid TOTP secret');
  }

  let bits = 0;
  let buffer = 0;
  const output: number[] = [];

  for (const char of clean) {
    const encoded = BASE32_LOOKUP.get(char);

    if (encoded === undefined) {
      throw new Error('Invalid TOTP secret');
    }

    buffer = (buffer << 5) | encoded;
    bits += 5;

    if (bits >= 8) {
      output.push((buffer >> (bits - 8)) & 0xff);
      bits -= 8;
      buffer &= (1 << bits) - 1;
    }
  }

  return Buffer.from(output);
};

const toCounterBuffer = (counter: bigint) => {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(counter);

  return buffer;
};

const generateHotp = (secret: string, counter: bigint) => {
  const hmac = createHmac('sha1', fromBase32(secret)).update(toCounterBuffer(counter)).digest();
  const offset = hmac[19]! & 0x0f;
  const binary = ((hmac[offset]! & 0x7f) << 24)
    | ((hmac[offset + 1]! & 0xff) << 16)
    | ((hmac[offset + 2]! & 0xff) << 8)
    | (hmac[offset + 3]! & 0xff);
  const otp = binary % 10 ** TOTP_DIGITS;

  return otp.toString().padStart(TOTP_DIGITS, '0');
};

export const generateTotpSecret = () => toBase32(randomBytes(20));

export const generateTotpCode = (secret: string, timestamp = Date.now()) => {
  const counter = BigInt(Math.floor(timestamp / (TOTP_PERIOD_SECONDS * 1000)));

  return generateHotp(secret, counter);
};

export const validateTotpCode = (secret: string, code: string, options?: { timestamp?: number; window?: number }) => {
  const cleanCode = code.replace(/\s+/g, '').trim();

  if (!/^\d{6}$/.test(cleanCode)) {
    return false;
  }

  const timestamp = options?.timestamp ?? Date.now();
  const window = options?.window ?? 1;
  const counter = Math.floor(timestamp / (TOTP_PERIOD_SECONDS * 1000));

  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = counter + offset;

    if (candidate < 0) {
      continue;
    }

    if (generateHotp(secret, BigInt(candidate)) === cleanCode) {
      return true;
    }
  }

  return false;
};

export const buildOtpAuthUri = (params: { secret: string; issuer: string; accountName: string }) => {
  const issuer = params.issuer.trim() || 'NodEW-api';
  const accountName = params.accountName.trim();
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;

  return `otpauth://totp/${label}?secret=${encodeURIComponent(params.secret)}&issuer=${encodeURIComponent(issuer)}&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
};

const generateBackupCodeValue = () => {
  const bytes = randomBytes(BACKUP_CODE_LENGTH);
  const raw = Array.from(bytes, (byte) => BACKUP_CODE_CHARSET[byte % BACKUP_CODE_CHARSET.length] ?? 'A').join('');

  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
};

export const generateBackupCodes = (count = BACKUP_CODE_COUNT) => {
  const codes = new Set<string>();

  while (codes.size < count) {
    codes.add(generateBackupCodeValue());
  }

  return [...codes];
};

export const normalizeBackupCode = (code: string) => {
  const normalized = code.toUpperCase().replace(/[\s-]/g, '');

  if (normalized.length !== BACKUP_CODE_LENGTH) {
    return code.trim().toUpperCase();
  }

  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
};

export const isValidBackupCodeFormat = (code: string) => {
  const normalized = code.toUpperCase().replace(/[\s-]/g, '');

  if (normalized.length !== BACKUP_CODE_LENGTH) {
    return false;
  }

  return /^[A-Z0-9]+$/.test(normalized);
};
