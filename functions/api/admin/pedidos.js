import { json, normalizeFicha, requireAdmin, STATUS_OPTIONS } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const search = `%${url.searchParams.get('q') || ''}%`;
  const bind = [];
  let where = 'WHERE 1 = 1';

  if (status && STATUS_OPTIONS[status]) {
    where += ' AND f.status = ?';
    bind.push(status);
  }

  where += ` AND (
    f.cliente LIKE ? OR f.paciente LIKE ? OR f.servico LIKE ? OR c.email LIKE ? OR c.clinica LIKE ?
  )`;
  bind.push(search, search, search, search, search);

  const rows = await env.DB.prepare(`
    SELECT f.id, f.cliente_id, f.cliente, f.tel, f.cidade, f.uf, f.paciente, f.idade, f.sexo,
           f.data_entrada, f.horario_entrada, f.data_saida, f.horario_saida, f.tipo_entrega,
           f.dentes, f.desinfectado, f.servico, f.obs, f.cor_gengiva, f.cor_dente,
           f.cor_remanescente, f.oclusao, f.personalidade, f.acompanha, f.acompanha_outros,
           f.arquivos_json, f.status, f.criado_em, f.atualizado_em,
           c.email AS cliente_email, c.clinica AS cliente_clinica
    FROM fichas f
    LEFT JOIN clientes c ON c.id = f.cliente_id
    ${where}
    ORDER BY datetime(f.criado_em) DESC
    LIMIT 200
  `).bind(...bind).all();

  return json({ pedidos: (rows.results || []).map(normalizeFicha), statuses: STATUS_OPTIONS });
}

export async function onRequestPatch({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;

  const data = await request.json();
  const id = Number(data.id);
  const status = String(data.status || '');
  if (!id || !STATUS_OPTIONS[status]) return json({ error: 'Pedido ou status invalido.' }, { status: 400 });

  await env.DB.prepare(`
    UPDATE fichas
    SET status = ?, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(status, id).run();

  return json({ success: true });
}
