const statusLabels = {
  recebido: 'Recebido',
  pendente: 'Pendente',
  triagem: 'Triagem',
  em_producao: 'Em producao',
  finalizado: 'Finalizado',
  entregue: 'Entregue',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

async function api(path, options = {}) {
  const resp = await fetch(path, {
    credentials: 'same-origin',
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Erro ao processar a solicitacao.');
  return data;
}

function formDataToJson(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function showPortalError(message) {
  const alert = document.getElementById('portal-alert');
  if (!alert) return;
  alert.textContent = message;
  alert.className = 'alert alert--error visible';
}

function showPortalSuccess(message) {
  const alert = document.getElementById('portal-alert');
  if (!alert) return;
  alert.textContent = message;
  alert.className = 'alert alert--success visible';
}

function activatePortalTab(tabName) {
  document.querySelectorAll('.portal-tab').forEach((item) => {
    item.classList.toggle('active', item.dataset.tab === tabName);
  });
  document.querySelectorAll('.portal-form').forEach((form) => {
    form.classList.remove('active');
    form.hidden = true;
  });
  const activeForm = document.getElementById(`${tabName}-form`);
  if (activeForm) {
    activeForm.classList.add('active');
    activeForm.hidden = false;
  }
}

function requireLoginRedirect() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('login') === 'required') {
    showPortalError('Faça login para acessar Novo pedido.');
  }
}

function formatDate(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function statusBadge(status) {
  return `<span class="status-badge status-${escapeHtml(status || 'recebido')}">${escapeHtml(statusLabels[status] || status || 'Recebido')}</span>`;
}

function countByStatus(orders) {
  const counts = { recebido: 0, pendente: 0, triagem: 0, em_producao: 0, finalizado: 0, entregue: 0 };
  orders.forEach((order) => {
    counts[order.status] = (counts[order.status] || 0) + 1;
  });
  return counts;
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!size) return '';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function renderAdminFiles(order) {
  const files = Array.isArray(order.arquivos) ? order.arquivos : [];
  if (!files.length) return '<span>Nenhum arquivo</span>';

  return `
    <div class="file-links">
      <strong>${files.length} arquivo${files.length === 1 ? '' : 's'}</strong>
      ${files.map((file) => `
        <a href="/api/admin/arquivo?key=${encodeURIComponent(file.key)}" target="_blank" rel="noopener">
          ${escapeHtml(file.name || 'Arquivo')}
          <span>${escapeHtml(formatFileSize(file.size))}</span>
        </a>
      `).join('')}
    </div>
  `;
}

function adminOrderDetailUrl(order) {
  return `admin-pedido.html?id=${encodeURIComponent(order.id)}`;
}

function renderAdminDetailLink(order) {
  return `<a class="table-action-link" href="${adminOrderDetailUrl(order)}">Ver ficha</a>`;
}

function formatValue(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function formatDateTime(dateValue, timeValue) {
  const date = formatDate(dateValue);
  if (date === '-' && !timeValue) return '-';
  return `${date}${timeValue ? ` ${timeValue}` : ''}`;
}

function renderDetailRow(label, value) {
  return `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${value}</td>
    </tr>
  `;
}

function renderAdminFilesForDetails(order) {
  const files = Array.isArray(order.arquivos) ? order.arquivos : [];
  if (!files.length) return escapeHtml('Nenhum arquivo');
  return `
    <div class="file-links file-links--inline">
      ${files.map((file) => `
        <a href="/api/admin/arquivo?key=${encodeURIComponent(file.key)}" target="_blank" rel="noopener">
          ${escapeHtml(file.name || 'Arquivo')}
          <span>${escapeHtml(formatFileSize(file.size))}</span>
        </a>
      `).join('')}
    </div>
  `;
}

function logout(event) {
  event.preventDefault();
  api('/api/auth/logout', { method: 'POST' }).catch(() => {}).finally(() => {
    window.location.href = 'portal.html';
  });
}

async function ensureUser(requiredRole) {
  const data = await api('/api/auth/me');
  if (!data.user) {
    window.location.href = 'portal.html';
    return null;
  }
  if (requiredRole && data.user.role !== requiredRole) {
    window.location.href = data.user.role === 'admin' ? 'admin.html' : 'dashboard.html';
    return null;
  }
  return data.user;
}

requireLoginRedirect();

document.querySelectorAll('[data-logout]').forEach((link) => link.addEventListener('click', logout));

document.querySelectorAll('.portal-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    activatePortalTab(tab.dataset.tab);
    document.getElementById('portal-alert')?.classList.remove('visible');
  });
});

document.getElementById('login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(formDataToJson(event.currentTarget)),
    });
    window.location.href = data.user?.role === 'admin' ? 'admin.html' : 'dashboard.html';
  } catch (err) {
    showPortalError(err.message);
  }
});

document.getElementById('register-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = formDataToJson(form);
  try {
    await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    form.reset();
    document.getElementById('login-email').value = payload.email || '';
    activatePortalTab('login');
    showPortalSuccess('Cadastro criado. Entre com seu email e senha para continuar.');
  } catch (err) {
    showPortalError(err.message);
  }
});

async function loadClientDashboard() {
  try {
    const user = await ensureUser();
    if (!user) return;
    if (user.role === 'admin') {
      window.location.href = 'admin.html';
      return;
    }
    document.getElementById('client-name').textContent = `${user.nome} · ${user.clinica}`;

    const data = await api('/api/pedidos');
    const orders = data.pedidos || [];
    const counts = countByStatus(orders);
    const metrics = [
      ['Recebidos', counts.recebido],
      ['Pendentes', counts.pendente],
      ['Em andamento', counts.triagem + counts.em_producao],
      ['Finalizados', counts.finalizado + counts.entregue],
    ];

    document.getElementById('client-metrics').innerHTML = metrics.map(([label, count]) => `
      <div class="metric-card">
        <span>${escapeHtml(label)}</span>
        <strong>${count}</strong>
      </div>
    `).join('');

    document.getElementById('orders-body').innerHTML = orders.map((order) => `
      <tr>
        <td>${escapeHtml(order.paciente)}</td>
        <td>${escapeHtml(order.servico)}</td>
        <td>${formatDate(order.data_saida)}</td>
        <td>${statusBadge(order.status)}</td>
      </tr>
    `).join('');
    document.getElementById('orders-empty').style.display = orders.length ? 'none' : 'block';
  } catch (err) {
    document.getElementById('orders-empty').textContent = err.message;
    document.getElementById('orders-empty').style.display = 'block';
  }
}

document.getElementById('refresh-dashboard')?.addEventListener('click', loadClientDashboard);

function populateStatusSelect(select, includeAll = false) {
  if (!select || select.dataset.ready) return;
  select.innerHTML = includeAll ? '<option value="">Todos os status</option>' : '';
  Object.entries(statusLabels).forEach(([value, label]) => {
    select.insertAdjacentHTML('beforeend', `<option value="${value}">${label}</option>`);
  });
  select.dataset.ready = '1';
}

async function updateOrderStatus(id, status) {
  await api('/api/admin/pedidos', {
    method: 'PATCH',
    body: JSON.stringify({ id, status }),
  });
  await loadAdminOrders();
}

async function loadAdminOrders() {
  const q = encodeURIComponent(document.getElementById('admin-search')?.value || '');
  const status = encodeURIComponent(document.getElementById('admin-status')?.value || '');
  const data = await api(`/api/admin/pedidos?q=${q}&status=${status}`);
  const orders = data.pedidos || [];
  renderAdminMetrics(orders);
  const body = document.getElementById('admin-orders-body');
  body.innerHTML = orders.map((order) => `
    <tr>
      <td>
        <strong>${escapeHtml(order.cliente_clinica || order.cliente)}</strong>
        <span>${escapeHtml(order.cliente_email || order.tel || '')}</span>
      </td>
      <td>${escapeHtml(order.paciente)}</td>
      <td>${escapeHtml(order.servico)}</td>
      <td>${formatDate(order.data_saida)}</td>
      <td>
        <select class="status-select" data-order-id="${order.id}">
          ${Object.entries(statusLabels).map(([value, label]) => (
            `<option value="${value}" ${value === order.status ? 'selected' : ''}>${label}</option>`
          )).join('')}
        </select>
      </td>
      <td>${renderAdminDetailLink(order)}</td>
    </tr>
  `).join('');
  document.getElementById('admin-empty').style.display = orders.length ? 'none' : 'block';

  body.querySelectorAll('.status-select').forEach((select) => {
    select.addEventListener('change', () => updateOrderStatus(Number(select.dataset.orderId), select.value));
  });
}

function renderAdminMetrics(orders) {
  const metrics = document.getElementById('admin-metrics');
  if (!metrics) return;

  const counts = countByStatus(orders);
  const clients = new Set(orders.map((order) => order.cliente_email || order.cliente_clinica || order.cliente).filter(Boolean));
  const active = counts.recebido + counts.pendente + counts.triagem + counts.em_producao;
  const completed = counts.finalizado + counts.entregue;

  const items = [
    ['Pedidos totais', orders.length],
    ['Clientes', clients.size],
    ['Em andamento', active],
    ['Concluidos', completed],
  ];

  metrics.innerHTML = items.map(([label, count]) => `
    <div class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${count}</strong>
    </div>
  `).join('');
}

async function loadAdminPanel() {
  try {
    const user = await ensureUser('admin');
    if (!user) return;
    populateStatusSelect(document.getElementById('admin-status'), true);
    await loadAdminOrders();
  } catch (err) {
    const empty = document.getElementById('admin-empty');
    empty.textContent = err.message;
    empty.style.display = 'block';
  }
}

async function loadAdminOrderDetail() {
  const empty = document.getElementById('admin-order-empty');
  const body = document.getElementById('admin-order-details-body');
  try {
    const user = await ensureUser('admin');
    if (!user) return;

    const id = Number(new URLSearchParams(window.location.search).get('id') || 0);
    if (!id) throw new Error('Pedido nao informado.');

    const data = await api(`/api/admin/pedidos?id=${encodeURIComponent(id)}`);
    const order = (data.pedidos || [])[0];
    if (!order) throw new Error('Pedido nao encontrado.');

    document.getElementById('admin-order-title').textContent = `Pedido #${order.id}`;
    document.getElementById('admin-order-subtitle').textContent = `${order.cliente_clinica || order.cliente || 'Cliente'} · ${order.paciente || 'Paciente'}`;
    document.getElementById('admin-order-status').innerHTML = statusBadge(order.status);

    const rows = [
      ['Cliente', order.cliente],
      ['Clinica', order.cliente_clinica],
      ['Email do cliente', order.cliente_email],
      ['Telefone', order.tel],
      ['Cidade/UF', [order.cidade, order.uf].filter(Boolean).join(' / ')],
      ['Paciente', order.paciente],
      ['Idade', order.idade],
      ['Sexo', order.sexo],
      ['Entrada', formatDateTime(order.data_entrada, order.horario_entrada)],
      ['Saida', formatDateTime(order.data_saida, order.horario_saida)],
      ['Tipo de entrega', order.tipo_entrega],
      ['Dentes', order.dentes],
      ['Desinfectado', order.desinfectado],
      ['Servico', order.servico],
      ['Observacoes', order.obs],
      ['Cor da gengiva', order.cor_gengiva],
      ['Cor do dente', order.cor_dente],
      ['Cor do remanescente', order.cor_remanescente],
      ['Oclusao', order.oclusao],
      ['Personalidade', order.personalidade],
      ['Acompanha', order.acompanha],
      ['Acompanha outros', order.acompanha_outros],
      ['Arquivos', renderAdminFilesForDetails(order)],
      ['Criado em', order.criado_em],
      ['Atualizado em', order.atualizado_em],
    ];

    body.innerHTML = rows.map(([label, value]) => (
      renderDetailRow(label, label === 'Arquivos' ? value : escapeHtml(formatValue(value)))
    )).join('');
    empty.style.display = 'none';
  } catch (err) {
    if (body) body.innerHTML = '';
    if (empty) {
      empty.textContent = err.message;
      empty.style.display = 'block';
    }
  }
}

document.getElementById('admin-refresh')?.addEventListener('click', loadAdminOrders);
document.getElementById('admin-status')?.addEventListener('change', loadAdminOrders);
document.getElementById('admin-search')?.addEventListener('input', () => {
  clearTimeout(window.__adminSearchTimer);
  window.__adminSearchTimer = setTimeout(loadAdminOrders, 250);
});
