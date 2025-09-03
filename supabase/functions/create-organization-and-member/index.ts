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
    const { userId, organizationName } = await req.json()

    if (!userId || !organizationName) {
      throw new Error("User ID and Organization Name are required.");
    }

    // Create a Supabase client with the service role key
    // This client bypasses Row Level Security (RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if organization name already exists
    const { data: existingOrg, error: checkError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('name', organizationName)
      .limit(1)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found
      throw new Error(`Database error checking organization name: ${checkError.message}`);
    }
    if (existingOrg) {
      throw new Error('Nama organisasi sudah digunakan.');
    }

    // Insert into organizations table
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({ name: organizationName, owner_id: userId })
      .select('id')
      .single();

    if (orgError) {
      throw new Error(`Gagal membuat organisasi: ${orgError.message}`);
    }

    const organizationId = orgData.id;

    // Insert into organization_members table
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({ organization_id: organizationId, user_id: userId, role: 'owner' });

    if (memberError) {
      // If member creation fails, attempt to roll back organization creation
      await supabaseAdmin.from('organizations').delete().eq('id', organizationId);
      throw new Error(`Gagal menambahkan anggota ke organisasi: ${memberError.message}`);
    }

    return new Response(JSON.stringify({ message: 'Organisasi dan anggota berhasil dibuat.', organizationId }), {
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