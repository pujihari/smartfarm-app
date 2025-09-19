import { Injectable } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { supabase } from '../supabase.client';
import { MemberRole } from '../models/member.model';
import { FunctionsHttpError } from '@supabase/supabase-js'; // Import FunctionsHttpError

// This interface should reflect the data you want to display
export interface MemberDetails {
  id: string; // member id
  user_id: string;
  role: MemberRole;
  email: string;
  status: 'active' | 'invited';
}

@Injectable({ providedIn: 'root' })
export class MemberService {
  constructor() {}

  private handleError(error: any, context: string) {
    console.error(`Supabase error in ${context}:`, error);
    return throwError(() => new Error(error.message || `Server error in ${context}`));
  }

  async inviteMember(email: string, role: MemberRole): Promise<{ data: any, error: string | null }> {
    const { data, error } = await supabase.functions.invoke('invite-member', {
      body: { email, role },
    });

    if (error) {
      console.error("Gagal memanggil fungsi:", error);
      let specificErrorMessage: string | null = null;

      // Check if it's a FunctionsHttpError and try to extract the specific error from its context
      if (error instanceof FunctionsHttpError && error.context && error.context.data && error.context.data.error) {
        specificErrorMessage = error.context.data.error;
      } else if (data && data.error) { // Fallback for cases where data might directly contain error (less likely with FunctionsHttpError)
        specificErrorMessage = data.error;
      }
      
      return { data: null, error: specificErrorMessage || `Gagal menghubungi server: ${error.message}` };
    }
    
    // This block is for cases where the Edge Function might return a 2xx status but still include an 'error' field in its body.
    // This is generally not expected if the Edge Function is designed to return 4xx/5xx for errors.
    if (data && data.error) {
       return { data: null, error: data.error };
    }

    return { data, error: null };
  }

  getMembers(): Observable<MemberDetails[]> {
    return from(supabase.rpc('get_organization_members_with_invites')).pipe(
      map(response => {
        if (response.error) throw response.error;
        return (response.data || []) as MemberDetails[];
      }),
      catchError(err => this.handleError(err, 'getMembers'))
    );
  }

  cancelInvitation(inviteId: string): Observable<any> {
    return from(supabase.from('invites').delete().eq('id', inviteId)).pipe(
      catchError(err => this.handleError(err, 'cancelInvitation'))
    );
  }

  removeMember(userId: string): Observable<any> {
    return from(supabase.rpc('remove_organization_member', { p_user_id_to_remove: userId })).pipe(
      catchError(err => this.handleError(err, 'removeMember'))
    );
  }
}