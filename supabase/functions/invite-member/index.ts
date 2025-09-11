// @ts-nocheck

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  console.log('Invite-member function received request.'); // Log awal
  console.log('Request method:', req.method);
  console.log('Content-Type header:', req.headers.get('Content-Type'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Attempting to parse request body...');
    const { email } = await req.json()
    console.log('Parsed email from request body:', email);

    if (!email) {
      throw new Error("Email wajib diisi.");
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    console.log('Fetching inviter user details...');
    const { data: { user: inviter }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !inviter) {
      console.error('Authentication error or inviter not found:', authError);
      throw new Error("Otentikasi pengguna gagal. Silakan login kembali.");
    }
    console.log('Inviter user ID:', inviter.id);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Fetching inviter membership details...');
    const { data: inviterMembership, error: inviterError } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', inviter.id)
      .single();

    if (inviterError || !inviterMembership) {
      console.error('Inviter membership error or not found:', inviterError);
      throw new Error('Profil Anda tidak ditemukan di organisasi manapun.');
    }
    console.log('Inviter role:', inviterMembership.role);
    console.log('Inviter organization ID:', inviterMembership.organization_id);

    if (inviterMembership.role !== 'owner') {
      throw new Error('Hanya pemilik organisasi yang dapat mengundang anggota baru.');
    }
    
    const organizationId = inviterMembership.organization_id; // Dapatkan ID organisasi pengundang

    console.log('Checking member status by email...');
    // Periksa apakah pengguna sudah menjadi anggota atau memiliki undangan yang tertunda
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('get_member_status_by_email', {
      p_email: email,
      p_org_id: organizationId
    });

    if (rpcError) {
      console.error('RPC error get_member_status_by_email:', rpcError);
      throw new Error(`Database error checking member status: ${rpcError.message}`);
    }
    console.log('RPC result for member status:', rpcResult);

    const memberStatus = rpcResult && rpcResult.length > 0 ? rpcResult[0].status : null;

    if (memberStatus === 'active') {
      throw new Error('Pengguna dengan email ini sudah menjadi anggota aktif organisasi Anda.');
    }
    if (memberStatus === 'invited') {
      throw new Error('Pengguna dengan email ini sudah memiliki undangan yang tertunda.');
    }

    console.log('Inserting invite record...');
    // Masukkan ke tabel invites
    const { error: insertError } = await supabaseAdmin
      .from('invites')
      .insert({
        email,
        organization_id: organizationId,
        invite_token: 'unused', // Token ditangani oleh Supabase Auth
        status: 'pending',
        role: 'member'
      });

    if (insertError) {
      console.error('Error inserting invite record:', insertError);
      throw new Error(`Gagal menyimpan data undangan: ${insertError.message}`);
    }
    console.log('Invite record inserted successfully.');

    console.log('Inviting user by email via Supabase Auth Admin...');
    // Kirim email undangan
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteError) {
      console.error('Error inviting user by email:', inviteError);
      // Jika pengiriman email gagal, batalkan catatan undangan
      await supabaseAdmin.from('invites').delete().match({ email, organization_id: organizationId });
      throw new Error(inviteError.message || 'Gagal mengundang pengguna.');
    }
    console.log('User invited by email successfully.');

    return new Response(JSON.stringify({ message: 'Undangan berhasil dikirim.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Caught error in invite-member function:', error.message); // Log error yang tertangkap
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})