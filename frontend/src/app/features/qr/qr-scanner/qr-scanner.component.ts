import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import jsQR from 'jsqr';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { environment } from '../../../../environments/environment';

/** QR ที่พิมพ์ก่อนฟีเจอร์ short URL ยังฝัง URL เต็มแบบเดิมอยู่ {FRONTEND_BASE_URL}/qr/scan/{token} — เข้า route ในแอปได้ตรงๆ */
const LEGACY_SCAN_URL_TOKEN_PATTERN = /\/qr\/scan\/([^/?#]+)/;
/** QR ที่พิมพ์ใหม่ฝัง short URL {apiBaseUrl}/s/{shortCode} — backend เท่านั้นที่แปลง shortCode เป็น token ได้ (ดู qrcode.service.ts resolveShortUrl) จึงต้อง hard navigate ให้ browser ยิงไปจริงๆ ให้ /s/:shortCode ทำ 302 redirect เอง ไม่ resolve ฝั่ง client */
const SHORT_URL_PATTERN = new RegExp(`${environment.apiBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/s/([^/?#]+)`);
const INVALID_QR_MESSAGE_MS = 2500;

@Component({
  selector: 'khd-qr-scanner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatProgressSpinnerModule, IconComponent],
  templateUrl: './qr-scanner.component.html',
})
export class QrScannerComponent implements AfterViewInit, OnDestroy {
  private readonly router = inject(Router);

  @ViewChild('video') private readonly videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly starting = signal(true);
  readonly errorMessage = signal<string | null>(null);
  /** true = กล้องเปิดไม่สำเร็จเลย (ต้องกดลองใหม่) ต่างจากข้อความแจ้งเตือนชั่วคราวตอนสแกนเจอ QR ที่ไม่ใช่ของระบบ (สแกนต่อได้เลย) */
  readonly fatalError = signal(false);

  private stream: MediaStream | null = null;
  private rafId: number | null = null;
  private stopped = false;
  private clearMessageTimeout: ReturnType<typeof setTimeout> | null = null;

  ngAfterViewInit(): void {
    void this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopScanning();
    if (this.clearMessageTimeout) clearTimeout(this.clearMessageTimeout);
  }

  retry(): void {
    this.errorMessage.set(null);
    this.fatalError.set(false);
    this.starting.set(true);
    this.stopped = false;
    void this.startCamera();
  }

  private async startCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.starting.set(false);
      this.fatalError.set(true);
      this.errorMessage.set('เบราว์เซอร์หรือการเชื่อมต่อนี้ไม่รองรับการใช้กล้อง (ต้องเข้าผ่าน HTTPS หรือ localhost เท่านั้น)');
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = this.videoRef.nativeElement;
      video.srcObject = this.stream;
      await video.play();
      this.starting.set(false);
      this.scanLoop();
    } catch (err) {
      this.starting.set(false);
      this.fatalError.set(true);
      this.errorMessage.set(this.describeError(err));
    }
  }

  private describeError(err: unknown): string {
    const name = (err as { name?: string } | null)?.name;
    if (name === 'NotAllowedError') return 'ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์แล้วลองใหม่';
    if (name === 'NotFoundError') return 'ไม่พบกล้องบนอุปกรณ์นี้';
    return 'เปิดกล้องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
  }

  private scanLoop(): void {
    if (this.stopped) return;
    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height);
        if (result?.data) {
          this.onDecoded(result.data);
          return;
        }
      }
    }

    this.rafId = requestAnimationFrame(() => this.scanLoop());
  }

  private onDecoded(text: string): void {
    if (SHORT_URL_PATTERN.test(text)) {
      this.stopScanning();
      window.location.href = text;
      return;
    }

    const match = text.match(LEGACY_SCAN_URL_TOKEN_PATTERN);
    if (match) {
      this.stopScanning();
      void this.router.navigate(['/qr/scan', decodeURIComponent(match[1])]);
      return;
    }

    this.showTransientMessage('QR Code นี้ไม่ใช่ QR Code ครุภัณฑ์ของระบบนี้ — ลองสแกนใหม่');
    this.rafId = requestAnimationFrame(() => this.scanLoop());
  }

  private showTransientMessage(message: string): void {
    this.errorMessage.set(message);
    if (this.clearMessageTimeout) clearTimeout(this.clearMessageTimeout);
    this.clearMessageTimeout = setTimeout(() => this.errorMessage.set(null), INVALID_QR_MESSAGE_MS);
  }

  private stopScanning(): void {
    this.stopped = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
