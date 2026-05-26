import { json, normalizeFicha, requireUser } from './_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  const rows = await env.DB.prepare(`
    SELECT id, cliente_id, cliente, paciente, servico, data_entrada, data_saida, horario_saida,
           tipo_entrega, dentes, status, obs, arquivos_json, criado_em, atualizado_em
    FROM fichas
    WHERE cliente_id = ? OR lower(cliente) = lower(?)
    ORDER BY datetime(criado_em) DESC
    LIMIT 100
  `).bind(auth.user.id, auth.user.clinica || auth.user.nome).all();

  return json({ pedidos: (rows.results || []).map(normalizeFicha) });
}
