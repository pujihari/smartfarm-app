import { Component, EventEmitter, Output, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Flock } from '../../models/flock.model';
import { Farm } from '../../models/farm.model';

@Component({
  selector: 'app-flock-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './flock-modal.component.html',
  styleUrl: './flock-modal.component.css'
})
export class FlockModalComponent implements OnInit {
  @Input() flock: Flock | null = null;
  @Input() farms: Farm[] = [];
  @Input() lockedFarmId: number | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Partial<Flock>>();

  flockForm: FormGroup;
  breeds = ['Hy-Line', 'Lohman', 'Isa Brown'];

  constructor(private fb: FormBuilder) {
    this.flockForm = this.fb.group({
      farm_id: [null, Validators.required],
      name: ['', Validators.required],
      breed: [null, Validators.required],
      population: [0, [Validators.required, Validators.min(1)]],
      start_date: ['', Validators.required],
      entry_age_days: [null, [Validators.required, Validators.min(0)]],
      status: ['Aktif', Validators.required]
    });
  }

  ngOnInit(): void {
    if (this.flock) {
      const formattedFlock = {
        ...this.flock,
        start_date: this.flock.start_date.split('T')[0]
      };
      this.flockForm.patchValue(formattedFlock);
    }

    if (this.lockedFarmId) {
      this.flockForm.patchValue({ farm_id: this.lockedFarmId });
      this.flockForm.get('farm_id')?.disable();
    }
  }

  onSave(): void {
    if (this.flockForm.valid) {
      this.save.emit({ ...this.flock, ...this.flockForm.getRawValue() });
    }
  }

  onClose(): void {
    this.close.emit();
  }
}