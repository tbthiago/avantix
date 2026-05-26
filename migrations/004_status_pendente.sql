PRAGMA foreign_keys = off;

ALTER TABLE fichas RENAME TO fichas_old_pendente;

CREATE TABLE fichas (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id          INTEGER,

  cliente             TEXT NOT NULL,
  tel                 TEXT,
  cidade              TEXT,
  uf                  TEXT(2),

  paciente            TEXT NOT NULL,
  idade               INTEGER,
  sexo                TEXT CHECK(sexo IN ('F', 'M', '')),

  data_entrada        TEXT,
  horario_entrada     TEXT,
  data_saida          TEXT,
  horario_saida       TEXT,

  tipo_entrega        TEXT CHECK(tipo_entrega IN ('prova', 'pronto', '')),
  dentes              TEXT,
  desinfectado        TEXT CHECK(desinfectado IN ('sim', 'nao', '')),

  servico             TEXT NOT NULL,
  obs                 TEXT,

  cor_gengiva         TEXT,
  cor_dente           TEXT,
  cor_remanescente    TEXT,
  oclusao             TEXT,
  personalidade       TEXT,

  acompanha           TEXT,
  acompanha_outros    TEXT,
  arquivos_json       TEXT,

  status              TEXT DEFAULT 'recebido'
                        CHECK(status IN ('recebido', 'pendente', 'triagem', 'em_producao', 'finalizado', 'entregue')),
  criado_em           TEXT DEFAULT (datetime('now')),
  atualizado_em       TEXT
);

INSERT INTO fichas (
  id, cliente_id, cliente, tel, cidade, uf,
  paciente, idade, sexo,
  data_entrada, horario_entrada, data_saida, horario_saida,
  tipo_entrega, dentes, desinfectado,
  servico, obs,
  cor_gengiva, cor_dente, cor_remanescente,
  oclusao, personalidade,
  acompanha, acompanha_outros, arquivos_json,
  status, criado_em, atualizado_em
)
SELECT
  id, cliente_id, cliente, tel, cidade, uf,
  paciente, idade, sexo,
  data_entrada, horario_entrada, data_saida, horario_saida,
  tipo_entrega, dentes, desinfectado,
  servico, obs,
  cor_gengiva, cor_dente, cor_remanescente,
  oclusao, personalidade,
  acompanha, acompanha_outros, arquivos_json,
  CASE status
    WHEN 'recebido' THEN 'recebido'
    WHEN 'pendente' THEN 'pendente'
    WHEN 'triagem' THEN 'triagem'
    WHEN 'em_producao' THEN 'em_producao'
    WHEN 'finalizado' THEN 'finalizado'
    WHEN 'entregue' THEN 'entregue'
    ELSE 'recebido'
  END,
  criado_em,
  atualizado_em
FROM fichas_old_pendente;

DROP TABLE fichas_old_pendente;

CREATE INDEX IF NOT EXISTS idx_fichas_cliente ON fichas(cliente);
CREATE INDEX IF NOT EXISTS idx_fichas_cliente_id ON fichas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fichas_paciente ON fichas(paciente);
CREATE INDEX IF NOT EXISTS idx_fichas_criado_em ON fichas(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_fichas_status ON fichas(status);

PRAGMA foreign_keys = on;
