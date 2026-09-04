import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { UserService } from '../../../core/services/user.service';
import { IconComponent } from '../icon/icon.component';
import type { Gender } from '../../../core/models/auth.model';

/**
 * รูปโปรไฟล์ผู้ใช้ — โหลดผ่าน blob เหมือน khd-attachment-thumbnail (endpoint /files/avatars ต้อง Authorization header)
 * ถ้ายังไม่มีรูป fallback เป็น avatar เริ่มต้นตามเพศ (ชาย/หญิง) หรือไอคอนกลางๆ ถ้าไม่ได้ระบุเพศไว้
 */
@Component({
  selector: 'khd-user-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="relative shrink-0 overflow-hidden rounded-full" [style.width.px]="size()" [style.height.px]="size()">
      @if (objectUrl(); as url) {
        <img [src]="url" class="h-full w-full object-cover" alt="" />
      } @else if (gender() === 'FEMALE') {
        <div class="absolute inset-0 bg-[#FCE7F3]"></div>
        <div class="absolute left-[12%] right-[12%] top-[14%] h-[56%] rounded-t-full rounded-b-[40%] bg-[#DB2777]"></div>
        <div class="absolute left-[4%] right-[4%] bottom-[-2%] h-[44%] rounded-t-full bg-[#DB2777]"></div>
        <div class="absolute left-[30%] right-[30%] top-[20%] h-[38%] rounded-full bg-[#F472B6]"></div>
      } @else if (gender() === 'MALE') {
        <div class="absolute inset-0 bg-[#DBEAFE]"></div>
        <div class="absolute left-[8%] right-[8%] bottom-[-2%] h-[46%] rounded-t-full bg-[#60A5FA]"></div>
        <div class="absolute left-[27%] right-[27%] top-[16%] h-[42%] rounded-full bg-[#3B82F6]"></div>
      } @else {
        <div class="absolute inset-0 flex items-center justify-center bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400">
          <khd-icon name="user-circle" [size]="size() * 0.72" />
        </div>
      }
    </div>
  `,
})
export class UserAvatarComponent {
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  readonly avatarUrl = input<string | null>(null);
  readonly gender = input<Gender | null>(null);
  readonly size = input<number>(36);

  readonly objectUrl = signal<string | null>(null);

  constructor() {
    effect(() => {
      const url = this.avatarUrl();
      this.objectUrl.set(null);
      if (!url) return;
      // data URI (เช่นจากหน้ากรอก PIN ก่อน login — ดึงผ่าน endpoint ที่ต้อง Authorization header ตามปกติไม่ได้
      // เพราะยังไม่มี access token ตอนนั้น จึงฝังรูปมาเป็น base64 ในตัว response แทน) ใช้แสดงได้ตรงๆ ไม่ต้อง fetch ซ้ำ
      if (url.startsWith('data:')) {
        this.objectUrl.set(url);
        return;
      }
      this.userService.getAvatarBlob(url).subscribe((blob) => this.objectUrl.set(URL.createObjectURL(blob)));
    });

    this.destroyRef.onDestroy(() => {
      const url = this.objectUrl();
      if (url) URL.revokeObjectURL(url);
    });
  }
}
