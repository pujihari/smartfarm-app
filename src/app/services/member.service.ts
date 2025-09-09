import { Injectable } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { supabase } from '../supabase.client';

// This interface should reflect the data you want to display
export interface MemberDetails {
  id: string; // member id
  user_id: string;
  role: 'owner' | 'member';
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

  getMembers(): Observable<MemberDetails[]> {
    // This is a more complex query now. We need to join members with users and check invites.
    // This is a simplified version. A database function would be better.
    return from(supabase.rpc('get_organization_members_with_invites')).pipe(
      map((response: any) => {
        if (response.error) throw response.error;
        return response.data as MemberDetails[];
      }),
      catchError(err => this.handleError(err, 'getMembers'))
    );
  }

  async inviteMember(email: string): Promise<{ data: any, error: string | null }> {
    const { data, error } = await supabase.functions.invoke('invite-member', {
      body: { email },
    });

    if (error) {
      console.error("Gagal memanggil fungsi:", error);
      // Check if the error is a FunctionsHttpError and if data contains a specific error message
      if (data && data.error) {
        return { data: null, error: data.error }; // Use the specific error message from the Edge Function
      }
      return { data: null, error: `Gagal menghubungi server: ${error.message}` }; // Fallback to generic message
    }
    
    // This block is technically redundant if the above logic is correct,
    // as a successful 2xx response from the Edge Function would not have `data.error`.
    // However, keeping it for robustness if the Edge Function somehow returns 2xx with an error field.
    if (data && data.error) {
       return { data: null, error: data.error };
    }

    return { data, error: null };
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