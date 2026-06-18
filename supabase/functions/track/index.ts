// Edge Function: track  (server-side do tracking-kit, SEM n8n)
// Browser -> esta função -> dedup + insert (evolutto_tracking_events) + Meta CAPI + GA4 MP.
// O event_id é o mesmo do Pixel no browser => Meta deduplica.
//
// Deploy:  supabase functions deploy track --no-verify-jwt
// Secrets: supabase secrets set META_PIXEL_ID=434582544603444 META_CAPI_TOKEN=<TOKEN_NOVO> \
//          META_TEST_CODE=TEST36824 GA4_MEASUREMENT_ID=G-Y3C4XJD784 GA4_API_SECRET=<opcional>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' };

// eventos enviados pro Meta CAPI / GA4 server
const CONV = ['Lead', 'PageView', 'Contact', 'Schedule', 'Purchase', 'InitiateCheckout', 'ViewContent', 'CompleteRegistration', 'StartTrial', 'Subscribe'];
const GA4_MAP: Record<string, string> = { Lead: 'generate_lead', PageView: 'page_view', Purchase: 'purchase', Contact: 'contact', Schedule: 'schedule', InitiateCheckout: 'begin_checkout', ViewContent: 'view_item', CompleteRegistration: 'sign_up', Subscribe: 'subscribe' };

async function sha256(v?: string) {
  if (!v) return undefined;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function metaCapi(e: any, ip: string, ua: string) {
  const pixel = Deno.env.get('META_PIXEL_ID'); const token = Deno.env.get('META_CAPI_TOKEN');
  if (!pixel || !token || CONV.indexOf(e.event_name) === -1) return false;
  const em = e.email_hash || (await sha256(e.email));
  const ph = e.phone_hash || (await sha256((e.phone || '').replace(/\D/g, '')));
  const fbc = e.fbc || (e.fbclid ? `fb.1.${Date.now()}.${e.fbclid}` : undefined);
  const user_data: Record<string, any> = { client_ip_address: ip, client_user_agent: ua };
  if (em) user_data.em = [em];
  if (ph) user_data.ph = [ph];
  if (e.fbp) user_data.fbp = e.fbp;
  if (fbc) user_data.fbc = fbc;
  if (e.external_id || em) user_data.external_id = [e.external_id || em];
  const body: any = {
    data: [{
      event_name: e.event_name, event_time: e.event_time || Math.floor(Date.now() / 1000),
      event_id: e.event_id, action_source: 'website', event_source_url: e.page_url, user_data,
      custom_data: e.properties || {},
    }],
  };
  const test = Deno.env.get('META_TEST_CODE'); if (test) body.test_event_code = test;
  const r = await fetch(`https://graph.facebook.com/v21.0/${pixel}/events?access_token=${token}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return r.ok;
}

async function ga4mp(e: any) {
  const mid = Deno.env.get('GA4_MEASUREMENT_ID'); const secret = Deno.env.get('GA4_API_SECRET');
  if (!mid || !secret) return false;
  const name = GA4_MAP[e.event_name] || e.event_name.toLowerCase();
  const r = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${mid}&api_secret=${secret}`, {
    method: 'POST',
    body: JSON.stringify({ client_id: e.ga_client_id || e.visitor_id || crypto.randomUUID(), events: [{ name, params: e.properties || {} }] }),
  });
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('no', { status: 405, headers: cors });
  try {
    const e = await req.json();
    if (!e.event_id || !e.event_name) return new Response(JSON.stringify({ error: 'event_id/event_name' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    const ua = req.headers.get('user-agent') || e.user_agent || '';

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const row = {
      client_name: e.client_name || 'evolutto', kit_version: e._v || null,
      event_id: e.event_id, event_name: e.event_name,
      event_time: e.event_time ? new Date(e.event_time * 1000).toISOString() : new Date().toISOString(),
      visitor_id: e.visitor_id, session_id: e.session_id, external_id: e.external_id,
      email: e.email, email_hash: e.email_hash, phone: e.phone, phone_hash: e.phone_hash,
      gclid: e.gclid, fbclid: e.fbclid, fbp: e.fbp, fbc: e.fbc, ga_client_id: e.ga_client_id,
      page_url: e.page_url, page_path: e.page_path, referrer: e.referrer,
      ip_address: ip || null, user_agent: ua,
      journey: e.journey || null, properties: e.properties || {}, raw: e,
    };
    // dedup pelo event_id (índice único). Só envia pras plataformas se for novo.
    const { data: ins } = await supabase.from('evolutto_tracking_events').upsert(row, { onConflict: 'event_id', ignoreDuplicates: true }).select('id');
    const isNew = Array.isArray(ins) && ins.length > 0;

    if (isNew) {
      try { await metaCapi(e, ip, ua); } catch (_) {}
      try { await ga4mp(e); } catch (_) {}
    }
    return new Response(JSON.stringify({ ok: true, deduped: !isNew }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
