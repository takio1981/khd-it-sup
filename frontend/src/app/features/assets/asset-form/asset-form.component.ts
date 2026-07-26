import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AssetService } from '../../../core/services/asset.service';
import { DepartmentService } from '../../../core/services/department.service';
import { LocationService } from '../../../core/services/location.service';
import { getStatusLabel } from '../../../core/constants/status.const';
import type { AssetStatus, IAsset, IAssetCategory } from '../../../core/models/asset.model';
import type { IDepartment } from '../../../core/models/user.model';
import type { IBuilding, IFloor, IRoom } from '../../../core/models/location.model';

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
  ],
  templateUrl: './asset-form.component.html',
})
export class AssetFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly assetService = inject(AssetService);
  private readonly departmentService = inject(DepartmentService);
  private readonly locationService = inject(LocationService);
  readonly dialogRef = inject(MatDialogRef<AssetFormComponent>);
  readonly data = inject<IAssetFormDialogData>(MAT_DIALOG_DATA);

  readonly saving = signal(false);
  readonly departments = signal<IDepartment[]>([]);
  readonly buildings = signal<IBuilding[]>([]);
  readonly floors = signal<IFloor[]>([]);
  readonly rooms = signal<IRoom[]>([]);
  readonly isEdit = !!this.data.asset;

  readonly statusOptions = ASSET_STATUSES.map((code) => ({ code, label: getStatusLabel(code) }));

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
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const { status, departmentId, buildingId, floorId, roomId, ...rest } = this.form.getRawValue();
    const payload = {
      ...rest,
      departmentId: departmentId || undefined,
      buildingId: buildingId || undefined,
      floorId: floorId || undefined,
      roomId: roomId || undefined,
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
