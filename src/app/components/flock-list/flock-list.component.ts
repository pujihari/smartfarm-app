import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Flock } from '../../models/flock.model';
import { AuthService } from '../../services/auth.service';
import { RouterModule } from '@angular/router'; // Import RouterModule

@Component({
  selector: 'app-flock-list',
  standalone: true,
  imports: [CommonModule, RouterModule], // Add RouterModule here
  templateUrl: './flock-list.component.html',
  styleUrl: './flock-list.component.css'
})
export class FlockListComponent {
  @Input() flocks: Flock[] = [];
  @Input() canWriteData: boolean | null = false;
  @Output() edit = new EventEmitter<Flock>();
  @Output() delete = new EventEmitter<Flock>();

  constructor(public authService: AuthService) {}

  onEdit(flock: Flock): void {
    this.edit.emit(flock);
  }

  onDelete(flock: Flock): void {
    this.delete.emit(flock);
  }
}