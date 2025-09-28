import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MemberRole } from '../../models/member.model';

interface MenuItem {
  path?: string;
  icon: string;
  name: string;
  requiredRoles?: MemberRole[];
  children?: MenuItem[];
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

  selectedParentMenu: string | null = null;

  menuItems: MenuItem[] = [
    { path: '/dashboard', icon: '📊', name: 'Dashboard' },
    { path: '/health', icon: '❤️', name: 'Kesehatan' },
    {
      icon: '📋',
      name: 'Recording',
      children: [
        { path: '/production/grower', icon: '🐣', name: 'Grower' },
        { path: '/production/layer', icon: '🥚', name: 'Layer' },
      ]
    },
    { path: '/body-weight', icon: '⚖️', name: 'Timbang BB' },
    { path: '/growth-chart', icon: '🌱', name: 'Grafik Pertumbuhan' },
    { path: '/weekly-performance', icon: '📈', name: 'Performa Mingguan' },
    { path: '/inventory', icon: '📦', name: 'Inventori' },
    { path: '/reports', icon: '📄', name: 'Laporan' },
    {
      icon: '⚙️',
      name: 'Pengaturan',
      children: [
        { path: '/farms', icon: '🏞️', name: 'Manajemen Farm' },
        { path: '/flocks', icon: '🐔', name: 'Manajemen Flok' },
        { path: '/members', icon: '👥', name: 'Manajemen Anggota', requiredRoles: ['owner', 'manager'] },
        { path: '/settings', icon: '⚙️', name: 'Pengaturan Organisasi', requiredRoles: ['owner'] },
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