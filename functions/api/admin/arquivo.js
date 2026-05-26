import { json, requireAdmin } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  if (!key.startsWith('fichas/')) {
    return json({ error: 'Arquivo invalido.' }, { status: 400 });
  }

  const object = await env.BUCKET.get(key);
  if (!object) return json({ error: 'Arquivo nao encontrado.' }, { status: 404 });

  const originalName = object.customMetadata?.originalName || key.split('/').pop() || 'arquivo';
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', headers.get('Content-Type') || 'application/octet-stream');
  headers.set('Content-Disposition', `attachment; filename="${originalName.replace(/"/g, '')}"`);
  headers.set('Cache-Control', 'private, max-age=60');

  return new Response(object.body, { headers });
}
