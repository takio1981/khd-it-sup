import { ChangeDetectionStrategy, Component, AfterViewInit, DestroyRef, ElementRef, ViewChild, inject, signal } from '@angular/core';

interface IPoint {
  x: number;
  y: number;
}

/**
 * ช่องเซ็นลายเซ็นต์ด้วยนิ้ว/เมาส์/ปากกา — ใช้ Pointer Events เดียวรองรับทั้งมือถือ/แท็บเล็ต/เดสก์ท็อปในตัวเดียว
 * ไม่พึ่ง library ภายนอก (เหมือนระบบไอคอนของแอปที่ทำเองแทนใช้ icon font package) ให้เรียก getDataUrl() ตอน submit
 * เพื่อดึงลายเซ็นเป็น PNG base64 data URL (คืน null ถ้ายังไม่ได้เซ็น)
 */
@Component({
  selector: 'khd-signature-pad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-lg border border-black/15 dark:border-white/15 bg-white overflow-hidden">
      <canvas #canvas class="block w-full touch-none" style="height: 160px"></canvas>
    </div>
    <div class="flex justify-end mt-1">
      <button type="button" class="text-xs text-neutral-500 hover:text-brand-primary" (click)="clear()">ล้างลายเซ็น</button>
    </div>
  `,
})
export class SignaturePadComponent implements AfterViewInit {
  @ViewChild('canvas') private readonly canvasRef!: ElementRef<HTMLCanvasElement>;
  private readonly destroyRef = inject(DestroyRef);
  private ctx: CanvasRenderingContext2D | null = null;
  private drawing = false;
  private lastPoint: IPoint | null = null;

  readonly isEmpty = signal(true);

  private readonly onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.drawing = true;
    this.lastPoint = this.pointFromEvent(e);
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.drawing || !this.ctx) return;
    e.preventDefault();
    const point = this.pointFromEvent(e);
    if (this.lastPoint) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
      this.ctx.lineTo(point.x, point.y);
      this.ctx.stroke();
    }
    this.lastPoint = point;
    this.isEmpty.set(false);
  };

  private readonly onPointerUp = (): void => {
    this.drawing = false;
    this.lastPoint = null;
  };

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
    this.ctx = ctx;

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);

    this.destroyRef.onDestroy(() => {
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      canvas.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
    });
  }

  private pointFromEvent(e: PointerEvent): IPoint {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  clear(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx?.clearRect(0, 0, canvas.width, canvas.height);
    this.isEmpty.set(true);
  }

  getDataUrl(): string | null {
    if (this.isEmpty()) return null;
    return this.canvasRef.nativeElement.toDataURL('image/png');
  }
}
