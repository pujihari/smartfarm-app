import { Component, ChangeDetectorRef } from '@angular/core'; // Import ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent, SidebarComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent {
  isSidebarOpen = false;

  constructor(private cdr: ChangeDetectorRef) {} // Inject ChangeDetectorRef

  toggleSidebar(): void {
    console.log('LayoutComponent: toggleSidebar() dipanggil. Status saat ini:', this.isSidebarOpen); // Log untuk debugging
    this.isSidebarOpen = !this.isSidebarOpen;
    console.log('LayoutComponent: Status sidebar baru:', this.isSidebarOpen); // Log untuk debugging
    this.cdr.detectChanges(); // Memaksa deteksi perubahan untuk memperbarui tampilan
  }

  closeSidebar(): void {
    console.log('LayoutComponent: closeSidebar() dipanggil.'); // Log untuk debugging
    this.isSidebarOpen = false;
    this.cdr.detectChanges(); // Memaksa deteksi perubahan
  }
}