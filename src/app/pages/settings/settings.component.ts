import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { OrganizationService } from '../../services/organization.service';
import { ProfileService, Profile } from '../../services/profile.service';
import { NotificationService } from '../../services/notification.service';
import { Organization } from '../../models/organization.model';
import { AuthService } from '../../services/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  organizationForm: FormGroup;
  userProfileForm: FormGroup;

  isLoading = true;
  isSavingOrg = false;
  isSavingUser = false;

  logoPreview: string | ArrayBuffer | null = null;
  selectedFile: File | null = null;
  currentOrganization: Organization | null = null;
  currentUserProfile: Profile | null = null;
  isOwner$: Observable<boolean>;

  constructor(
    private fb: FormBuilder, 
    private organizationService: OrganizationService,
    private profileService: ProfileService,
    private notificationService: NotificationService,
    public authService: AuthService
  ) {
    this.organizationForm = this.fb.group({
      name: ['', Validators.required],
      logo_url: ['']
    });

    this.userProfileForm = this.fb.group({
      display_name: ['', Validators.required],
      phone: ['']
    });

    this.isOwner$ = this.authService.isOwner$;
  }

  ngOnInit(): void {
    this.isOwner$.subscribe(isOwner => {
      if (!isOwner) {
        this.organizationForm.disable();
      }
    });

    this.organizationService.organization$.subscribe((org: Organization | null) => {
      if (org) {
        this.currentOrganization = org;
        this.organizationForm.patchValue(org);
        if (org.logo_url) {
          this.logoPreview = org.logo_url;
        } else {
          this.logoPreview = null;
        }
      }
      this.isLoading = false;
    });

    this.authService.profile$.subscribe((profile: Profile | null) => {
      if (profile) {
        this.currentUserProfile = profile;
        this.userProfileForm.patchValue(profile);
      }
    });
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      this.selectedFile = target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.logoPreview = reader.result;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  async onSaveOrganization(): Promise<void> {
    if (this.organizationForm.invalid) return;
    this.isSavingOrg = true;

    let logoUrl = this.currentOrganization?.logo_url || null;

    try {
      if (this.selectedFile) {
        logoUrl = await this.organizationService.uploadLogo(this.selectedFile);
      }

      const orgData = {
        name: this.organizationForm.value.name,
        logo_url: logoUrl
      };

      this.organizationService.updateOrganization(orgData).subscribe({
        next: () => {
          this.isSavingOrg = false;
          this.selectedFile = null;
          this.notificationService.showSuccess('Profil organisasi berhasil diperbarui!');
        },
        error: (err: any) => {
          this.isSavingOrg = false;
          this.notificationService.showError('Gagal memperbarui profil organisasi.');
        }
      });
    } catch (error) {
      this.isSavingOrg = false;
      this.notificationService.showError('Gagal mengunggah logo.');
    }
  }

  onSaveUserProfile(): void {
    if (this.userProfileForm.invalid || !this.currentUserProfile) return;
    this.isSavingUser = true;

    const profileData: Partial<Profile> = {
      id: this.currentUserProfile.id,
      ...this.userProfileForm.value
    };

    this.profileService.updateProfile(profileData).subscribe({
      next: () => {
        this.isSavingUser = false;
        this.authService.refreshProfile();
        this.notificationService.showSuccess('Profil Anda berhasil diperbarui!');
      },
      error: (err: any) => {
        this.isSavingUser = false;
        this.notificationService.showError('Gagal memperbarui profil pengguna.');
      }
    });
  }
}