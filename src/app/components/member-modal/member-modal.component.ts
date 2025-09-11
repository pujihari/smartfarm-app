import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MemberRole } from '../../models/member.model'; // Import MemberRole

@Component({
  selector: 'app-member-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './member-modal.component.html',
  styleUrl: './member-modal.component.css'
})
export class MemberModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{ email: string, role: MemberRole }>(); // Update EventEmitter type

  inviteForm: FormGroup;
  memberRoles: MemberRole[] = ['member', 'owner']; // Define available roles

  constructor(private fb: FormBuilder) {
    this.inviteForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      role: ['member', Validators.required] // Default role to 'member'
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