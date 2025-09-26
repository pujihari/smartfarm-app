import { Injectable, NgZone } from '@angular/core'; // Import NgZone
import { Router } from '@angular/router';
import { from, Observable, BehaviorSubject, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { supabase } from '../supabase.client';
import { Session, User, AuthError, AuthChangeEvent, UserAttributes } from '@supabase/supabase-js';
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

  public readonly isManagerOrOwner$: Observable<boolean> = this.memberRole$.pipe(
    map(role => role === 'owner' || role === 'manager')
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
    private profileService: ProfileService,
    private ngZone: NgZone // Inject NgZone
  ) {
    supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      console.log('AuthService: Auth state changed:', event, session);
      this._currentUser.next(session?.user ?? null);
      
      if (session?.user) {
        this.fetchMemberDetails(session.user.id);
        this.fetchProfile();

        this.ngZone.run(() => { // Wrap navigation in ngZone.run()
          if (event === 'USER_UPDATED') {
            // This happens after the user sets their password on the update page.
            console.log('AuthService: User updated. Navigating to /dashboard.');
            this.router.navigate(['/dashboard']);
          }
        });

      } else {
        this._memberRole.next(null);
        this._organizationId.next(null);
        this._profile.next(null);
        this.ngZone.run(() => { // Wrap navigation in ngZone.run()
          if (this.router.url !== '/login' && this.router.url !== '/register' && this.router.url !== '/update-password') {
            console.log('AuthService: Navigating to login page after SIGNED_OUT.');
            this.router.navigate(['/login']);
          }
        });
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
        if (error && error.code !== 'PGRST116') {
          console.error('AuthService: Error fetching member details:', error);
          this._memberRole.next(null);
          this._organizationId.next(null);
        } else if (!data && retries > 0) {
          console.warn(`AuthService: No organization member data found for user ${userId}. Retrying in ${delay}ms... (${retries} retries left)`);
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
    console.log('AuthService: Attempting to sign out via Supabase...');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('AuthService: Error during sign out:', error);
    } else {
      console.log('AuthService: Supabase signOut call completed without error.');
    }
  }

  async updateUser(attributes: UserAttributes) {
    const { data, error } = await supabase.auth.updateUser(attributes);
    if (!error && data.user) {
      if (attributes.data && (attributes.data as any).display_name) {
        await supabase.from('profiles').update({ display_name: (attributes.data as any).display_name }).eq('id', data.user.id);
        this.refreshProfile();
      }
    }
    return { data, error };
  }
}