import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // สร้าง ThemeService ตั้งแต่เปิดแอป เพื่อให้หน้า login/หน้าสาธารณะใช้ธีมที่ผู้ใช้เลือกไว้ด้วย (ไม่ใช่แค่หน้าใน shell)
  private readonly theme = inject(ThemeService);
}
