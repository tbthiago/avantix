-- Avantix Lab — D1 Database Schema
-- Run with: wrangler d1 execute avantix-db --file=schema.sql

CREATE TABLE IF NOT EXISTS fichas (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id          INTEGER,

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
  status              TEXT DEFAULT 'recebido'
                        CHECK(status IN ('recebido', 'pendente', 'triagem', 'em_producao', 'finalizado', 'entregue')),
  criado_em           TEXT DEFAULT (datetime('now')),
  atualizado_em       TEXT
);

CREATE TABLE IF NOT EXISTS clientes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                TEXT NOT NULL,
  clinica             TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  telefone            TEXT,
  cidade              TEXT,
  uf                  TEXT(2),
  senha_hash          TEXT NOT NULL,
  role                TEXT DEFAULT 'cliente' CHECK(role IN ('cliente', 'admin')),
  criado_em           TEXT DEFAULT (datetime('now')),
  atualizado_em       TEXT
);

CREATE TABLE IF NOT EXISTS sessoes (
  token               TEXT PRIMARY KEY,
  cliente_id          INTEGER NOT NULL,
  expira_em           TEXT NOT NULL,
  criado_em           TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ficha_arquivos (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  ficha_id            INTEGER NOT NULL,
  r2_key              TEXT NOT NULL,
  nome                TEXT NOT NULL,
  tamanho             INTEGER DEFAULT 0,
  content_type        TEXT,
  criado_em           TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(ficha_id) REFERENCES fichas(id) ON DELETE CASCADE
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_fichas_cliente   ON fichas(cliente);
CREATE INDEX IF NOT EXISTS idx_fichas_cliente_id ON fichas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fichas_paciente  ON fichas(paciente);
CREATE INDEX IF NOT EXISTS idx_fichas_criado_em ON fichas(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_fichas_status    ON fichas(status);
CREATE INDEX IF NOT EXISTS idx_clientes_email   ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_sessoes_expira   ON sessoes(expira_em);
CREATE INDEX IF NOT EXISTS idx_ficha_arquivos_ficha_id ON ficha_arquivos(ficha_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ficha_arquivos_r2_key ON ficha_arquivos(r2_key);
