import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '@config/env';
import type { IAuthUser } from '@common/interfaces';

export type AccessTokenPayload = IAuthUser;

export interface RefreshTokenPayload {
  sub: string; // userId
  jti: string; // refresh_tokens.id — ใช้ตรวจสอบ/revoke รายตัวใน DB
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
