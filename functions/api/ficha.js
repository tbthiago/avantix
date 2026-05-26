/**
 * Avantix Lab — Cloudflare Pages Function
 * POST /api/ficha
 *
 * Handles:
 *  1. File uploads → Cloudflare R2 bucket
 *  2. Form data    → Cloudflare D1 database
 *
 * Bindings required in wrangler.toml / Pages dashboard:
 *  - DB  : D1 database  (binding name: DB)
 *  - R2  : R2 bucket    (binding name: BUCKET)
 */

import { getSessionUser } from './_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  // ─── CORS headers ────────────────────────────────
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const formData = await request.formData();
    const user = await getSessionUser(request, env);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Faça login para criar um novo pedido.' }),
        { status: 401, headers }
      );
    }

    // ─── Extract scalar fields ────────────────────
    const fields = {
      cliente_id:        user?.id || null,
      cliente:           user?.clinica || formData.get('cliente') || '',
      tel:               user?.telefone || formData.get('tel') || '',
      cidade:            user?.cidade || formData.get('cidade') || '',
      uf:                user?.uf || formData.get('uf') || '',
      paciente:          formData.get('paciente')          || '',
      idade:             formData.get('idade')             || null,
      sexo:              formData.get('sexo')              || '',
      data_entrada:      formData.get('data_entrada')      || null,
      horario_entrada:   formData.get('horario_entrada')   || null,
      data_saida:        formData.get('data_saida')        || null,
      horario_saida:     formData.get('horario_saida')     || null,
      tipo_entrega:      formData.get('tipo_entrega')      || '',
      dentes:            formData.get('dentes_selecionados') || '',
      desinfectado:      formData.get('desinfectado')      || '',
      servico:           formData.get('servico')           || '',
      obs:               formData.get('obs')               || '',
      cor_gengiva:       formData.get('cor_gengiva')       || '',
      cor_dente:         formData.get('cor_dente')         || '',
      cor_remanescente:  formData.get('cor_remanescente')  || '',
      oclusao:           formData.get('oclusao')           || '',
      personalidade:     formData.get('personalidade')     || '',
      acompanha:         formData.getAll('acompanha[]').join(','),
      acompanha_outros:  formData.get('acompanha_outros')  || '',
    };

    // Basic validation
    if (!fields.cliente || !fields.paciente || !fields.servico) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios ausentes: cliente, paciente, servico' }),
        { status: 400, headers }
      );
    }

    // ─── Upload files to R2 ───────────────────────
    const uploadedFiles = [];
    const files = formData.getAll('files');

    for (const file of files) {
      if (!(file instanceof File) || file.size === 0) continue;

      // Sanitize filename
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const timestamp    = Date.now();
      const r2Key        = `fichas/${timestamp}_${safeFileName}`;

      // Size limit: 100MB
      if (file.size > 100 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ error: `Arquivo ${file.name} excede o limite de 100MB.` }),
          { status: 413, headers }
        );
      }

      await env.BUCKET.put(r2Key, file.stream(), {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
        customMetadata: {
          originalName: file.name,
          uploadedAt:   new Date().toISOString(),
          paciente:     fields.paciente,
          cliente:      fields.cliente,
        },
      });

      uploadedFiles.push({ key: r2Key, name: file.name, size: file.size });
    }

    // ─── Insert into D1 ───────────────────────────
    const arquivos_json = JSON.stringify(uploadedFiles);

    const result = await env.DB.prepare(`
      INSERT INTO fichas (
        cliente_id, cliente, tel, cidade, uf,
        paciente, idade, sexo,
        data_entrada, horario_entrada, data_saida, horario_saida,
        tipo_entrega, dentes, desinfectado,
        servico, obs,
        cor_gengiva, cor_dente, cor_remanescente,
        oclusao, personalidade,
        acompanha, acompanha_outros,
        arquivos_json, criado_em
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, CURRENT_TIMESTAMP
      )
    `).bind(
      fields.cliente_id, fields.cliente, fields.tel, fields.cidade, fields.uf,
      fields.paciente, fields.idade, fields.sexo,
      fields.data_entrada, fields.horario_entrada, fields.data_saida, fields.horario_saida,
      fields.tipo_entrega, fields.dentes, fields.desinfectado,
      fields.servico, fields.obs,
      fields.cor_gengiva, fields.cor_dente, fields.cor_remanescente,
      fields.oclusao, fields.personalidade,
      fields.acompanha, fields.acompanha_outros,
      arquivos_json
    ).run();

    return new Response(
      JSON.stringify({
        success: true,
        id:      result.meta?.last_row_id,
        files:   uploadedFiles.length,
        message: 'Ficha recebida com sucesso.',
      }),
      { status: 200, headers }
    );

  } catch (err) {
    console.error('Ficha submission error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno do servidor.' }),
      { status: 500, headers }
    );
  }
}

// ─── Handle CORS preflight ────────────────────────
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
