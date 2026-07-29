import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * ภาพพื้นหลังขนาดใหญ่แบบลายน้ำ (จาง+เบลอ) — วางไว้เป็นลูกแรกภายใน container ที่มี position: relative
 * แล้วครอบเนื้อหาจริงของหน้าด้วย class "relative z-10" เพื่อให้เนื้อหาแสดงอยู่เหนือลายน้ำเสมอ
 * (คอมโพเนนต์นี้ clip ตัวเองด้วย overflow-hidden ในตัว จึงไม่ทำให้ container ล้นแม้ container จะ scroll ได้)
 */
@Component({
  selector: 'khd-page-watermark',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pointer-events-none absolute inset-0 overflow-hidden flex items-center justify-center opacity-[0.07] dark:opacity-[0.12]"
      aria-hidden="true"
    >
      <img [src]="src()" alt="" class="block w-[min(140vw,900px)] max-w-none select-none blur-sm" />
    </div>
  `,
})
export class PageWatermarkComponent {
  readonly src = input.required<string>();
}
