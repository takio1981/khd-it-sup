import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule, type MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { AssetLoanService } from '../../../core/services/asset-loan.service';
import { LocationService } from '../../../core/services/location.service';
import { UserService } from '../../../core/services/user.service';
import type { IAssetLoan } from '../../../core/models/asset-loan.model';
import type { IBuilding, IFloor, IRoom } from '../../../core/models/location.model';
import type { IUserListItem } from '../../../core/models/user.model';

export interface IAssetLoanTransferFormDialogData {
  loan: IAssetLoan;
}

@Component({
  selector: 'khd-asset-loan-transfer-form',
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
  ],
  templateUrl: './asset-loan-transfer-form.component.html',
})
export class AssetLoanTransferFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly assetLoanService = inject(AssetLoanService);
  private readonly locationService = inject(LocationService);
  private readonly userService = inject(UserService);
  readonly dialogRef = inject(MatDialogRef<AssetLoanTransferFormComponent>);
  readonly data = inject<IAssetLoanTransferFormDialogData>(MAT_DIALOG_DATA);

  readonly saving = signal(false);
  readonly buildings = signal<IBuilding[]>([]);
  readonly floors = signal<IFloor[]>([]);
  readonly rooms = signal<IRoom[]>([]);
  readonly holderOptions = signal<IUserListItem[]>([]);

  /** ช่องค้นหาผู้รับมอบใหม่ — เก็บแค่ข้อความค้นหา ไม่ใช่ค่าที่จะ submit (newHolderId ต่างหาก) */
  readonly holderSearch = new FormControl('', { nonNullable: true });

  readonly form = this.fb.nonNullable.group({
    newHolderId: [''],
    buildingId: [this.data.loan.currentBuilding?.id ?? ''],
    floorId: [this.data.loan.currentFloor?.id ?? ''],
    roomId: [this.data.loan.currentRoom?.id ?? ''],
    locationNote: [''],
    comment: [''],
  });

  constructor() {
    this.locationService.listBuildings().subscribe((buildings) => this.buildings.set(buildings));

    const initialBuildingId = this.data.loan.currentBuilding?.id;
    if (initialBuildingId) {
      this.locationService.listFloors(initialBuildingId).subscribe((floors) => this.floors.set(floors));
    }
    const initialFloorId = this.data.loan.currentFloor?.id;
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

    this.holderSearch.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => {
          if (typeof value !== 'string') return [];
          this.form.patchValue({ newHolderId: '' }, { emitEvent: false });
          if (value.length < 2) return [];
          return this.userService.list({ keyword: value, limit: 10 });
        }),
      )
      .subscribe((res) => this.holderOptions.set(res.items));
  }

  holderSelected(event: MatAutocompleteSelectedEvent): void {
    const user = event.option.value as IUserListItem;
    this.form.patchValue({ newHolderId: user.id });
  }

  holderDisplayFn(user: IUserListItem | string | null): string {
    if (!user) return '';
    return typeof user === 'string' ? user : user.fullName;
  }

  submit(): void {
    if (this.saving()) return;

    const raw = this.form.getRawValue();
    if (!raw.newHolderId && !raw.buildingId && !raw.locationNote) return;
    this.saving.set(true);

    this.assetLoanService
      .transfer(this.data.loan.id, {
        newHolderId: raw.newHolderId || undefined,
        buildingId: raw.buildingId || undefined,
        floorId: raw.floorId || undefined,
        roomId: raw.roomId || undefined,
        locationNote: raw.locationNote || undefined,
        comment: raw.comment || undefined,
      })
      .subscribe({
        next: (loan) => {
          this.saving.set(false);
          this.dialogRef.close(loan);
        },
        error: () => this.saving.set(false),
      });
  }
}
