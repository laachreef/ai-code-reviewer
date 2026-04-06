import fs from 'fs';
import path from 'path';
import os from 'os';
import { safeStorage } from 'electron';

const CONFIG_DIR = path.join(os.homedir(), '.code-review-tool');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const SENSITIVE_FIELDS = ['token', 'llmApiKey', 'geminiKey'];
const ENCRYPTED_PREFIX = 'enc::';

function encryptValue(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) return value;
  const encrypted = safeStorage.encryptString(value);
  return ENCRYPTED_PREFIX + encrypted.toString('base64');
}

function decryptValue(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;
  if (!safeStorage.isEncryptionAvailable()) return '';
  const buffer = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), 'base64');
  return safeStorage.decryptString(buffer);
}

function encryptCustomProviders(providers: any[]): any[] {
  if (!providers || !Array.isArray(providers)) return [];
  return providers.map(p => {
    const encrypted = { ...p };
    if (p.apiKey && typeof p.apiKey === 'string') {
      encrypted.apiKey = encryptValue(p.apiKey);
    }
    return encrypted;
  });
}

function decryptCustomProviders(providers: any[]): any[] {
  if (!providers || !Array.isArray(providers)) return [];
  return providers.map(p => {
    const decrypted = { ...p };
    if (p.apiKey && typeof p.apiKey === 'string' && p.apiKey.startsWith(ENCRYPTED_PREFIX)) {
      decrypted.apiKey = decryptValue(p.apiKey);
    }
    return decrypted;
  });
}

export function getConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

  let needsMigration = false;
  for (const field of SENSITIVE_FIELDS) {
    if (raw[field] && typeof raw[field] === 'string') {
      if (!raw[field].startsWith(ENCRYPTED_PREFIX)) {
        needsMigration = true;
      } else {
        raw[field] = decryptValue(raw[field]);
      }
    }
  }

  if (raw.customProviders) {
    raw.customProviders = decryptCustomProviders(raw.customProviders);
  }

  if (needsMigration && safeStorage.isEncryptionAvailable()) {
    saveConfig(raw);
  }

  return raw;
}

export function saveConfig(config: any) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

  const toWrite = { ...config };

  for (const field of SENSITIVE_FIELDS) {
    if (toWrite[field] && typeof toWrite[field] === 'string') {
      toWrite[field] = encryptValue(toWrite[field]);
    }
  }

  if (toWrite.customProviders && Array.isArray(toWrite.customProviders)) {
    toWrite.customProviders = encryptCustomProviders(toWrite.customProviders);
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
  const updatedHistory = [historyItem, ...currentHistory].slice(0, 50);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(updatedHistory, null, 2));
  return updatedHistory;
}
