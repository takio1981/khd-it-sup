import { Pipe, type PipeTransform } from '@angular/core';

export type KhdDateFormat = 'date' | 'datetime' | 'short-datetime' | 'full';

const FORMATS: Record<KhdDateFormat, Intl.DateTimeFormat> = {
  date: new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }),
  datetime: new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  'short-datetime': new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  full: new Intl.DateTimeFormat('th-TH', { dateStyle: 'full' }),
};

/** วันที่ภาษาไทย ปีพุทธศักราช เช่น "18 ก.ย. 2569", "18 ก.ย. 2569 09:16" */
@Pipe({ name: 'khdDate', standalone: true })
export class KhdDatePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined, format: KhdDateFormat = 'date'): string {
    if (value === null || value === undefined || value === '') return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return FORMATS[format].format(d);
  }
}
