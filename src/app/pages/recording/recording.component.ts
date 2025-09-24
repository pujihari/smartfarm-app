import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-recording',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recording.component.html',
  styleUrls: ['./recording.component.css']
})
export class RecordingComponent {
  feeds: { name: string, amount: number }[] = [];
  eggProduction = {
    normal: {
      count: 0,
      weight: 0
    },
    broken: {
      count: 0,
      weight: 0
    },
    cracked: {
      count: 0,
      weight: 0
    }
  };
  notes: string = '';

  addFeed() {
    this.feeds.push({ name: '', amount: 0 });
  }

  onSubmit() {
    // Implement submission logic here
    console.log('Form submitted', {
      feeds: this.feeds,
      eggProduction: this.eggProduction,
      notes: this.notes
    });
  }
}