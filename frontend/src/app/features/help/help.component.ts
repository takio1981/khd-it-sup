import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'khd-help',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatExpansionModule, IconComponent],
  templateUrl: './help.component.html',
})
export class HelpComponent {}
