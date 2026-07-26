import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface IBarChartDatum {
  label: string;
  value: number;
  color?: string;
}

/**
 * Horizontal/Vertical bar chart แบบ inline SVG (ไม่พึ่ง chart library ภายนอก)
 * ตาม dataviz guideline: thin bar, rounded data-end 4px, เว้นช่องว่างระหว่างแท่ง, direct label, hover tooltip
 */
@Component({
  selector: 'khd-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bar-chart.component.html',
  styleUrl: './bar-chart.component.scss',
})
export class BarChartComponent {
  readonly data = input.required<IBarChartDatum[]>();
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
  readonly defaultColor = input<string>('#006C45');
  readonly valueSuffix = input<string>('');
  readonly emptyMessage = input<string>('ไม่มีข้อมูล');

  readonly hoveredIndex = signal<number | null>(null);

  readonly maxValue = computed(() => Math.max(1, ...this.data().map((d) => d.value)));

  barLength(value: number): number {
    return (value / this.maxValue()) * 100;
  }

  onHover(index: number | null): void {
    this.hoveredIndex.set(index);
  }
}
