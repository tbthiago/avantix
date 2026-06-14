import { json, normalizeFicha, requireAdmin, STATUS_OPTIONS } from '../_lib/auth.js';
import { sendEmail, statusChangedEmail } from '../_lib/email.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id') || 0);
  const status = url.searchParams.get('status') || '';
  const search = `%${url.searchParams.get('q') || ''}%`;
  const bind = [];
  let where = 'WHERE 1 = 1';

  if (id) {
    where += ' AND f.id = ?';
    bind.push(id);
  }

  if (status && STATUS_OPTIONS[status]) {
    where += ' AND f.status = ?';
    bind.push(status);
  }

  if (!id) {
    where += ` AND (
      f.cliente LIKE ? OR f.paciente LIKE ? OR f.servico LIKE ? OR c.email LIKE ? OR c.clinica LIKE ?
    )`;
    bind.push(search, search, search, search, search);
  }

  const baseSelect = `
    SELECT f.id, f.cliente_id, f.cliente, f.tel, f.cidade, f.uf, f.paciente, f.idade, f.sexo,
           f.data_entrada, f.horario_entrada, f.data_saida, f.horario_saida, f.tipo_entrega,
           f.dentes, f.desinfectado, f.servico, f.obs, f.cor_gengiva, f.cor_dente,
           f.cor_remanescente, f.oclusao, f.personalidade, f.acompanha, f.acompanha_outros,
           f.arquivos_json, __ARQUIVOS_TABLE_SELECT__
           f.status, f.criado_em, f.atualizado_em,
           c.email AS cliente_email, c.clinica AS cliente_clinica
    FROM fichas f
    LEFT JOIN clientes c ON c.id = f.cliente_id
    ${where}
    ORDER BY datetime(f.criado_em) DESC
  `;
  const withArquivoTable = baseSelect.replace('__ARQUIVOS_TABLE_SELECT__', `
           COALESCE((
             SELECT json_group_array(json_object(
               'key', fa.r2_key,
               'name', fa.nome,
               'size', fa.tamanho,
               'type', fa.content_type
             ))
             FROM ficha_arquivos fa
             WHERE fa.ficha_id = f.id
           ), '[]') AS arquivos_table_json,
  `);
  const withoutArquivoTable = baseSelect.replace('__ARQUIVOS_TABLE_SELECT__', '');

  let rows;
  try {
    rows = await env.DB.prepare(withArquivoTable).bind(...bind).all();
  } catch (err) {
    if (!String(err?.message || '').includes('ficha_arquivos')) throw err;
    rows = await env.DB.prepare(withoutArquivoTable).bind(...bind).all();
  }

  return json({ pedidos: (rows.results || []).map(normalizeFicha), statuses: STATUS_OPTIONS });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;

  const data = await request.json();
  const id = Number(data.id);
  const status = String(data.status || '');
  if (!id || !STATUS_OPTIONS[status]) return json({ error: 'Pedido ou status invalido.' }, { status: 400 });

  const order = await env.DB.prepare(`
    SELECT f.id, f.paciente, f.servico, f.status, c.email AS cliente_email
    FROM fichas f
    LEFT JOIN clientes c ON c.id = f.cliente_id
    WHERE f.id = ?
  `).bind(id).first();
  if (!order) return json({ error: 'Pedido nao encontrado.' }, { status: 404 });

  await env.DB.prepare(`
    UPDATE fichas
    SET status = ?, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(status, id).run();

  if (order.cliente_email && order.status !== status) {
    const notification = statusChangedEmail(order, STATUS_OPTIONS[status]);
    context.waitUntil(
      sendEmail(env, { to: order.cliente_email, ...notification })
        .catch((error) => console.error('Status email error:', error))
    );
  }

  return json({ success: true });
}
