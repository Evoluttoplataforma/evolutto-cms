// Edge Function: create-user
// Cria um usuário do CMS (Auth + perfil). Só um usuário logado pode chamar.
// Usa a service_role (disponível no ambiente da função) para a API admin.
//
// Deploy:  supabase functions deploy create-user
// (não precisa de secret extra — SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são automáticos)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('no', { status: 405, headers: cors });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    // valida que quem chamou está logado
    const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'não autorizado' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });

    const { nome, email, senha, papel } = await req.json();
    if (!email || !senha) return new Response(JSON.stringify({ error: 'email e senha são obrigatórios' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    // cliente admin (service_role) para criar o usuário
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password: senha, email_confirm: true, user_metadata: { nome: nome || email.split('@')[0] },
    });
    if (cErr) return new Response(JSON.stringify({ error: cErr.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    // atualiza o perfil (o trigger já criou a linha) com nome/papel
    await admin.from('evolutto_profiles').update({ nome: nome || email.split('@')[0], papel: papel || 'Autor', email }).eq('id', created.user!.id);

    return new Response(JSON.stringify({ ok: true, id: created.user!.id }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
