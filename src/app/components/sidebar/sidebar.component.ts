import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  @Output() itemClicked = new EventEmitter<void>();

  menuItems = [
    { path: '/dashboard', icon: '📊', name: 'Dashboard', ownerOnly: false },
    { path: '/farms', icon: '🏞️', name: 'Manajemen Farm', ownerOnly: false },
    { path: '/flocks', icon: '🐔', name: 'Manajemen Flok', ownerOnly: false },
    { path: '/health', icon: '❤️', name: 'Kesehatan', ownerOnly: false },
    { path: '/production', icon: '🥚', name: 'Produksi', ownerOnly: false },
    { path: '/body-weight', icon: '⚖️', name: 'Timbang BB', ownerOnly: false },
    { path: '/weekly-performance', icon: '📈', name: 'Performa Mingguan', ownerOnly: false }, // Diperbarui
    { path: '/inventory', icon: '📦', name: 'Inventori', ownerOnly: false },
    { path: '/reports', icon: '📄', name: 'Laporan', ownerOnly: false },
    { path: '/members', icon: '👥', name: 'Manajemen Anggota', ownerOnly: true },
    { path: '/settings', icon: '⚙️', name: 'Pengaturan', ownerOnly: true },
  ];

  constructor(public authService: AuthService) {}

  onItemClick(): void {
    this.itemClicked.emit();
  }
}