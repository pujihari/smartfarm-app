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

      if (error instanceof FunctionsHttpError) {
        const errorBody = error.context?.data;
        // Log the full error context data to understand its structure
        console.log("FunctionsHttpError context data:", errorBody); 
        if (errorBody && typeof errorBody === 'object' && errorBody !== null && 'error' in errorBody) {
          specificErrorMessage = (errorBody as { error: string }).error;
        }
      }
      
      return { data: null, error: specificErrorMessage || `Gagal menghubungi server: ${error.message}` };
    }
    
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