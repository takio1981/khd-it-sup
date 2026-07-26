// หมายเหตุ: ค่า env (JWT secrets ฯลฯ) โหลดจาก backend/.env โดย @config/env โดยอัตโนมัติ (ดู jest.config.ts + .env.example)
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '@common/utils/jwt.util';
import type { IAuthUser } from '@common/interfaces';

const sampleUser: IAuthUser = {
  id: 'u-1',
  username: 'tester',
  fullName: 'ผู้ทดสอบ',
  role: 'ADMIN',
  permissions: ['asset:read'],
  departmentId: null,
};

describe('jwt.util', () => {
  it('sign แล้ว verify access token กลับมาได้ข้อมูลเดิม', () => {
    const token = signAccessToken(sampleUser);
    const decoded = verifyAccessToken(token);
    expect(decoded.id).toBe(sampleUser.id);
    expect(decoded.role).toBe('ADMIN');
    expect(decoded.permissions).toEqual(['asset:read']);
  });

  it('sign แล้ว verify refresh token กลับมาได้ sub/jti เดิม', () => {
    const token = signRefreshToken({ sub: 'u-1', jti: 'token-id-1' });
    const decoded = verifyRefreshToken(token);
    expect(decoded.sub).toBe('u-1');
    expect(decoded.jti).toBe('token-id-1');
  });

  it('verifyAccessToken โยน error เมื่อ token ไม่ถูกต้อง', () => {
    expect(() => verifyAccessToken('invalid.token.value')).toThrow();
  });
});
