import { Pipe, PipeTransform } from '@angular/core';
import { formatKhdNumber } from '../../core/utils/number-format.util';

/** ดู formatKhdNumber() ใน core/utils/number-format.util.ts สำหรับพฤติกรรมเต็ม — pipe นี้ห่อไว้ให้ใช้ใน template ตรงๆ */
@Pipe({ name: 'khdNumber', standalone: true })
export class KhdNumberPipe implements PipeTransform {
  transform(value: number | string | null | undefined, decimals?: number): string {
    return formatKhdNumber(value, decimals);
  }
}
