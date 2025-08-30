import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-member-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './member-modal.component.html',
  styleUrl: './member-modal.component.css'
})
export class MemberModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{ email: string }>();

  inviteForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.inviteForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSave(): void {
    if (this.inviteForm.valid) {
      this.save.emit(this.inviteForm.value);
    }
  }

  onClose(): void {
    this.close.emit();
  }
}