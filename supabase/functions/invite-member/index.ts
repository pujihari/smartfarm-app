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
    const { email } = await req.json()
    if (!email) {
      throw new Error("Email wajib diisi.");
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // FIX: Safely get the authenticated user to prevent crash on expired session
    const { data: { user: inviter }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !inviter) {
      throw new Error("Otentikasi pengguna gagal. Silakan login kembali.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: inviterMembership, error: inviterError } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', inviter.id)
      .single();

    if (inviterError || !inviterMembership) {
      throw new Error('Profil Anda tidak ditemukan di organisasi manapun.');
    }

    if (inviterMembership.role !== 'owner') {
      throw new Error('Hanya pemilik organisasi yang dapat mengundang anggota baru.');
    }
    
    const { organization_id } = inviterMembership;

    // Check if user is already a member or has a pending invite
    const { data: existingMember } = await supabaseAdmin.rpc('get_member_status_by_email', {
      p_email: email,
      p_org_id: organization_id
    });

    if (existingMember) {
      if (existingMember.status === 'active') {
        throw new Error('Pengguna dengan email ini sudah menjadi anggota aktif organisasi Anda.');
      }
      if (existingMember.status === 'invited') {
        throw new Error('Pengguna dengan email ini sudah memiliki undangan yang tertunda.');
      }
    }

    // FIX: Insert into invites table BEFORE sending email to prevent race condition
    const { error: insertError } = await supabaseAdmin
      .from('invites')
      .insert({
        email,
        organization_id,
        invite_token: 'unused', // Token is handled by Supabase Auth now
        status: 'pending',
        role: 'member'
      });

    if (insertError) {
      throw new Error(`Gagal menyimpan data undangan: ${insertError.message}`);
    }

    // Now, send the invitation email
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteError) {
      // If sending email fails, roll back the invite record
      await supabaseAdmin.from('invites').delete().match({ email, organization_id });
      throw new Error(inviteError.message || 'Gagal mengundang pengguna.');
    }

    return new Response(JSON.stringify({ message: 'Undangan berhasil dikirim.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})