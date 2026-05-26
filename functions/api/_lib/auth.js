const SESSION_COOKIE = 'avantix_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export const STATUS_OPTIONS = {
  pendente: 'Aguardando triagem',
  em_producao: 'Em producao',
  prova: 'Em prova',
  pronto: 'Pronto',
  entregue: 'Entregue',
};

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function readCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  return cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || '';
}

export function sessionCookie(token, maxAge = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(bytes = 32) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return bytesToHex(values);
}

async function hashPassword(password, salt = randomToken(16)) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 120000, hash: 'SHA-256' },
    key,
    256
  );
  return `${salt}:${bytesToHex(bits)}`;
}

export async function verifyPassword(password, storedHash) {
  if (!password || !storedHash || !storedHash.includes(':')) return false;
  const [salt] = storedHash.split(':');
  return await hashPassword(password, salt) === storedHash;
}

export async function createUser(env, { nome, clinica, email, telefone, cidade, uf, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const adminEmail = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  const role = adminEmail && normalizedEmail === adminEmail ? 'admin' : 'cliente';

  const result = await env.DB.prepare(`
    INSERT INTO clientes (nome, clinica, email, telefone, cidade, uf, senha_hash, role, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    String(nome || '').trim(),
    String(clinica || '').trim(),
    normalizedEmail,
    String(telefone || '').trim(),
    String(cidade || '').trim(),
    String(uf || '').trim().toUpperCase(),
    passwordHash,
    role
  ).run();

  return { id: result.meta?.last_row_id, nome, clinica, email: normalizedEmail, role };
}

export async function createSession(env, userId) {
  const token = randomToken();
  await env.DB.prepare(`
    INSERT INTO sessoes (token, cliente_id, expira_em, criado_em)
    VALUES (?, ?, datetime('now', '+14 days'), CURRENT_TIMESTAMP)
  `).bind(token, userId).run();
  return token;
}

export async function getSessionUser(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const row = await env.DB.prepare(`
    SELECT c.id, c.nome, c.clinica, c.email, c.telefone, c.cidade, c.uf, c.role
    FROM sessoes s
    INNER JOIN clientes c ON c.id = s.cliente_id
    WHERE s.token = ? AND s.expira_em > datetime('now')
  `).bind(token).first();

  return row || null;
}

export async function requireUser(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return { response: json({ error: 'Login necessario.' }, { status: 401 }) };
  return { user };
}

export async function requireAdmin(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth;
  if (auth.user.role !== 'admin') return { response: json({ error: 'Acesso restrito ao laboratorio.' }, { status: 403 }) };
  return auth;
}

export function normalizeFicha(row) {
  const arquivos = (() => {
    try { return JSON.parse(row.arquivos_json || '[]'); } catch { return []; }
  })();

  return {
    ...row,
    status_label: STATUS_OPTIONS[row.status] || row.status || 'Pendente',
    arquivos,
  };
}
