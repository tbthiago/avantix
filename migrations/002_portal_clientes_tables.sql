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

CREATE INDEX IF NOT EXISTS idx_fichas_cliente_id ON fichas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes(expira_em);
