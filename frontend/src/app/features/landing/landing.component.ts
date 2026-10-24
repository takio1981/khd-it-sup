import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'khd-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, IconComponent],
  templateUrl: './landing.component.html',
})
export class LandingComponent {
  readonly orgName = environment.orgNameTh;
  readonly year = new Date().getFullYear() + 543;

  readonly features = [
    { img: 'repair', title: 'แจ้งซ่อม', text: 'แจ้งปัญหาอุปกรณ์หรือระบบ พร้อมแนบรูปได้ทันที' },
    { img: 'workflow', title: 'ติดตามสถานะ', text: 'เห็นทุกขั้นตอนตั้งแต่รับเรื่องจนปิดงาน' },
    { img: 'loan', title: 'ยืม-คืนครุภัณฑ์', text: 'ยืม คืน และโอนอุปกรณ์ไอทีพร้อมประวัติ' },
    { img: 'sync', title: 'ทะเบียนครุภัณฑ์', text: 'ข้อมูลครุภัณฑ์และประวัติซ่อมในที่เดียว' },
    { img: 'security', title: 'ปลอดภัย', text: 'สิทธิ์ตามบทบาท และเข้าสู่ระบบด้วย PIN' },
  ] as const;

  readonly steps = [
    { title: 'แจ้งซ่อม', text: 'เข้าสู่ระบบแล้วกด "แจ้งซ่อม" หรือสแกน QR Code ที่ติดอยู่บนเครื่อง' },
    { title: 'ติดตามงาน', text: 'ระบบแจ้งเตือนทุกครั้งที่สถานะเปลี่ยน ดูความคืบหน้าได้ตลอดเวลา' },
    { title: 'ตรวจรับเครื่อง', text: 'เมื่อซ่อมเสร็จ ตรวจรับและเซ็นรับงานในระบบเพื่อปิดงาน' },
  ] as const;
}
