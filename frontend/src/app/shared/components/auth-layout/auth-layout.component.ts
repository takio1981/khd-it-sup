import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { IconComponent } from '../icon/icon.component';

const FEATURES = [
  { img: 'repair', label: 'แจ้งซ่อมอุปกรณ์' },
  { img: 'workflow', label: 'ติดตามทุกขั้นตอน' },
  { img: 'loan', label: 'ยืม-คืนครุภัณฑ์' },
  { img: 'sync', label: 'ข้อมูลครุภัณฑ์ทันสมัย' },
  { img: 'security', label: 'ปลอดภัยด้วยสิทธิ์และ PIN' },
] as const;

/**
 * โครงหน้ามาตรฐานของหน้า auth / หน้าสาธารณะ — จอใหญ่แบ่ง 2 ฝั่ง (แผงแบรนด์ + ฟอร์ม), มือถือเหลือหัวโลโก้ + ฟอร์ม
 * ใช้งาน: <khd-auth-layout heading="เข้าสู่ระบบ"> ...ฟอร์ม... <div below>...</div> </khd-auth-layout>
 */
@Component({
  selector: 'khd-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  host: { class: 'block' },
  template: `
    <div class="min-h-screen bg-brand-background lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside class="khd-auth-brand relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14">
        <div class="relative flex items-center gap-3">
          <span class="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white">
            <img src="logo-khd-it-sup.png" alt="" class="h-full w-full object-cover" />
          </span>
          <div>
            <p class="m-0 font-semibold leading-tight">{{ appName }}</p>
            <p class="m-0 text-xs text-white/60">IT Service Desk</p>
          </div>
        </div>

        <div class="relative">
          <p class="m-0 max-w-md text-[28px] font-semibold leading-snug text-white xl:text-[32px]">
            แจ้งซ่อม ติดตามสถานะ<br />และยืม-คืนอุปกรณ์ ได้ในที่เดียว
          </p>
          <p class="m-0 mt-3 max-w-md text-sm leading-relaxed text-white/65">
            ระบบแจ้งซ่อมอุปกรณ์และระบบคอมพิวเตอร์ สำหรับบุคลากรทุกหน่วยงานใน{{ orgName }}
          </p>
          <ul class="m-0 mt-10 grid max-w-lg list-none grid-cols-3 gap-x-4 gap-y-6 p-0">
            @for (f of features; track f.img) {
              <li class="flex flex-col items-center gap-2 text-center">
                <span class="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_8px_24px_-8px_rgb(0_0_0/0.5)]">
                  <img [src]="'illust/' + f.img + '.webp'" alt="" class="h-full w-full object-cover" />
                </span>
                <span class="text-xs leading-snug text-white/75">{{ f.label }}</span>
              </li>
            }
          </ul>
        </div>

        <p class="relative m-0 text-xs text-white/45">© {{ year }} {{ orgName }}</p>
      </aside>

      <main class="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div class="w-full max-w-[420px]">
          <div class="mb-6 flex flex-col items-center text-center lg:hidden">
            <span class="mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white shadow-softLg">
              <img src="logo-khd-it-sup.png" alt="โลโก้ระบบ" class="h-full w-full object-cover" />
            </span>
            <p class="m-0 text-base font-semibold text-ink">ระบบแจ้งซ่อมอุปกรณ์และระบบคอมพิวเตอร์</p>
            <p class="m-0 mt-0.5 text-xs text-muted">{{ orgName }}</p>
          </div>

          <div class="khd-card !p-6 shadow-softLg sm:!p-8">
            @if (backLink(); as link) {
              <a [routerLink]="link" class="-ml-1 mb-4 inline-flex items-center gap-1 text-sm text-muted no-underline hover:text-ink">
                <khd-icon name="arrow-left" [size]="16" />
                {{ backLabel() }}
              </a>
            }
            @if (heading()) {
              <h1 class="m-0 text-xl font-semibold text-ink">{{ heading() }}</h1>
            }
            @if (description()) {
              <p class="m-0 mt-1 text-sm text-muted">{{ description() }}</p>
            }
            <div [class.mt-6]="heading() || description()">
              <ng-content />
            </div>
          </div>

          <ng-content select="[below]" />

          <p class="m-0 mt-8 text-center text-xs text-neutral-400 lg:hidden">© {{ year }} {{ orgName }}</p>
        </div>
      </main>
    </div>
  `,
  styles: `
    .khd-auth-brand {
      background:
        radial-gradient(60% 50% at 100% 0%, rgb(31 111 209 / 0.35), transparent 70%),
        radial-gradient(50% 40% at 0% 100%, rgb(18 150 140 / 0.28), transparent 70%),
        #0b2545;
    }
  `,
})
export class AuthLayoutComponent {
  readonly heading = input<string | null>(null);
  readonly description = input<string | null>(null);
  readonly backLink = input<string | null>(null);
  readonly backLabel = input('ย้อนกลับ');

  readonly appName = environment.appName;
  readonly orgName = environment.orgNameTh;
  readonly year = new Date().getFullYear() + 543;
  readonly features = FEATURES;
}
