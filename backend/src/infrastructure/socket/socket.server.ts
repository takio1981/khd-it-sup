import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { verifyAccessToken } from '@common/utils/jwt.util';
import { corsOriginResolver } from '@common/utils/cors.util';
import { logger } from '@infrastructure/logger/logger';

let io: SocketIOServer | null = null;

/**
 * เริ่มต้น Socket.IO server แนบกับ HTTP server เดียวกับ Express (ไม่ใช้ port แยก)
 * Client ต้องส่ง JWT access token ผ่าน `auth: { token }` ตอน connect — ห้อง (room) แยกตาม userId
 * เพื่อให้ NotificationService ยิง event ไปหาผู้ใช้ที่เกี่ยวข้องเท่านั้น (ดู Phase 4: modules/notifications)
 */
export function initializeSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: corsOriginResolver, credentials: true },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        next(new Error('UNAUTHORIZED'));
        return;
      }
      const user = verifyAccessToken(token);
      socket.data.user = user;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.user?.id as string | undefined;
    if (userId) {
      socket.join(`user:${userId}`);
    }
    logger.debug(`[socket] client connected: ${socket.id} (user: ${userId ?? 'unknown'})`);

    socket.on('disconnect', () => {
      logger.debug(`[socket] client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO server has not been initialized yet — call initializeSocketServer() first');
  }
  return io;
}

/** ยิง event ไปหาผู้ใช้รายคน (ใช้โดย NotificationService/WorkflowService เมื่อสถานะ ticket เปลี่ยน) */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  getSocketServer().to(`user:${userId}`).emit(event, payload);
}
