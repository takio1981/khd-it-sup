import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** แจ้งผลการทำงานแบบมีสีตามผลลัพธ์ (สำเร็จ/ผิดพลาด/ทั่วไป) ให้เหมือนกันทั้งระบบ */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, 'ปิด', { duration: 3500, panelClass: 'khd-toast-success' });
  }

  error(message: string): void {
    this.snackBar.open(message, 'ปิด', { duration: 6000, panelClass: 'khd-toast-error' });
  }

  info(message: string): void {
    this.snackBar.open(message, 'ปิด', { duration: 3500 });
  }
}
