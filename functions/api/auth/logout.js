import { clearSessionCookie, json, readCookie } from '../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const token = readCookie(request, 'avantix_session');
  if (token) await env.DB.prepare('DELETE FROM sessoes WHERE token = ?').bind(token).run();
  return json({ success: true }, { headers: { 'Set-Cookie': clearSessionCookie() } });
}
