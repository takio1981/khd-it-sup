import { Injectable, effect, inject, signal } from '@angular/core';
import { io, type Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface IInAppNotificationPayload {
  id: string;
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
}

/**
 * เชื่อมต่อ Socket.IO เมื่อ login แล้วเท่านั้น (ตัด connection ทันทีที่ logout) — ห้องแยกตาม userId ที่ backend
 * ผูกไว้แล้ว (ดู infrastructure/socket/socket.server.ts) จึงไม่ต้อง subscribe ห้องเองฝั่ง client
 * ใช้ effect() ตาม isAuthenticated()/access token แทนการเรียก connect() ตรง ๆ จากที่อื่น เพื่อไม่ให้มีจุดเรียกกระจัดกระจาย
 */
@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly authService = inject(AuthService);
  private socket: Socket | null = null;

  private readonly notificationSubject = new Subject<IInAppNotificationPayload>();
  readonly notification$ = this.notificationSubject.asObservable();

  readonly connected = signal(false);

  constructor() {
    effect(() => {
      const isAuthenticated = this.authService.isAuthenticated();
      const token = this.authService.getAccessToken();

      if (isAuthenticated && token) {
        this.connect(token);
      } else {
        this.disconnect();
      }
    });
  }

  private connect(token: string): void {
    if (this.socket?.connected) {
      // token อาจหมุนใหม่จาก silent refresh — อัปเดตไว้ใช้ตอน reconnect ครั้งถัดไป ไม่ต้องตัดการเชื่อมต่อปัจจุบันทิ้ง
      this.socket.auth = { token };
      return;
    }

    // socket.io-client ไม่ต่อ path prefix จาก url argument เข้ากับ HTTP path เอง (ต่างจาก HttpClient) —
    // ต้องพับ prefix ของ reverse proxy (เช่น "/khd-it-sup" ใน production) เข้าไปใน "path" option ตรง ๆ เอง
    // ไม่งั้น handshake จะยิงไปที่ "/socket.io" ที่ root ซึ่ง nginx ไม่รู้จัก (404) — ดู docker/nginx/nginx.conf
    const isAbsoluteUrl = /^https?:\/\//.test(environment.socketUrl);
    const pathPrefix = isAbsoluteUrl ? '' : environment.socketUrl.replace(/\/$/, '');
    const options = {
      path: `${pathPrefix}/socket.io`,
      auth: { token },
      transports: ['websocket', 'polling'],
    };

    this.socket = isAbsoluteUrl ? io(environment.socketUrl, options) : io(options);

    this.socket.on('connect', () => this.connected.set(true));
    this.socket.on('disconnect', () => this.connected.set(false));
    this.socket.on('notification:new', (payload: IInAppNotificationPayload) => this.notificationSubject.next(payload));
  }

  private disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }
}
