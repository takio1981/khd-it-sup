import { ChangeDetectionStrategy, Component, ElementRef, forwardRef, output, signal, viewChildren } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

const PIN_LENGTH = 6;

/**
 * ช่องกรอก PIN 6 หลัก แบบกล่องแยกทีละหลัก — ใช้กับ formControlName ได้เหมือนฟิลด์อื่นในระบบผ่าน ControlValueAccessor
 * รองรับ auto-advance/backspace ย้อนกลับ/paste แปะทีเดียวครบ 6 หลัก และ emit `completed` เมื่อครบ 6 หลักเพื่อ auto-submit
 */
@Component({
  selector: 'khd-pin-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PinInputComponent), multi: true }],
  template: `
    <div class="flex justify-center gap-2 sm:gap-3">
      @for (i of indices; track i) {
        <input
          #digitInput
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="one-time-code"
          maxlength="1"
          [attr.aria-label]="'PIN หลักที่ ' + (i + 1)"
          [value]="digits()[i]"
          [disabled]="disabled()"
          class="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-semibold rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
          (input)="onDigitInput(i, $event)"
          (keydown)="onKeydown(i, $event)"
          (paste)="onPaste($event)"
          (focus)="onFocus($event)"
        />
      }
    </div>
  `,
})
export class PinInputComponent implements ControlValueAccessor {
  readonly indices = Array.from({ length: PIN_LENGTH }, (_, i) => i);

  /** ครบ 6 หลักแล้ว — ใช้ trigger auto-submit ที่หน้า parent */
  readonly completed = output<string>();

  private readonly digitInputs = viewChildren<ElementRef<HTMLInputElement>>('digitInput');

  readonly digits = signal<string[]>(Array(PIN_LENGTH).fill(''));
  readonly disabled = signal(false);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    const chars = (value ?? '').split('').slice(0, PIN_LENGTH);
    const next = Array(PIN_LENGTH).fill('');
    chars.forEach((c, i) => (next[i] = c));
    this.digits.set(next);

    // value ว่าง (mount ครั้งแรก หรือ parent เรียก form.reset() หลัง PIN ผิด) — โฟกัสช่องแรกให้อัตโนมัติ
    if (chars.length === 0) {
      this.focusIndex(0);
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onDigitInput(index: number, event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const char = inputEl.value.replace(/\D/g, '').slice(-1);

    const next = [...this.digits()];
    next[index] = char;
    this.digits.set(next);
    inputEl.value = char;

    this.emitValue();

    if (char && index < PIN_LENGTH - 1) {
      this.focusIndex(index + 1);
    }
  }

  onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) {
      event.preventDefault();
      const next = [...this.digits()];
      next[index - 1] = '';
      this.digits.set(next);
      this.emitValue();
      this.focusIndex(index - 1);
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focusIndex(index - 1);
    } else if (event.key === 'ArrowRight' && index < PIN_LENGTH - 1) {
      event.preventDefault();
      this.focusIndex(index + 1);
    }
  }

  onPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text')?.replace(/\D/g, '') ?? '';
    if (!pasted) return;
    event.preventDefault();

    const chars = pasted.slice(0, PIN_LENGTH).split('');
    const next = Array(PIN_LENGTH).fill('');
    chars.forEach((c, i) => (next[i] = c));
    this.digits.set(next);
    this.emitValue();

    this.focusIndex(Math.min(chars.length, PIN_LENGTH - 1));
  }

  onFocus(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  private focusIndex(index: number): void {
    queueMicrotask(() => this.digitInputs()[index]?.nativeElement.focus());
  }

  private emitValue(): void {
    const value = this.digits().join('');
    this.onChange(value);
    this.onTouched();
    if (value.length === PIN_LENGTH) {
      this.completed.emit(value);
    }
  }
}
