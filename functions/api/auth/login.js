import { createSession, json, sessionCookie, verifyPassword } from '../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();
    const email = String(data.email || '').trim().toLowerCase();
    const password = String(data.password || '');
    const user = await env.DB.prepare(`
      SELECT id, nome, clinica, email, telefone, cidade, uf, role, senha_hash
      FROM clientes
      WHERE email = ?
    `).bind(email).first();

    if (!user || !(await verifyPassword(password, user.senha_hash))) {
      return json({ error: 'Email ou senha invalidos.' }, { status: 401 });
    }

    const token = await createSession(env, user.id);
    delete user.senha_hash;
    return json({ success: true, user }, { headers: { 'Set-Cookie': sessionCookie(token) } });
  } catch {
    return json({ error: 'Nao foi possivel fazer login.' }, { status: 500 });
  }
}
