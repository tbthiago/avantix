import { createUser, json } from '../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();
    const required = ['nome', 'clinica', 'email', 'password'];
    const missing = required.filter((field) => !String(data[field] || '').trim());
    if (missing.length) return json({ error: `Campos obrigatorios: ${missing.join(', ')}` }, { status: 400 });
    if (String(data.password).length < 6) return json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, { status: 400 });

    const user = await createUser(env, data);
    return json({ success: true, user });
  } catch (err) {
    const message = String(err.message || '');
    if (message.includes('UNIQUE')) return json({ error: 'Este email ja esta cadastrado.' }, { status: 409 });
    return json({ error: 'Nao foi possivel criar o cadastro.' }, { status: 500 });
  }
}
