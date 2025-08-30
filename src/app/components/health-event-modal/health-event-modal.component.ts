import { Component, EventEmitter, Output, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HealthEvent } from '../../models/health-event.model';
import { Flock } from '../../models/flock.model';

@Component({
  selector: 'app-health-event-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './health-event-modal.component.html',
  styleUrl: './health-event-modal.component.css'
})
export class HealthEventModalComponent implements OnInit {
  @Input() event: HealthEvent | null = null;
  @Input() flocks: (Flock & { farmName: string })[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Partial<HealthEvent>>();

  eventForm: FormGroup;
  eventTypes = ['Vaksinasi', 'Pengobatan', 'Penyakit'];

  constructor(private fb: FormBuilder) {
    this.eventForm = this.fb.group({
      flock_id: [null, Validators.required],
      event_type: [null, Validators.required],
      description: ['', Validators.required],
      date: ['', Validators.required],
      notes: ['']
    });
  }

  ngOnInit(): void {
    if (this.event) {
      const formattedEvent = {
        ...this.event,
        date: this.event.date.split('T')[0]
      };
      this.eventForm.patchValue(formattedEvent);
    }
  }

  onSave(): void {
    if (this.eventForm.valid) {
      this.save.emit({ ...this.event, ...this.eventForm.value });
    }
  }

  onClose(): void {
    this.close.emit();
  }
}