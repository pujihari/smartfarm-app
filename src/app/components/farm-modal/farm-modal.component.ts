import { Component, EventEmitter, Output, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Farm } from '../../models/farm.model';

@Component({
  selector: 'app-farm-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './farm-modal.component.html',
  styleUrl: './farm-modal.component.css'
})
export class FarmModalComponent implements OnInit {
  @Input() farm: Farm | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Partial<Farm>>();

  farmForm: FormGroup;
  farmTypes: ('Grower' | 'Layer')[] = ['Grower', 'Layer']; // Added farm types

  constructor(private fb: FormBuilder) {
    this.farmForm = this.fb.group({
      name: ['', Validators.required],
      location: ['', Validators.required],
      type: [null, Validators.required] // Added type control
    });
  }

  ngOnInit(): void {
    if (this.farm) {
      this.farmForm.patchValue(this.farm);
    }
  }

  onSave(): void {
    if (this.farmForm.valid) {
      this.save.emit({ ...this.farm, ...this.farmForm.value });
    }
  }

  onClose(): void {
    this.close.emit();
  }
}