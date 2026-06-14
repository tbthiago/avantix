import { json, requireAdmin } from '../_lib/auth.js';
import { sendEmail } from '../_lib/email.js';

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;

  try {
    const data = await request.json().catch(() => ({}));
    const to = String(data.to || env.NOTIFY_EMAIL || 'contato@avantixlabor.com.br').trim();
    const result = await sendEmail(env, {
      to,
      subject: 'Teste SMTP - Avantix Laboratorio',
      html: `
        <h2>Teste de envio SMTP</h2>
        <p>O envio automatico do sistema Avantix esta funcionando.</p>
        <p>Executado em ${new Date().toISOString()}.</p>
      `,
    });
    return json(result);
  } catch (error) {
    return json({
      success: false,
      error: String(error?.message || error),
    }, { status: 502 });
  }
}
