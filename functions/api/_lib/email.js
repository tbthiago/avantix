import { connect } from 'cloudflare:sockets';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SMTP_TIMEOUT_MS = 12000;

async function withTimeout(promise, operation) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout SMTP apos ${SMTP_TIMEOUT_MS / 1000}s: ${operation}`));
    }, SMTP_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function toBase64(value) {
  const bytes = encoder.encode(String(value));
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function wrapBase64(value) {
  return toBase64(value).match(/.{1,76}/g)?.join('\r\n') || '';
}

function encodedHeader(value) {
  return `=?UTF-8?B?${toBase64(value)}?=`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

function requireEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Email invalido: ${email}`);
  return email;
}

function createChannel(socket) {
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  let buffer = '';

  return {
    async send(command) {
      await withTimeout(writer.write(encoder.encode(`${command}\r\n`)), 'enviando comando ao servidor');
    },
    async sendRaw(content) {
      await withTimeout(writer.write(encoder.encode(content)), 'enviando corpo da mensagem');
    },
    async read(expectedCodes) {
      const allowed = Array.isArray(expectedCodes) ? expectedCodes : [expectedCodes];

      while (true) {
        const lines = buffer.split('\r\n');
        for (let index = 0; index < lines.length - 1; index += 1) {
          const match = lines[index].match(/^(\d{3}) /);
          if (!match) continue;

          const code = Number(match[1]);
          const response = lines.slice(0, index + 1).join('\r\n');
          buffer = lines.slice(index + 1).join('\r\n');
          if (!allowed.includes(code)) throw new Error(`SMTP ${code}: ${response}`);
          return response;
        }

        const { value, done } = await withTimeout(reader.read(), 'aguardando resposta do servidor');
        if (done) throw new Error(`Conexao SMTP encerrada: ${buffer}`);
        buffer += decoder.decode(value, { stream: true });
      }
    },
    release() {
      reader.releaseLock();
      writer.releaseLock();
    },
  };
}

function buildMessage({ from, fromName, to, subject, html }) {
  return [
    `From: ${encodedHeader(fromName)} <${from}>`,
    `To: <${to}>`,
    `Subject: ${encodedHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@avantixlabor.com.br>`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(html),
  ].join('\r\n');
}

export async function sendEmail(env, { to, subject, html }) {
  if (!env.SMTP_PASSWORD) throw new Error('Secret SMTP_PASSWORD nao configurado.');

  const host = env.SMTP_HOST || 'smtp.umbler.com';
  const port = Number(env.SMTP_PORT || 587);
  const user = requireEmail(env.SMTP_USER || 'contato@avantixlabor.com.br');
  const from = requireEmail(env.SMTP_FROM || user);
  const recipient = requireEmail(to);
  const fromName = env.SMTP_FROM_NAME || 'Avantix Laboratorio';
  const logContext = { event: 'smtp_send', host, port, from, to: recipient, subject };

  console.log({ ...logContext, stage: 'connecting' });

  let socket;
  let channel;

  try {
    socket = connect({ hostname: host, port }, { secureTransport: 'starttls' });
    await withTimeout(socket.opened, `conectando a ${host}:${port}`);
    channel = createChannel(socket);

    await channel.read(220);
    await channel.send('EHLO avantixlabor.com.br');
    await channel.read(250);
    await channel.send('STARTTLS');
    await channel.read(220);

    channel.release();
    socket = socket.startTls();
    await withTimeout(socket.opened, 'iniciando STARTTLS');
    channel = createChannel(socket);

    await channel.send('EHLO avantixlabor.com.br');
    await channel.read(250);
    await channel.send('AUTH LOGIN');
    await channel.read(334);
    await channel.send(toBase64(user));
    await channel.read(334);
    await channel.send(toBase64(env.SMTP_PASSWORD));
    await channel.read(235);
    await channel.send(`MAIL FROM:<${from}>`);
    await channel.read(250);
    await channel.send(`RCPT TO:<${recipient}>`);
    await channel.read([250, 251]);
    await channel.send('DATA');
    await channel.read(354);

    const message = buildMessage({ from, fromName, to: recipient, subject, html });
    await channel.sendRaw(`${message.replace(/(^|\r\n)\./g, '$1..')}\r\n.\r\n`);
    await channel.read(250);
    await channel.send('QUIT');
    await channel.read(221);
    console.log({ ...logContext, stage: 'sent', success: true });
    return { success: true, to: recipient };
  } catch (error) {
    console.error({
      ...logContext,
      stage: 'failed',
      success: false,
      error: String(error?.message || error),
    });
    throw error;
  } finally {
    await socket?.close().catch(() => {});
  }
}

export function newOrderEmail(order) {
  return {
    subject: `Novo pedido #${order.id} - ${String(order.paciente || '')}`,
    html: `
      <h2>Novo pedido recebido</h2>
      <p><strong>Pedido:</strong> #${escapeHtml(order.id)}</p>
      <p><strong>Cliente:</strong> ${escapeHtml(order.cliente)}</p>
      <p><strong>Paciente:</strong> ${escapeHtml(order.paciente)}</p>
      <p><strong>Servico:</strong> ${escapeHtml(order.servico)}</p>
      <p>Acesse o painel administrativo da Avantix para consultar os detalhes e arquivos.</p>
    `,
  };
}

export function statusChangedEmail(order, statusLabel) {
  return {
    subject: `Pedido #${order.id} atualizado: ${statusLabel}`,
    html: `
      <h2>Status do pedido atualizado</h2>
      <p>O pedido do paciente <strong>${escapeHtml(order.paciente)}</strong> foi atualizado.</p>
      <p><strong>Servico:</strong> ${escapeHtml(order.servico)}</p>
      <p><strong>Novo status:</strong> ${escapeHtml(statusLabel)}</p>
      <p>Acesse o Portal do Cliente Avantix para acompanhar todos os seus pedidos.</p>
    `,
  };
}
