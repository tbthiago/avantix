import { json, normalizeFicha, requireUser } from './_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  const baseSelect = `
    SELECT id, cliente_id, cliente, paciente, servico, data_entrada, data_saida, horario_saida,
           tipo_entrega, dentes, status, obs, arquivos_json,
           __ARQUIVOS_TABLE_SELECT__
           criado_em, atualizado_em
    FROM fichas
    WHERE cliente_id = ? OR lower(cliente) = lower(?)
    ORDER BY datetime(criado_em) DESC
    LIMIT 100
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
             WHERE fa.ficha_id = fichas.id
           ), '[]') AS arquivos_table_json,
  `);
  const withoutArquivoTable = baseSelect.replace('__ARQUIVOS_TABLE_SELECT__', '');

  let rows;
  try {
    rows = await env.DB.prepare(withArquivoTable)
      .bind(auth.user.id, auth.user.clinica || auth.user.nome).all();
  } catch (error) {
    if (!String(error?.message || '').includes('ficha_arquivos')) throw error;
    rows = await env.DB.prepare(withoutArquivoTable)
      .bind(auth.user.id, auth.user.clinica || auth.user.nome).all();
  }

  return json({ pedidos: (rows.results || []).map(normalizeFicha) });
}
