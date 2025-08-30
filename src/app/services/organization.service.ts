import { Injectable } from '@angular/core';
import { from, Observable, throwError, of, BehaviorSubject } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { Organization } from '../models/organization.model';
import { supabase } from '../supabase.client';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private organizationProfile = new BehaviorSubject<Organization | null>(null);
  public organization$ = this.organizationProfile.asObservable();

  private organizationId: string | null = null;

  constructor(private authService: AuthService) {
    this.authService.organizationId$.subscribe(id => {
      this.organizationId = id;
      if (id) {
        this.loadOrganization(id);
      } else {
        this.organizationProfile.next(null);
      }
    });
  }

  private handleError(error: any, context: string) {
    console.error(`Supabase error in ${context}:`, error);
    this.organizationProfile.next(null); // Clear profile on error
    return throwError(() => new Error(error.message || `Server error in ${context}`));
  }

  private loadOrganization(orgId: string): void {
    from(supabase.from('organizations').select('*').eq('id', orgId).single()).pipe(
      map(response => {
        if (response.error && response.error.code !== 'PGRST116') {
          throw response.error;
        }
        return response.data as Organization | null;
      }),
      catchError(err => this.handleError(err, 'loadOrganization'))
    ).subscribe(profile => {
      this.organizationProfile.next(profile);
    });
  }

  getOrganization(): Observable<Organization | null> {
    return this.organization$;
  }

  updateOrganization(profile: { name: string, logo_url: string | null }): Observable<any> {
    return from(supabase.from('organizations').update(profile).eq('id', this.organizationId!)).pipe(
      tap(() => {
        // After successful update, reload the organization data
        if (this.organizationId) {
          this.loadOrganization(this.organizationId);
        }
      }),
      catchError(err => this.handleError(err, 'updateOrganization'))
    );
  }

  async uploadLogo(file: File): Promise<string> {
    if (!this.organizationId) {
      throw new Error("ID Organisasi tidak tersedia. Tidak dapat mengunggah logo.");
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${this.organizationId}/${Date.now()}.${fileExt}`;
    
    // First, remove old logo if it exists to save space
    const { data: files, error: listError } = await supabase.storage.from('logos').list(this.organizationId, { limit: 100 });
    if (listError) console.error("Error listing old logos:", listError);
    if (files && files.length > 0) {
      const fileNames = files.map((f) => `${this.organizationId}/${f.name}`);
      const { error: removeError } = await supabase.storage.from('logos').remove(fileNames);
      if (removeError) console.error("Error removing old logos:", removeError);
    }

    // Upload the new logo
    const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file);
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
    return data.publicUrl;
  }
}