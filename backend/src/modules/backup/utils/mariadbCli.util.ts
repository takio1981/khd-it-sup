import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { env } from '@config/env';
import { logger } from '@infrastructure/logger/logger';

const execFileAsync = promisify(execFile);

interface IDbConnectionParts {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

let cachedConnectionParts: IDbConnectionParts | null = null;

/** parse DATABASE_URL เดิม (khd_app — มี ALL PRIVILEGES บน khd_it_sup.* อยู่แล้ว ดู docs/06-installation-guide.md)
 * แทนการสร้าง MariaDB user ใหม่ — ไม่เพิ่ม secret ใหม่เข้าระบบ */
function parseDatabaseUrl(): IDbConnectionParts {
  if (cachedConnectionParts) return cachedConnectionParts;
  const url = new URL(env.DATABASE_URL);
  cachedConnectionParts = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  };
  return cachedConnectionParts;
}

type BinaryKind = 'dump' | 'client';

/** ชื่อ binary รุ่นใหม่ (mariadb-*) ก่อน แล้ว fallback ชื่อเก่า (mysql*) เผื่อเครื่อง dev ยังลงเวอร์ชันเก่าอยู่ */
const BINARY_CANDIDATES: Record<BinaryKind, readonly string[]> = {
  dump: ['mariadb-dump', 'mysqldump'],
  client: ['mariadb', 'mysql'],
};

const resolvedBinaryCache = new Map<BinaryKind, string | null>();

async function resolveBinary(kind: BinaryKind): Promise<string | null> {
  if (resolvedBinaryCache.has(kind)) return resolvedBinaryCache.get(kind) ?? null;
  for (const candidate of BINARY_CANDIDATES[kind]) {
    try {
      await execFileAsync(candidate, ['--version']);
      resolvedBinaryCache.set(kind, candidate);
      return candidate;
    } catch {
      // ลองชื่อถัดไป
    }
  }
  resolvedBinaryCache.set(kind, null);
  return null;
}

/** ใช้แสดง banner เตือนใน GET /backup/status — ตอน dev (backend รันนอก Docker บน Windows host) ต้องพึ่ง binary
 * ที่ติดตั้งไว้ใน PATH ของเครื่องเอง ต่างจาก production ที่ Dockerfile ติดตั้ง mariadb-client ให้เสมอ */
export async function isMariadbClientAvailable(): Promise<boolean> {
  const [dumpBin, clientBin] = await Promise.all([resolveBinary('dump'), resolveBinary('client')]);
  return Boolean(dumpBin && clientBin);
}

/** เขียนไฟล์ --defaults-extra-file ชั่วคราวเก็บ credential แทนการส่งผ่าน argv (เห็นได้จาก process list แม้ใน
 * container เดียวกัน) — mode 0600 + อยู่ใน temp dir เฉพาะกิจของตัวเอง ลบทิ้งใน finally เสมอ */
async function writeDefaultsExtraFile(parts: IDbConnectionParts): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'khd-backup-'));
  const filePath = path.join(tmpDir, `${randomUUID()}.cnf`);
  const content = `[client]\nuser=${parts.user}\npassword=${parts.password}\nhost=${parts.host}\nport=${parts.port}\n`;
  await fs.writeFile(filePath, content, { mode: 0o600 });
  return filePath;
}

async function cleanupDefaultsExtraFile(filePath: string): Promise<void> {
  try {
    await fs.rm(path.dirname(filePath), { recursive: true, force: true });
  } catch (err) {
    logger.warn(`[backup] ลบไฟล์ credential ชั่วคราวไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export interface IDumpOptions {
  /** รายชื่อตาราง — ไม่ระบุ (undefined) หรือ array ว่าง = dump ทั้งฐานข้อมูล */
  tables?: readonly string[];
  outputPath: string;
}

/**
 * รัน mariadb-dump แล้ว pipe ผลลัพธ์ลงไฟล์ปลายทางแบบ streaming (ไม่ buffer ทั้งก้อนเข้า memory)
 * ใช้ spawn + array arguments เท่านั้น (ห้าม exec แบบ string interpolation) เพื่อกัน command injection —
 * defense-in-depth ชั้นที่ 2 ต่อจาก zod allowlist ใน dto/backup.dto.ts (ชั้นที่ 1)
 */
export async function runDump(options: IDumpOptions): Promise<void> {
  const binary = await resolveBinary('dump');
  if (!binary) {
    throw new Error('ไม่พบโปรแกรม mariadb-dump/mysqldump บนเครื่องนี้ กรุณาติดตั้ง MariaDB Client Tools ก่อนใช้งานฟีเจอร์นี้');
  }
  const parts = parseDatabaseUrl();
  const defaultsFile = await writeDefaultsExtraFile(parts);

  try {
    const args = [
      `--defaults-extra-file=${defaultsFile}`,
      '--single-transaction',
      '--quick',
      '--routines',
      '--triggers',
      '--events',
      parts.database,
      ...(options.tables && options.tables.length > 0 ? options.tables : []),
    ];

    await new Promise<void>((resolve, reject) => {
      const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      const out = createWriteStream(options.outputPath);
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.stdout.pipe(out);
      child.on('error', reject);
      out.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`mariadb-dump จบการทำงานด้วยรหัส ${code}: ${stderr.slice(0, 2000)}`));
      });
    });
  } finally {
    await cleanupDefaultsExtraFile(defaultsFile);
  }
}

export interface IRestoreOptions {
  inputPath: string;
}

/** รัน mariadb client แล้ว pipe ไฟล์ SQL dump เข้า stdin แบบ streaming (ไม่ buffer ทั้งไฟล์เข้า memory) */
export async function runRestore(options: IRestoreOptions): Promise<void> {
  const binary = await resolveBinary('client');
  if (!binary) {
    throw new Error('ไม่พบโปรแกรม mariadb/mysql บนเครื่องนี้ กรุณาติดตั้ง MariaDB Client Tools ก่อนใช้งานฟีเจอร์นี้');
  }
  const parts = parseDatabaseUrl();
  const defaultsFile = await writeDefaultsExtraFile(parts);

  try {
    const args = [`--defaults-extra-file=${defaultsFile}`, parts.database];

    await new Promise<void>((resolve, reject) => {
      const child = spawn(binary, args, { stdio: ['pipe', 'ignore', 'pipe'] });
      const input = createReadStream(options.inputPath);
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      input.pipe(child.stdin);
      child.on('error', reject);
      input.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`mariadb จบการทำงานด้วยรหัส ${code}: ${stderr.slice(0, 2000)}`));
      });
    });
  } finally {
    await cleanupDefaultsExtraFile(defaultsFile);
  }
}
