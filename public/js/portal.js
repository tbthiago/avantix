const statusLabels = {
  pendente: 'Aguardando triagem',
  em_producao: 'Em producao',
  prova: 'Em prova',
  pronto: 'Pronto',
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
  document.querySelectorAll('.portal-form').forEach((form) => form.classList.remove('active'));
  document.getElementById(`${tabName}-form`)?.classList.add('active');
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
  return `<span class="status-badge status-${escapeHtml(status || 'pendente')}">${escapeHtml(statusLabels[status] || status || 'Pendente')}</span>`;
}

function countByStatus(orders) {
  const counts = { pendente: 0, em_producao: 0, prova: 0, pronto: 0, entregue: 0 };
  orders.forEach((order) => {
    counts[order.status] = (counts[order.status] || 0) + 1;
  });
  return counts;
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
  try {
    await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(formDataToJson(event.currentTarget)),
    });
    const email = event.currentTarget.email.value;
    event.currentTarget.reset();
    document.getElementById('login-email').value = email;
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
    document.getElementById('client-name').textContent = `${user.nome} · ${user.clinica}`;

    const data = await api('/api/pedidos');
    const orders = data.pedidos || [];
    const counts = countByStatus(orders);
    const metrics = [
      ['Em andamento', counts.pendente + counts.em_producao + counts.prova],
      ['Aguardando', counts.pendente],
      ['Em producao', counts.em_producao],
      ['Concluidos', counts.pronto + counts.entregue],
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
    </tr>
  `).join('');
  document.getElementById('admin-empty').style.display = orders.length ? 'none' : 'block';

  body.querySelectorAll('.status-select').forEach((select) => {
    select.addEventListener('change', () => updateOrderStatus(Number(select.dataset.orderId), select.value));
  });
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

document.getElementById('admin-refresh')?.addEventListener('click', loadAdminOrders);
document.getElementById('admin-status')?.addEventListener('change', loadAdminOrders);
document.getElementById('admin-search')?.addEventListener('input', () => {
  clearTimeout(window.__adminSearchTimer);
  window.__adminSearchTimer = setTimeout(loadAdminOrders, 250);
});
