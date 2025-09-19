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
    map(role => 
      role === 'owner' || 
      role === 'manager' || 
      role === 'supervisor' || 
      role === 'staff_gudang' || 
      role === 'operator_kandang'
    )
  );

  constructor(
    private router: Router,
    private profileService: ProfileService
  ) {
    supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      console.log('AuthService: Auth state changed:', event, session); // Log ini
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
          console.log('AuthService: Navigasi ke halaman login setelah SIGNED_OUT.'); // Log ini
          this.router.navigate(['/login']);
        }
      }
      this._isInitialized.next(true);
    });
  }

  private fetchMemberDetails(userId: string, retries = 3, delay = 1000): void {
    supabase
      .from('organization_members')
      .select('role, organization_id')
      .eq('user_id', userId)
      .single()
      .then(({ data, error }: { data: { role: MemberRole; organization_id: string } | null; error: any }) => {
        if (error && error.code !== 'PGRST116') { // PGRST116 berarti tidak ada baris yang ditemukan
          console.error('AuthService: Error fetching member details:', error);
          this._memberRole.next(null);
          this._organizationId.next(null);
        } else if (!data && retries > 0) {
          // Jika tidak ada data yang ditemukan, coba lagi setelah penundaan
          console.warn(`AuthService: Tidak ada data anggota organisasi ditemukan untuk pengguna ${userId}. Mencoba lagi dalam ${delay}ms... (${retries} percobaan tersisa)`);
          setTimeout(() => this.fetchMemberDetails(userId, retries - 1, delay * 2), delay);
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
    
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
      return { data: null, error: authError };
    }
    if (!authData.user) {
      return { data: null, error: { message: 'Pendaftaran gagal, pengguna tidak dibuat.' } as AuthError };
    }

    return { data: authData, error: null };
  }

  async signOut(): Promise<void> {
    console.log('AuthService: Mencoba untuk keluar via Supabase...'); // Log ini
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('AuthService: Error saat keluar:', error);
    } else {
      console.log('AuthService: Panggilan signOut Supabase selesai tanpa error.'); // Log ini
    }
  }
}