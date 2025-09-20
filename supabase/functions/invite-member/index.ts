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
    const { email, role } = await req.json()
    if (!email) throw new Error("Email wajib diisi.");
    
    const validRoles = ['manager', 'supervisor', 'staff_gudang', 'operator_kandang'];
    if (!role || !validRoles.includes(role)) {
      throw new Error(`Peran tidak valid. Harus salah satu dari: ${validRoles.join(', ')}.`);
    }

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get inviter's info using the user's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user: inviter }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !inviter) {
      throw new Error("Otentikasi pengguna gagal. Silakan login kembali.");
    }

    // Get inviter's organization and role
    const { data: inviterMembership, error: inviterError } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', inviter.id)
      .single();

    if (inviterError || !inviterMembership) {
      throw new Error('Profil Anda tidak ditemukan di organisasi manapun.');
    }
    if (inviterMembership.role !== 'owner' && inviterMembership.role !== 'manager') {
      throw new Error('Hanya pemilik atau manajer organisasi yang dapat mengundang anggota baru.');
    }
    
    const organizationId = inviterMembership.organization_id;

    // Check if user already exists in auth.users table
    const { data: { users }, error: userListError } = await supabaseAdmin.auth.admin.listUsers({ email });
    if (userListError) {
        throw new Error(`Gagal mencari pengguna: ${userListError.message}`);
    }
    const existingUser = users.find(u => u.email === email);

    // Check if user is already in the org (active or invited)
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('get_member_status_by_email', {
      p_email: email,
      p_org_id: organizationId
    });
    if (rpcError) throw new Error(`Database error checking member status: ${rpcError.message}`);
    
    const memberStatus = rpcResult && rpcResult.length > 0 ? rpcResult[0].status : null;
    if (memberStatus === 'active') throw new Error('Pengguna dengan email ini sudah menjadi anggota aktif organisasi Anda.');
    if (memberStatus === 'invited') throw new Error('Pengguna dengan email ini sudah memiliki undangan yang tertunda.');

    // --- Logic Branch: Existing User vs New User ---

    if (existingUser) {
      // User exists in Supabase Auth, but not in this organization. Add them directly.
      const { error: insertMemberError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: existingUser.id,
          role: role
        });

      if (insertMemberError) {
        throw new Error(`Gagal menambahkan anggota yang sudah ada ke organisasi: ${insertMemberError.message}`);
      }

      return new Response(JSON.stringify({ message: 'Pengguna yang sudah ada berhasil ditambahkan ke organisasi.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else {
      // User does not exist. Send an invitation.
      const { error: insertInviteError } = await supabaseAdmin
        .from('invites')
        .insert({
          email,
          organization_id: organizationId,
          status: 'pending',
          role: role
        });

      if (insertInviteError) {
        throw new Error(`Gagal menyimpan data undangan: ${insertInviteError.message}`);
      }

      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
      if (inviteError) {
        // Rollback the invite record if email sending fails
        await supabaseAdmin.from('invites').delete().match({ email, organization_id: organizationId });
        throw new Error(inviteError.message || 'Gagal mengundang pengguna.');
      }

      return new Response(JSON.stringify({ message: 'Undangan berhasil dikirim.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})