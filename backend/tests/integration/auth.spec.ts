import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '@infrastructure/database/prisma';

/**
 * Integration test นี้ต้องมี MariaDB ที่ apply database/schema.sql + database/seed.sql แล้วรันอยู่จริง
 * (ตาม DATABASE_URL ใน backend/.env) — ดู docs/06-installation-guide.md สำหรับวิธีตั้งค่า
 */
const app = createApp();

describe('Auth API (integration)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /health ตอบ 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('POST /api/v1/auth/login ด้วยรหัสผ่านผิด ตอบ 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/login ด้วยข้อมูลถูกต้อง ตอบ 200 พร้อม accessToken และ permissions', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@12345' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.role).toBe('SUPER_ADMIN');
    expect(res.body.data.user.permissions).toEqual(expect.arrayContaining(['user:read', 'asset:create']));
    expect(res.headers['set-cookie']?.[0]).toMatch(/khd_refresh_token=/);
  });

  it('GET /api/v1/auth/me ไม่มี token ตอบ 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/auth/me มี token ที่ถูกต้อง ตอบข้อมูลผู้ใช้', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'Admin@12345' });
    const token = login.body.data.accessToken as string;

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('admin');
  });

  it('เข้าถึง route ที่ต้อง permission โดยไม่มี token ตอบ 401 ไม่ใช่ 403', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
  });
});
