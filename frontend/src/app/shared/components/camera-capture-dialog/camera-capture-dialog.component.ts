import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { IconComponent } from '../icon/icon.component';

export interface ICameraCaptureDialogData {
  mode: 'photo' | 'video';
  /** ความยาววิดีโอสูงสุด (วินาที) — บันทึกครบแล้วหยุดอัตโนมัติ ใช้เฉพาะ mode 'video' */
  maxVideoDurationSec: number;
}

const VIDEO_MIME_CANDIDATES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

/**
 * เปิดกล้องของเครื่อง (มือถือ/โน้ตบุ๊ก) ผ่าน getUserMedia โดยตรง แทนการพึ่ง <input capture> ซึ่งเบราว์เซอร์เดสก์ท็อป
 * ส่วนใหญ่ไม่รองรับ (เปิด file picker แทนกล้องจริง) — ใช้ facingMode ideal:'environment' เพื่อเลือกกล้องหลังบนมือถือ
 * โดยอัตโนมัติถ้ามี แต่ไม่ error ถ้าไม่มี (เช่นโน้ตบุ๊กที่มีแค่กล้องหน้า) ต่างจาก exact ที่จะโยน error ทันที
 */
@Component({
  selector: 'khd-camera-capture-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatProgressSpinnerModule, IconComponent],
  templateUrl: './camera-capture-dialog.component.html',
})
export class CameraCaptureDialogComponent implements AfterViewInit, OnDestroy {
  readonly dialogRef = inject(MatDialogRef<CameraCaptureDialogComponent>);
  readonly data = inject<ICameraCaptureDialogData>(MAT_DIALOG_DATA);

  @ViewChild('video') private readonly videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') private readonly canvasRef?: ElementRef<HTMLCanvasElement>;

  readonly starting = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly recording = signal(false);
  readonly recordedSeconds = signal(0);

  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordTimerId: ReturnType<typeof setInterval> | null = null;
  private autoStopTimeoutId: ReturnType<typeof setTimeout> | null = null;

  async ngAfterViewInit(): Promise<void> {
    await this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopStream();
    if (this.recordTimerId) clearInterval(this.recordTimerId);
    if (this.autoStopTimeoutId) clearTimeout(this.autoStopTimeoutId);
  }

  private async startCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.starting.set(false);
      this.errorMessage.set('เบราว์เซอร์หรือการเชื่อมต่อนี้ไม่รองรับการใช้กล้อง (ต้องเข้าผ่าน HTTPS หรือ localhost เท่านั้น)');
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: this.data.mode === 'video',
      });
      const video = this.videoRef!.nativeElement;
      video.srcObject = this.stream;
      await video.play();
      this.starting.set(false);
    } catch (err) {
      this.starting.set(false);
      this.errorMessage.set(this.describeError(err));
    }
  }

  private describeError(err: unknown): string {
    const name = (err as { name?: string } | null)?.name;
    if (name === 'NotAllowedError') {
      return this.data.mode === 'video'
        ? 'ไม่ได้รับอนุญาตให้ใช้กล้อง/ไมโครโฟน กรุณาอนุญาตในเบราว์เซอร์แล้วลองใหม่'
        : 'ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์แล้วลองใหม่';
    }
    if (name === 'NotFoundError') return 'ไม่พบกล้องบนอุปกรณ์นี้';
    return 'เปิดกล้องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
  }

  capturePhoto(): void {
    const video = this.videoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        this.close(new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  }

  startRecording(): void {
    if (!this.stream) return;

    this.recordedChunks = [];
    const mimeType = VIDEO_MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
    this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    this.mediaRecorder.onstop = () => this.finishRecording();
    this.mediaRecorder.start();

    this.recording.set(true);
    this.recordedSeconds.set(0);
    this.recordTimerId = setInterval(() => this.recordedSeconds.update((s) => s + 1), 1000);
    this.autoStopTimeoutId = setTimeout(() => this.stopRecording(), this.data.maxVideoDurationSec * 1000);
  }

  stopRecording(): void {
    if (!this.recording()) return;
    this.mediaRecorder?.stop();
    this.recording.set(false);
    if (this.recordTimerId) {
      clearInterval(this.recordTimerId);
      this.recordTimerId = null;
    }
    if (this.autoStopTimeoutId) {
      clearTimeout(this.autoStopTimeoutId);
      this.autoStopTimeoutId = null;
    }
  }

  private finishRecording(): void {
    // ตัดพารามิเตอร์ codec ทิ้ง (เช่น "video/webm;codecs=vp9,opus" -> "video/webm") ก่อนตั้งเป็น Content-Type ของไฟล์ —
    // multipart parser ฝั่ง server (busboy) parse ค่าที่มี comma อยู่ในพารามิเตอร์ codec ไม่ได้ แล้ว fallback เป็น text/plain เงียบๆ
    const rawMimeType = this.mediaRecorder?.mimeType || 'video/webm';
    const baseMimeType = rawMimeType.split(';')[0].trim() || 'video/webm';
    const blob = new Blob(this.recordedChunks, { type: baseMimeType });
    const ext = baseMimeType.includes('webm') ? 'webm' : 'mp4';
    this.close(new File([blob], `capture-${Date.now()}.${ext}`, { type: baseMimeType }));
  }

  cancel(): void {
    this.close(null);
  }

  private close(file: File | null): void {
    this.stopStream();
    this.dialogRef.close(file ?? undefined);
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
