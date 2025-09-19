import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrganizationService } from '../../services/organization.service';
import { AuthService } from '../../services/auth.service';
import { Organization } from '../../models/organization.model';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit {
  @Output() menuToggle = new EventEmitter<void>();

  tenantName = 'Memuat...';
  userName = 'Pengguna';
  userInitials = 'P';
  logoUrl: string | null = null;

  constructor(
    private organizationService: OrganizationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.organizationService.organization$.subscribe((profile: Organization | null) => {
      if (profile) {
        this.tenantName = profile.name;
        this.logoUrl = profile.logo_url || null;
      } else {
        this.tenantName = 'Nama Organisasi Belum Diatur';
        this.logoUrl = null;
      }
    });

    combineLatest([
      this.authService.currentUser$,
      this.authService.profile$
    ]).pipe(
      map(([user, profile]) => ({ user, profile }))
    ).subscribe(({ user, profile }) => {
      if (profile?.display_name) {
        this.userName = profile.display_name;
        this.userInitials = profile.display_name.substring(0, 1).toUpperCase();
      } else if (user?.email) {
        this.userName = user.email;
        this.userInitials = user.email.substring(0, 1).toUpperCase();
      }
    });
  }

  onMenuToggle(): void {
    console.log('HeaderComponent: Tombol menu toggle diklik!'); // Log untuk debugging
    this.menuToggle.emit();
  }

  logout(): void {
    console.log('HeaderComponent: Tombol Logout diklik.'); // Log untuk debugging
    this.authService.signOut();
  }
}