-- Garante suporte normalizado a multiplos arquivos por ficha.
-- O campo fichas.arquivos_json continua existindo para compatibilidade.

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

CREATE INDEX IF NOT EXISTS idx_ficha_arquivos_ficha_id ON ficha_arquivos(ficha_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ficha_arquivos_r2_key ON ficha_arquivos(r2_key);
