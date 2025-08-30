import { Injectable } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { supabase } from '../supabase.client';

export interface Profile {
  id: string;
  display_name: string;
  phone: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  constructor() {}

  private handleError(error: any, context: string) {
    console.error(`Supabase error in ${context}:`, error);
    return throwError(() => new Error(error.message || `Server error in ${context}`));
  }

  getProfile(): Observable<Profile | null> {
    return from(supabase.from('profiles').select('*').single()).pipe(
      map(response => {
        if (response.error && response.error.code !== 'PGRST116') {
          throw response.error;
        }
        return response.data;
      }),
      catchError(err => this.handleError(err, 'getProfile'))
    );
  }

  updateProfile(profile: Partial<Profile>): Observable<any> {
    const updateData = {
      ...profile,
      updated_at: new Date()
    };
    delete updateData.id;
    
    return from(supabase.from('profiles').update(updateData).eq('id', profile.id!)).pipe(
      catchError(err => this.handleError(err, 'updateProfile'))
    );
  }
}