// @ts-nocheck

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { inviteId } = await req.json();
    if (!inviteId) {
      throw new Error("ID Undangan wajib diisi.");
    }

    // Create a Supabase client with the service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Find the invitation to get the user's email
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('invites')
      .select('email')
      .eq('id', inviteId)
      .single();

    if (inviteError) {
      throw new Error(`Tidak dapat menemukan undangan: ${inviteError.message}`);
    }

    const { email } = invite;

    // 2. Find the user in auth.users by email
    const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers({ email });
    if (userError) {
      throw new Error(`Gagal mencari pengguna: ${userError.message}`);
    }

    const userToDelete = users.find(u => u.email === email && u.confirmed_at === null);

    // 3. If the user exists and is unconfirmed, delete them from auth
    if (userToDelete) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.id);
      if (deleteError) {
        // Log the error but proceed to delete the invite record anyway
        console.error(`Gagal menghapus pengguna dari auth: ${deleteError.message}`);
      }
    }

    // 4. Delete the invitation record from public.invites
    const { error: deleteInviteError } = await supabaseAdmin
      .from('invites')
      .delete()
      .eq('id', inviteId);

    if (deleteInviteError) {
      throw new Error(`Gagal menghapus catatan undangan: ${deleteInviteError.message}`);
    }

    return new Response(JSON.stringify({ message: 'Undangan berhasil dibatalkan.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})