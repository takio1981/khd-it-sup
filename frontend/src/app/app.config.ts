import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { AuthService } from './core/services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    // silent refresh ก่อน router activate เสมอ เพื่อให้ authGuard ตัดสินใจจาก session จริงตั้งแต่ครั้งแรก
    provideAppInitializer(() => firstValueFrom(inject(AuthService).silentRefresh())),
    // cache เฉพาะไฟล์ static (JS/CSS/ไอคอน) ให้เปิดแอปซ้ำเร็วขึ้น + ติดตั้งเป็นแอปได้ — ไม่ cache ข้อมูล API เลย (ดู ngsw-config.json)
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:5000' }),
  ],
};
