import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface MenuItem {
  path?: string; // Optional for parent items
  icon: string;
  name: string;
  ownerOnly: boolean;
  children?: MenuItem[]; // For nested items
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  @Output() itemClicked = new EventEmitter<void>();

  selectedParentMenu: string | null = null; // State untuk melacak menu induk yang diperluas

  menuItems: MenuItem[] = [
    { path: '/dashboard', icon: '📊', name: 'Dashboard', ownerOnly: false },
    { path: '/health', icon: '❤️', name: 'Kesehatan', ownerOnly: false },
    { path: '/production', icon: '🥚', name: 'Produksi', ownerOnly: false },
    { path: '/body-weight', icon: '⚖️', name: 'Timbang BB', ownerOnly: false },
    { path: '/weekly-performance', icon: '📈', name: 'Performa Mingguan', ownerOnly: false },
    { path: '/inventory', icon: '📦', name: 'Inventori', ownerOnly: false },
    { path: '/reports', icon: '📄', name: 'Laporan', ownerOnly: false },
    {
      icon: '⚙️',
      name: 'Pengaturan',
      ownerOnly: false, // Menu induk 'Pengaturan' tidak ownerOnly agar selalu terlihat
      children: [
        { path: '/farms', icon: '🏞️', name: 'Manajemen Farm', ownerOnly: false },
        { path: '/flocks', icon: '🐔', name: 'Manajemen Flok', ownerOnly: false },
        { path: '/members', icon: '👥', name: 'Manajemen Anggota', ownerOnly: true },
        { path: '/settings', icon: '⚙️', name: 'Pengaturan Organisasi', ownerOnly: true },
      ]
    },
  ];

  constructor(public authService: AuthService) {}

  onItemClick(): void {
    this.itemClicked.emit();
  }

  toggleParentMenu(menuName: string): void {
    this.selectedParentMenu = this.selectedParentMenu === menuName ? null : menuName;
  }
}