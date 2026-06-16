// Edge Function: submit-lead
// Recebe o POST do formulário (diagnóstico / vaga / isca), grava em `leads`
// e adiciona/atualiza o contato no Mailchimp.
//
// Deploy:  supabase functions deploy submit-lead --no-verify-jwt
// Secrets: supabase secrets set MAILCHIMP_API_KEY=... MAILCHIMP_SERVER_PREFIX=usX MAILCHIMP_AUDIENCE_ID=...
//          (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm do ambiente)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

async function toMailchimp(lead: Record<string, any>) {
  const key = Deno.env.get('MAILCHIMP_API_KEY');
  const prefix = Deno.env.get('MAILCHIMP_SERVER_PREFIX'); // ex: us21
  const audience = Deno.env.get('MAILCHIMP_AUDIENCE_ID');
  if (!key || !prefix || !audience || !lead.email) return false;

  const url = `https://${prefix}.api.mailchimp.com/3.0/lists/${audience}/members`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `apikey ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email_address: lead.email,
      status: 'subscribed',
      merge_fields: {
        FNAME: lead.nome ?? '',
        PHONE: lead.telefone ?? '',
        EMPRESA: lead.empresa ?? '',
        FATURAMENT: lead.faturamento ?? '',
        EUSOU: lead.eu_sou ?? '',
      },
      tags: [lead.tipo ?? 'diagnostico'],
    }),
  });
  // 200 = novo; 400 com title "Member Exists" também é ok
  return res.ok || res.status === 400;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  try {
    const lead = await req.json();
    if (!lead.nome || !lead.telefone) {
      return new Response(JSON.stringify({ error: 'nome e telefone obrigatórios' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let mc = false;
    try { mc = await toMailchimp(lead); } catch (_) { mc = false; }

    const { error } = await supabase.from('leads').insert({
      nome: lead.nome, telefone: lead.telefone, email: lead.email ?? null,
      empresa: lead.empresa ?? null, oque_faz: lead.oque_faz ?? null,
      eu_sou: lead.eu_sou ?? null, minha_empresa: lead.minha_empresa ?? null,
      consultores: lead.consultores ?? null, projetos_entregues: lead.projetos_entregues ?? null,
      projetos_ativos: lead.projetos_ativos ?? null, faturamento: lead.faturamento ?? null,
      tipo: lead.tipo ?? 'diagnostico', origem: lead.origem ?? null, utm: lead.utm ?? null,
      enviado_mailchimp: mc,
    });
    if (error) throw error;

    // (Opcional) repassar para um webhook externo de CRM, se configurado
    const crm = Deno.env.get('CRM_WEBHOOK_URL');
    if (crm) { try { await fetch(crm, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) }); } catch (_) {} }

    return new Response(JSON.stringify({ ok: true, mailchimp: mc }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
