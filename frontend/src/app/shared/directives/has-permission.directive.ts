import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import type { Permission } from '../../core/models/auth.model';

/**
 * Structural directive ซ่อน/แสดง element ตามสิทธิ์ผู้ใช้ปัจจุบัน (ระดับ UI element ตาม RBAC)
 * ใช้งาน: <button *khdHasPermission="'asset:delete'">ลบ</button>
 *        <button *khdHasPermission="['asset:update', 'asset:delete']">แก้ไข</button>
 */
@Directive({
  selector: '[khdHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly authService = inject(AuthService);

  /**
   * ไม่ใช้ input.required() เพราะ structural directive ถูก instantiate ก่อนที่ Angular จะ bind ค่า
   * input ให้เสร็จ — อ่านค่าใน effect() รอบแรกจะโยน NG0950 ถ้าเป็น required input
   */
  readonly khdHasPermission = input<Permission | Permission[]>([]);

  private hasView = false;

  constructor() {
    effect(() => {
      const required = this.khdHasPermission();
      const permissions = Array.isArray(required) ? required : [required];
      const allowed = this.authService.hasAnyPermission(permissions);

      if (allowed && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!allowed && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}
