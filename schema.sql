-- Avantix Lab — D1 Database Schema
-- Run with: wrangler d1 execute avantix-db --file=schema.sql

CREATE TABLE IF NOT EXISTS fichas (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Cliente
  cliente             TEXT NOT NULL,
  tel                 TEXT,
  cidade              TEXT,
  uf                  TEXT(2),

  -- Paciente
  paciente            TEXT NOT NULL,
  idade               INTEGER,
  sexo                TEXT CHECK(sexo IN ('F', 'M', '')),

  -- Datas
  data_entrada        TEXT,
  horario_entrada     TEXT,
  data_saida          TEXT,
  horario_saida       TEXT,

  -- Entrega
  tipo_entrega        TEXT CHECK(tipo_entrega IN ('prova', 'pronto', '')),

  -- Odontograma
  dentes              TEXT,          -- comma-separated: "11,12,21,22"

  -- Material
  desinfectado        TEXT CHECK(desinfectado IN ('sim', 'nao', '')),

  -- Serviço
  servico             TEXT NOT NULL,
  obs                 TEXT,

  -- Estética
  cor_gengiva         TEXT,
  cor_dente           TEXT,
  cor_remanescente    TEXT,
  oclusao             TEXT,
  personalidade       TEXT,

  -- Acompanha
  acompanha           TEXT,          -- comma-separated checkbox values
  acompanha_outros    TEXT,

  -- Arquivos no R2
  arquivos_json       TEXT,          -- JSON array: [{key, name, size}, ...]

  -- Metadata
  status              TEXT DEFAULT 'pendente'
                        CHECK(status IN ('pendente', 'em_producao', 'prova', 'pronto', 'entregue')),
  criado_em           TEXT DEFAULT (datetime('now')),
  atualizado_em       TEXT
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_fichas_cliente   ON fichas(cliente);
CREATE INDEX IF NOT EXISTS idx_fichas_paciente  ON fichas(paciente);
CREATE INDEX IF NOT EXISTS idx_fichas_criado_em ON fichas(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_fichas_status    ON fichas(status);
