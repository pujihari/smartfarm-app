import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { from, Observable, BehaviorSubject, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { supabase } from '../supabase.client';
import { Session, User, AuthError, AuthChangeEvent } from '@supabase/supabase-js';
import { MemberRole } from '../models/member.model';
import { ProfileService, Profile } from './profile.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _currentUser = new BehaviorSubject<User | null>(null);
  public readonly currentUser$ = this._currentUser.asObservable();

  private _profile = new BehaviorSubject<Profile | null>(null);
  public readonly profile$ = this._profile.asObservable();

  private _memberRole = new BehaviorSubject<MemberRole | null>(null);
  public readonly memberRole$ = this._memberRole.asObservable();

  private _organizationId = new BehaviorSubject<string | null>(null);
  public readonly organizationId$ = this._organizationId.asObservable();

  private _isInitialized = new BehaviorSubject<boolean>(false);
  public readonly isInitialized$ = this._isInitialized.asObservable();

  public readonly isOwner$: Observable<boolean> = this.memberRole$.pipe(
    map(role => role === 'owner')
  );

  public readonly canWriteData$: Observable<boolean> = this.memberRole$.pipe(
    map(role => role === 'owner' || role === 'member')
  );

  constructor(
    private router: Router,
    private profileService: ProfileService
  ) {
    supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      this._currentUser.next(session?.user ?? null);
      if (session?.user) {
        this.fetchMemberDetails(session.user.id);
        this.fetchProfile();
        if (event === 'SIGNED_IN') {
          this.router.navigate(['/dashboard']);
        }
      } else {
        this._memberRole.next(null);
        this._organizationId.next(null);
        this._profile.next(null);
        if (this.router.url !== '/login' && this.router.url !== '/register') {
          this.router.navigate(['/login']);
        }
      }
      this._isInitialized.next(true);
    });
  }

  private fetchMemberDetails(userId: string): void {
    supabase
      .from('organization_members')
      .select('role, organization_id')
      .eq('user_id', userId)
      .single()
      .then(({ data, error }: { data: { role: MemberRole; organization_id: string } | null; error: any }) => {
        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching member details:', error);
          this._memberRole.next(null);
          this._organizationId.next(null);
        } else {
          this._memberRole.next((data?.role as MemberRole) || null);
          this._organizationId.next(data?.organization_id || null);
        }
      });
  }

  private fetchProfile(): void {
    this.profileService.getProfile().subscribe(profile => {
      this._profile.next(profile);
    });
  }

  public refreshProfile(): void {
    this.fetchProfile();
  }

  get session(): Observable<Session | null> {
    return from(supabase.auth.getSession()).pipe(map(({ data }) => data.session));
  }

  async signIn(credentials: { email: string; password: string }) {
    return supabase.auth.signInWithPassword(credentials);
  }

  async signUp(credentials: { email: string; password: string; organizationName: string }) {
    const { email, password, organizationName } = credentials;
    
    const { data: existingOrg, error: checkError } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', organizationName)
      .limit(1)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      return { data: null, error: { message: `Database error: ${checkError.message}` } as AuthError };
    }
    if (existingOrg) {
      return { data: null, error: { message: 'Nama organisasi sudah digunakan.' } as AuthError };
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
      return { data: null, error: authError };
    }
    if (!authData.user) {
      return { data: null, error: { message: 'Pendaftaran gagal, pengguna tidak dibuat.' } as AuthError };
    }

    const { error: orgError } = await supabase.from('organizations').insert({
      name: organizationName,
      owner_id: authData.user.id,
    });

    if (orgError) {
      // The user has been created and the confirmation email sent.
      // We log the organization creation error for debugging but return success to the user.
      // This prevents showing a confusing error message when the user has received a confirmation email.
      console.error('CRITICAL: User was created, but organization creation failed due to RLS policy. User will not be associated with an organization upon login.', orgError);
    }

    // Return success as long as the user was created, so the frontend can show the "Check your email" message.
    return { data: authData, error: null };
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
    // Navigation is now handled by the onAuthStateChange listener.
  }
}