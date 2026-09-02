import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule, type MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { AssetService } from '../../../core/services/asset.service';
import { DepartmentService } from '../../../core/services/department.service';
import { LocationService } from '../../../core/services/location.service';
import { UserService } from '../../../core/services/user.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { getStatusLabel, getAcquisitionTypeLabel } from '../../../core/constants/status.const';
import type { AssetAcquisitionType, AssetStatus, IAsset, IAssetCategory } from '../../../core/models/asset.model';
import type { IDepartment } from '../../../core/models/user.model';
import type { IBuilding, IFloor, IRoom } from '../../../core/models/location.model';
import type { IUserListItem } from '../../../core/models/user.model';

const ASSET_STATUSES: AssetStatus[] = [
  'ACTIVE',
  'IN_REPAIR',
  'WAITING_PARTS',
  'MAINTENANCE',
  'RESERVED',
  'INACTIVE',
  'DISPOSED',
  'LOST',
];

const ASSET_ACQUISITION_TYPES: AssetAcquisitionType[] = ['PURCHASE', 'LEASE_TO_OWN', 'LEASE_USE', 'DONATED', 'BORROWED', 'UNKNOWN'];

export interface IAssetFormDialogData {
  asset: IAsset | null;
  categories: IAssetCategory[];
}

@Component({
  selector: 'khd-asset-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    IconComponent,
    HasPermissionDirective,
  ],
  templateUrl: './asset-form.component.html',
})
export class AssetFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly assetService = inject(AssetService);
  private readonly departmentService = inject(DepartmentService);
  private readonly locationService = inject(LocationService);
  private readonly userService = inject(UserService);
  readonly dialogRef = inject(MatDialogRef<AssetFormComponent>);
  readonly data = inject<IAssetFormDialogData>(MAT_DIALOG_DATA);

  readonly saving = signal(false);
  readonly departments = signal<IDepartment[]>([]);
  readonly buildings = signal<IBuilding[]>([]);
  readonly floors = signal<IFloor[]>([]);
  readonly rooms = signal<IRoom[]>([]);
  readonly ownerOptions = signal<IUserListItem[]>([]);
  readonly isEdit = !!this.data.asset;

  readonly statusOptions = ASSET_STATUSES.map((code) => ({ code, label: getStatusLabel(code) }));
  readonly acquisitionTypeOptions = ASSET_ACQUISITION_TYPES.map((code) => ({ code, label: getAcquisitionTypeLabel(code) }));

  /** ช่องค้นหาผู้รับผิดชอบแยกจาก form หลัก — เก็บแค่ข้อความค้นหา ไม่ใช่ค่าที่จะ submit (ownerUserId ต่างหาก) */
  readonly ownerSearch = new FormControl(this.data.asset?.owner?.fullName ?? '', { nonNullable: true });

  readonly form = this.fb.nonNullable.group({
    categoryId: [this.data.asset?.categoryId ?? '', Validators.required],
    brand: [this.data.asset?.brand ?? ''],
    model: [this.data.asset?.model ?? ''],
    serialNumber: [this.data.asset?.serialNumber ?? ''],
    govAssetNumber: [this.data.asset?.govAssetNumber ?? ''],
    departmentId: [this.data.asset?.department?.id ?? ''],
    buildingId: [this.data.asset?.building?.id ?? ''],
    floorId: [this.data.asset?.floor?.id ?? ''],
    roomId: [this.data.asset?.room?.id ?? ''],
    locationNote: [''],
    ownerUserId: [this.data.asset?.owner?.id ?? ''],
    price: [this.data.asset?.price ?? ''],
    acquisitionType: [this.data.asset?.acquisitionType ?? ('UNKNOWN' as AssetAcquisitionType)],
    unitType: [this.data.asset?.unitType ?? ''],
    budgetYear: [this.data.asset?.budgetYear ?? ''],
    remark: [this.data.asset?.remark ?? ''],
    status: [this.data.asset?.status ?? ('ACTIVE' as AssetStatus)],
  });

  constructor() {
    this.departmentService.list().subscribe((depts) => this.departments.set(depts));
    this.locationService.listBuildings().subscribe((buildings) => this.buildings.set(buildings));

    const initialBuildingId = this.data.asset?.building?.id;
    if (initialBuildingId) {
      this.locationService.listFloors(initialBuildingId).subscribe((floors) => this.floors.set(floors));
    }
    const initialFloorId = this.data.asset?.floor?.id;
    if (initialFloorId) {
      this.locationService.listRooms(initialFloorId).subscribe((rooms) => this.rooms.set(rooms));
    }

    this.form.controls.buildingId.valueChanges.subscribe((buildingId) => {
      this.form.patchValue({ floorId: '', roomId: '' }, { emitEvent: false });
      this.rooms.set([]);
      this.floors.set([]);
      if (buildingId) this.locationService.listFloors(buildingId).subscribe((floors) => this.floors.set(floors));
    });

    this.form.controls.floorId.valueChanges.subscribe((floorId) => {
      this.form.patchValue({ roomId: '' }, { emitEvent: false });
      this.rooms.set([]);
      if (floorId) this.locationService.listRooms(floorId).subscribe((rooms) => this.rooms.set(rooms));
    });

    this.ownerSearch.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => {
          // ค่าที่ได้อาจเป็น object (เพิ่งเลือกจาก autocomplete) หรือ string (พิมพ์เอง) — ค้นหาใหม่เฉพาะกรณีพิมพ์เองเท่านั้น
          if (typeof value !== 'string') return [];
          // พิมพ์ต่อจากชื่อที่เลือกไว้แล้ว = ยังไม่ได้เลือกใหม่ ล้าง ownerUserId เดิมทิ้งก่อนจนกว่าจะเลือกจาก autocomplete อีกครั้ง
          this.form.patchValue({ ownerUserId: '' }, { emitEvent: false });
          if (value.length < 2) return [];
          return this.userService.list({ keyword: value, limit: 10 });
        }),
      )
      .subscribe((res) => this.ownerOptions.set(res.items));
  }

  ownerSelected(event: MatAutocompleteSelectedEvent): void {
    const user = event.option.value as IUserListItem;
    this.form.patchValue({ ownerUserId: user.id });
  }

  ownerDisplayFn(user: IUserListItem | string | null): string {
    if (!user) return '';
    return typeof user === 'string' ? user : user.fullName;
  }

  clearOwner(): void {
    this.form.patchValue({ ownerUserId: '' });
    this.ownerSearch.setValue('', { emitEvent: false });
    this.ownerOptions.set([]);
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const { status, departmentId, buildingId, floorId, roomId, ownerUserId, price, ...rest } = this.form.getRawValue();
    const payload = {
      ...rest,
      departmentId: departmentId || undefined,
      buildingId: buildingId || undefined,
      floorId: floorId || undefined,
      roomId: roomId || undefined,
      ownerUserId: ownerUserId || undefined,
      price: price === '' ? undefined : Number(price),
    };
    const request$ = this.isEdit
      ? this.assetService.update(this.data.asset!.id, { ...payload, status })
      : this.assetService.create(payload);

    request$.subscribe({
      next: (asset) => {
        this.saving.set(false);
        this.dialogRef.close(asset);
      },
      error: () => this.saving.set(false),
    });
  }
}
