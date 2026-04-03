import fs from 'fs';
import path from 'path';
import os from 'os';
import { safeStorage } from 'electron';

const CONFIG_DIR = path.join(os.homedir(), '.code-review-tool');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Fields that contain sensitive data and must be encrypted
const SENSITIVE_FIELDS = ['token', 'llmApiKey', 'geminiKey'];
// Prefix to identify encrypted values on disk
const ENCRYPTED_PREFIX = 'enc::';

function encryptValue(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) return value;
  const encrypted = safeStorage.encryptString(value);
  return ENCRYPTED_PREFIX + encrypted.toString('base64');
}

function decryptValue(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value; // plain text (legacy)
  if (!safeStorage.isEncryptionAvailable()) return ''; // cannot decrypt
  const buffer = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), 'base64');
  return safeStorage.decryptString(buffer);
}

export function getConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

  // Decrypt sensitive fields for in-memory use
  let needsMigration = false;
  for (const field of SENSITIVE_FIELDS) {
    if (raw[field] && typeof raw[field] === 'string') {
      if (!raw[field].startsWith(ENCRYPTED_PREFIX)) {
        // Legacy plain-text value detected — will re-encrypt on save
        needsMigration = true;
      } else {
        raw[field] = decryptValue(raw[field]);
      }
    }
  }

  // Auto-migrate: re-save with encryption if plain-text secrets were found
  if (needsMigration && safeStorage.isEncryptionAvailable()) {
    saveConfig(raw);
  }

  return raw;
}

export function saveConfig(config: any) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

  // Clone to avoid mutating the caller's object
  const toWrite = { ...config };

  // Encrypt sensitive fields before writing to disk
  for (const field of SENSITIVE_FIELDS) {
    if (toWrite[field] && typeof toWrite[field] === 'string') {
      toWrite[field] = encryptValue(toWrite[field]);
    }
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(toWrite, null, 2));
}

const HISTORY_FILE = path.join(CONFIG_DIR, 'history.json');

export function getHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

export function saveHistory(historyItem: any) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const currentHistory = getHistory();
  // Only keep the last 50 items to avoid bloating
  const updatedHistory = [historyItem, ...currentHistory].slice(0, 50);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(updatedHistory, null, 2));
  return updatedHistory;
}
