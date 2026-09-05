import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { LocationService } from '../../core/services/location.service';
import { DepartmentService } from '../../core/services/department.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import type { IBuilding, IFloor, IRoom } from '../../core/models/location.model';
import type { IDepartment } from '../../core/models/user.model';
import { KhdNumberPipe } from '../../shared/pipes/khd-number.pipe';

@Component({
  selector: 'khd-location-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    IconComponent,
    HasPermissionDirective,
    KhdNumberPipe,
  ],
  templateUrl: './location-list.component.html',
})
export class LocationListComponent {
  private readonly fb = inject(FormBuilder);
  private readonly locationService = inject(LocationService);
  private readonly departmentService = inject(DepartmentService);
  private readonly dialog = inject(MatDialog);
  readonly departments = signal<IDepartment[]>([]);

  // --- Buildings ---
  readonly buildings = signal<IBuilding[]>([]);
  readonly selectedBuildingId = signal<string | null>(null);
  readonly showBuildingForm = signal(false);
  readonly editingBuildingId = signal<string | null>(null);
  readonly buildingForm = this.fb.nonNullable.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
  });

  // --- Floors ---
  readonly floors = signal<IFloor[]>([]);
  readonly selectedFloorId = signal<string | null>(null);
  readonly showFloorForm = signal(false);
  readonly editingFloorId = signal<string | null>(null);
  readonly floorForm = this.fb.nonNullable.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
  });

  // --- Rooms ---
  readonly rooms = signal<IRoom[]>([]);
  readonly showRoomForm = signal(false);
  readonly editingRoomId = signal<string | null>(null);
  readonly roomForm = this.fb.nonNullable.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    departmentId: [''],
  });

  constructor() {
    this.fetchBuildings();
    this.departmentService.list().subscribe((departments) => this.departments.set(departments));
  }

  // --- Buildings ---
  fetchBuildings(): void {
    this.locationService.listBuildings().subscribe((buildings) => this.buildings.set(buildings));
  }

  selectBuilding(building: IBuilding): void {
    this.selectedBuildingId.set(building.id);
    this.selectedFloorId.set(null);
    this.rooms.set([]);
    this.locationService.listFloors(building.id).subscribe((floors) => this.floors.set(floors));
  }

  openCreateBuildingForm(): void {
    this.editingBuildingId.set(null);
    this.buildingForm.reset({ code: '', name: '' });
    this.buildingForm.get('code')?.enable();
    this.showBuildingForm.set(true);
  }

  openEditBuildingForm(building: IBuilding): void {
    this.editingBuildingId.set(building.id);
    this.buildingForm.reset({ code: building.code, name: building.name });
    this.buildingForm.get('code')?.disable();
    this.showBuildingForm.set(true);
  }

  cancelBuildingForm(): void {
    this.showBuildingForm.set(false);
    this.editingBuildingId.set(null);
  }

  submitBuilding(): void {
    if (this.buildingForm.invalid) return;
    const editing = this.editingBuildingId();
    const { name } = this.buildingForm.getRawValue();
    const request = editing ? this.locationService.updateBuilding(editing, { name }) : this.locationService.createBuilding(this.buildingForm.getRawValue());
    request.subscribe(() => {
      this.showBuildingForm.set(false);
      this.editingBuildingId.set(null);
      this.fetchBuildings();
    });
  }

  deleteBuilding(building: IBuilding): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: { title: 'ลบอาคาร', message: `ยืนยันการลบอาคาร ${building.name} ใช่หรือไม่? (ต้องไม่มีชั้นหรือครุภัณฑ์ผูกอยู่)`, danger: true },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.locationService.removeBuilding(building.id).subscribe(() => {
        if (this.selectedBuildingId() === building.id) {
          this.selectedBuildingId.set(null);
          this.floors.set([]);
          this.rooms.set([]);
        }
        this.fetchBuildings();
      });
    });
  }

  // --- Floors ---
  selectFloor(floor: IFloor): void {
    this.selectedFloorId.set(floor.id);
    this.locationService.listRooms(floor.id).subscribe((rooms) => this.rooms.set(rooms));
  }

  openCreateFloorForm(): void {
    this.editingFloorId.set(null);
    this.floorForm.reset({ code: '', name: '' });
    this.floorForm.get('code')?.enable();
    this.showFloorForm.set(true);
  }

  openEditFloorForm(floor: IFloor): void {
    this.editingFloorId.set(floor.id);
    this.floorForm.reset({ code: floor.code, name: floor.name });
    this.floorForm.get('code')?.disable();
    this.showFloorForm.set(true);
  }

  cancelFloorForm(): void {
    this.showFloorForm.set(false);
    this.editingFloorId.set(null);
  }

  submitFloor(): void {
    const buildingId = this.selectedBuildingId();
    if (this.floorForm.invalid || !buildingId) return;
    const editing = this.editingFloorId();
    const { code, name } = this.floorForm.getRawValue();
    const request = editing
      ? this.locationService.updateFloor(editing, { name })
      : this.locationService.createFloor({ buildingId, code, name });
    request.subscribe(() => {
      this.showFloorForm.set(false);
      this.editingFloorId.set(null);
      this.locationService.listFloors(buildingId).subscribe((floors) => this.floors.set(floors));
    });
  }

  deleteFloor(floor: IFloor): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: { title: 'ลบชั้น', message: `ยืนยันการลบชั้น ${floor.name} ใช่หรือไม่? (ต้องไม่มีห้องหรือครุภัณฑ์ผูกอยู่)`, danger: true },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.locationService.removeFloor(floor.id).subscribe(() => {
        if (this.selectedFloorId() === floor.id) {
          this.selectedFloorId.set(null);
          this.rooms.set([]);
        }
        const buildingId = this.selectedBuildingId();
        if (buildingId) this.locationService.listFloors(buildingId).subscribe((floors) => this.floors.set(floors));
      });
    });
  }

  // --- Rooms ---
  openCreateRoomForm(): void {
    this.editingRoomId.set(null);
    this.roomForm.reset({ code: '', name: '', departmentId: '' });
    this.roomForm.get('code')?.enable();
    this.showRoomForm.set(true);
  }

  openEditRoomForm(room: IRoom): void {
    this.editingRoomId.set(room.id);
    this.roomForm.reset({ code: room.code, name: room.name, departmentId: room.departmentId ?? '' });
    this.roomForm.get('code')?.disable();
    this.showRoomForm.set(true);
  }

  cancelRoomForm(): void {
    this.showRoomForm.set(false);
    this.editingRoomId.set(null);
  }

  submitRoom(): void {
    const floorId = this.selectedFloorId();
    if (this.roomForm.invalid || !floorId) return;
    const editing = this.editingRoomId();
    const { code, name, departmentId } = this.roomForm.getRawValue();
    const request = editing
      ? this.locationService.updateRoom(editing, { name, departmentId: departmentId || null })
      : this.locationService.createRoom({ floorId, code, name, departmentId: departmentId || undefined });
    request.subscribe(() => {
      this.showRoomForm.set(false);
      this.editingRoomId.set(null);
      this.locationService.listRooms(floorId).subscribe((rooms) => this.rooms.set(rooms));
    });
  }

  deleteRoom(room: IRoom): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: { title: 'ลบห้อง', message: `ยืนยันการลบห้อง ${room.name} ใช่หรือไม่? (ต้องไม่มีครุภัณฑ์ผูกอยู่)`, danger: true },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      const floorId = this.selectedFloorId();
      this.locationService.removeRoom(room.id).subscribe(() => {
        if (floorId) this.locationService.listRooms(floorId).subscribe((rooms) => this.rooms.set(rooms));
      });
    });
  }
}
