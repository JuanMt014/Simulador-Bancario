const API = (window.APP_CONFIG?.API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const state = { module: null, token: null, user: null, account: null, atmAccount: null, adminClientId: null };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 }).format(Number(amount || 0));
const date = (value) => value ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const fullName = (user) => [user?.nombre, user?.apellido].filter(Boolean).join(' ') || 'cliente';

function showNotice(message, kind = 'success') {
  const notice = $('#notice');
  notice.textContent = message;
  notice.className = `alert alert-${kind} shadow-sm`;
  notice.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => notice.classList.add('d-none'), 6500);
}

async function request(path, { method = 'GET', body, token = state.token } = {}) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('No fue posible conectar con el backend. Verifica que esté activo en http://localhost:3000.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) logout(false);
    throw new Error(data.message || `La solicitud falló (HTTP ${response.status}).`);
  }
  return { data, status: response.status };
}

function hideViews() { $$('.view').forEach((view) => view.classList.add('d-none')); }
function showView(id) { hideViews(); $(`#${id}`).classList.remove('d-none'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function goHome() { logout(false); showView('portalView'); }

function openModule(module) {
  state.module = module;
  if (module === 'atm') {
    state.token = null; state.user = null; state.atmAccount = null;
    $('#logoutButton').classList.add('d-none');
    $('#atmLoginPanel').classList.remove('d-none');
    $('#atmSessionPanel').classList.add('d-none');
    $('#atmLoginForm').reset();
    showView('atmView');
    return;
  }
  const config = {
    client: { view: 'clientView', eyebrow: 'BANCA VIRTUAL', title: 'Bienvenido de nuevo', description: 'Consulta tu cuenta y realiza tus operaciones con tranquilidad.', card: 'Banca virtual', subtitle: 'Ingresa con tu correo y contraseña', icon: '↗', button: 'Ingresar a mi cuenta', email: true },
    admin: { view: 'adminView', eyebrow: 'ACCESO ADMINISTRATIVO', title: 'Gestiona con confianza', description: 'Administra clientes y supervisa las operaciones del banco.', card: 'Panel administrativo', subtitle: 'Acceso exclusivo para administradores', icon: '▤', button: 'Ingresar al panel', email: true },
  }[module];
  $('#authEyebrow').textContent = config.eyebrow;
  $('#authTitle').textContent = config.title;
  $('#authDescription').textContent = config.description;
  $('#authCardTitle').textContent = config.card;
  $('#authCardSubtitle').textContent = config.subtitle;
  $('#authIcon').textContent = config.icon;
  $('#loginButtonText').textContent = config.button;
  $('#emailGroup').classList.toggle('d-none', !config.email);
  $('#accountGroup').classList.toggle('d-none', config.email);
  $('#loginEmail').required = config.email;
  $('#loginAccount').required = !config.email;
  $('#loginPassword').autocomplete = 'current-password';
  $('#loginPassword').setAttribute('inputmode', 'text');
  $('#loginPassword').setAttribute('pattern', '.{1,}');
  $('#loginPassword').setAttribute('minlength', '1');
  $('#loginPassword').setAttribute('maxlength', '72');
  $('#passwordLabel').textContent = 'Contraseña';
  $('#loginPassword').placeholder = 'Ingresa tu contraseña';
  $('#loginForm').reset();
  showView('authView');
}

function logout(notify = true) {
  state.token = null; state.user = null; state.account = null; state.atmAccount = null;
  $('#logoutButton').classList.add('d-none');
  if (notify) { showNotice('Sesión cerrada de forma segura.', 'info'); showView('portalView'); }
}

function setSession({ token, user, account }) {
  state.token = token; state.user = user; state.atmAccount = account || null;
  $('#logoutButton').classList.remove('d-none');
}

function statePill(value) { return `<span class="state-pill ${escapeHtml(value)}">${escapeHtml(value)}</span>`; }
function movementRows(items, admin = false) {
  if (!items?.length) return '<tr><td class="empty-state" colspan="5">Aún no hay movimientos registrados.</td></tr>';
  return items.map((item) => {
    const outgoing = ['RETIRO', 'TRANSFERENCIA_ENVIADA'].includes(item.tipo_movimiento);
    return `<tr><td>${escapeHtml(date(item.fecha))}</td>${admin ? `<td>${escapeHtml(item.numero_cuenta || '')}</td>` : ''}<td><span class="movement-pill ${outgoing ? 'debit' : ''}">${escapeHtml(item.tipo_movimiento)}</span></td>${admin ? '' : `<td>${escapeHtml(item.descripcion)}</td>`}<td class="text-end ${outgoing ? 'text-negative' : 'text-positive'}">${outgoing ? '−' : '+'}${escapeHtml(money(item.valor))}</td>${admin ? '' : `<td class="text-end">${escapeHtml(money(item.saldo_resultante))}</td>`}</tr>`;
  }).join('');
}

async function loadClient() {
  const [profileResult, accountResult, movementsResult] = await Promise.all([
    request('/cliente/perfil'), request('/cliente/cuenta'), request('/cliente/movimientos?limit=15'),
  ]);
  const profile = profileResult.data.data; state.user = profile; state.account = accountResult.data.data;
  $('#clientGreeting').textContent = fullName(profile).split(' ')[0];
  $('#clientBalance').textContent = money(state.account.saldo);
  $('#clientAccountNumber').textContent = state.account.numero_cuenta;
  $('#clientAccountType').textContent = state.account.tipo_cuenta;
  $('#profileName').value = profile.nombre || ''; $('#profileLast').value = profile.apellido || '';
  $('#profileEmail').value = profile.correo || ''; $('#profilePhone').value = profile.telefono || '';
  $('#clientMovements').innerHTML = movementRows(movementsResult.data.data);
}

async function loadAdmin() {
  const [metrics, clients, accounts, movements] = await Promise.all([
    request('/admin/dashboard'), request('/admin/clientes?limit=50'), request('/admin/cuentas?limit=50'), request('/admin/movimientos?limit=50'),
  ]);
  const values = [
    ['Total de clientes', metrics.data.total_clientes, '♙'],
    ['Cuentas activas', metrics.data.cuentas_activas, '▤'],
    ['Clientes bloqueados', metrics.data.clientes_bloqueados, '⊘'],
    ['Saldo total administrado', money(metrics.data.saldo_total), '$'],
  ];
  $('#metrics').innerHTML = values.map(([label, value, icon]) => `<div class="col-6 col-lg-3"><div class="metric-card"><span class="metric-icon">${icon}</span><span>${label}</span><strong>${escapeHtml(value)}</strong></div></div>`).join('');
  renderClients(clients.data.data);
  $('#adminAccounts').innerHTML = accounts.data.data.map((row) => `<tr><td>${escapeHtml(row.numero_cuenta)}</td><td>${escapeHtml(fullName(row))}</td><td>${escapeHtml(row.tipo_cuenta)}</td><td>${escapeHtml(money(row.saldo))}</td><td>${statePill(row.estado)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No hay cuentas.</td></tr>';
  $('#adminMovements').innerHTML = movementRows(movements.data.data, true);
}

function renderClients(clients) {
  $('#adminClients').innerHTML = clients.length ? clients.map((item) => `<tr><td><strong>${escapeHtml(fullName(item))}</strong><small class="d-block text-secondary">${escapeHtml(item.correo)}</small></td><td>${escapeHtml(item.documento)}</td><td>${statePill(item.estado)}</td><td class="text-end"><button class="table-action" data-client-id="${Number(item.id)}">Ver</button></td></tr>`).join('') : '<tr><td colspan="4" class="empty-state">No se encontraron clientes.</td></tr>';
}

async function openClientDetail(id) {
  state.adminClientId = id;
  const result = await request(`/admin/clientes/${id}`); const item = result.data.data;
  $('#clientDetail').innerHTML = `<p class="eyebrow">DETALLE DEL CLIENTE</p><p class="detail-title">${escapeHtml(fullName(item))}</p><p class="text-secondary small mb-1">${escapeHtml(item.correo)} · Doc. ${escapeHtml(item.documento)}</p><p class="text-secondary small mb-0">Tel. ${escapeHtml(item.telefono || '—')} · ${item.cuentas.length} cuenta(s)</p><div class="detail-actions"><select id="detailStatus" class="form-select form-select-sm">${['ACTIVO', 'INACTIVO', 'BLOQUEADO'].map((status) => `<option ${status === item.estado ? 'selected' : ''}>${status}</option>`).join('')}</select><button class="btn btn-sm btn-outline-primary" id="saveClientStatus">Guardar estado</button><button class="btn btn-sm btn-light" id="editClientData">Editar datos</button></div><div class="mt-3 small">${item.cuentas.map((account) => `${escapeHtml(account.numero_cuenta)} · ${escapeHtml(account.tipo_cuenta)} · ${escapeHtml(money(account.saldo))} · ${escapeHtml(account.estado)}`).join('<br>') || 'Sin cuentas'}</div>`;
}

async function initSession(module, token, user, account) {
  setSession({ token, user, account });
  try {
    if (module === 'client') { await loadClient(); showView('clientView'); }
    if (module === 'admin') { await loadAdmin(); showView('adminView'); }
    if (module === 'atm') { await loadAtm(); showView('atmView'); }
    showNotice(`Bienvenido, ${fullName(user)}.`, 'success');
  } catch (error) { logout(false); openModule(module); showNotice(error.message, 'danger'); }
}

async function loadAtm() {
  const [balance, movements] = await Promise.all([request('/cajero/saldo'), request('/cajero/movimientos?limit=10')]);
  const account = balance.data.data; $('#atmBalance').textContent = money(account.saldo); $('#atmAccountNumber').textContent = account.numero_cuenta;
  $('#atmLoginPanel').classList.add('d-none'); $('#atmSessionPanel').classList.remove('d-none');
  $('#atmMovements').innerHTML = movements.data.data.length ? movements.data.data.map((item) => `<div class="atm-movement"><span>${escapeHtml(item.tipo_movimiento)}<small>${escapeHtml(date(item.fecha))} · ${escapeHtml(item.descripcion)}</small></span><strong>${escapeHtml(money(item.valor))}</strong></div>`).join('') : '<p class="text-secondary small">Aún no hay movimientos.</p>';
}

document.addEventListener('click', async (event) => {
  const opener = event.target.closest('[data-open]'); if (opener) return openModule(opener.dataset.open);
  if (event.target.closest('[data-home]')) return goHome();
  if (event.target.closest('#logoutButton')) return logout(true);
  if (event.target.closest('#refreshClient')) { try { await loadClient(); showNotice('Cuenta y movimientos actualizados.', 'info'); } catch (error) { showNotice(error.message, 'danger'); } }
  if (event.target.closest('[data-admin-refresh]')) { try { await loadAdmin(); showNotice('Panel actualizado.', 'info'); } catch (error) { showNotice(error.message, 'danger'); } }
  if (event.target.closest('#showCreateClient')) { $('#createClientForm').reset(); bootstrap.Modal.getOrCreateInstance($('#createClientModal')).show(); }
  const clientButton = event.target.closest('[data-client-id]'); if (clientButton) { try { await openClientDetail(Number(clientButton.dataset.clientId)); } catch (error) { showNotice(error.message, 'danger'); } }
  if (event.target.closest('#saveClientStatus')) {
    try { await request(`/admin/clientes/${state.adminClientId}/estado`, { method: 'PATCH', body: { estado: $('#detailStatus').value } }); await loadAdmin(); await openClientDetail(state.adminClientId); showNotice('Estado del cliente actualizado.'); } catch (error) { showNotice(error.message, 'danger'); }
  }
  if (event.target.closest('#editClientData')) {
    const id = state.adminClientId;
    try {
      const item = (await request(`/admin/clientes/${id}`)).data.data;
      const nombre = window.prompt('Nombre', item.nombre); if (nombre === null) return;
      const apellido = window.prompt('Apellido', item.apellido); if (apellido === null) return;
      const correo = window.prompt('Correo electrónico', item.correo); if (correo === null) return;
      const telefono = window.prompt('Teléfono', item.telefono || ''); if (telefono === null) return;
      await request(`/admin/clientes/${id}`, { method: 'PUT', body: { nombre, apellido, correo, telefono } });
      await loadAdmin(); await openClientDetail(id); showNotice('Datos del cliente actualizados.');
    } catch (error) { showNotice(error.message, 'danger'); }
  }
  if (event.target.closest('#atmEnd')) { state.token = null; state.user = null; state.atmAccount = null; $('#logoutButton').classList.add('d-none'); $('#atmLoginPanel').classList.remove('d-none'); $('#atmSessionPanel').classList.add('d-none'); $('#atmLoginForm').reset(); showNotice('Operación finalizada. Retira tu tarjeta y gracias por usar Banco Horizonte.', 'success'); }
  if (event.target.closest('#atmRefresh')) { try { await loadAtm(); showNotice('Movimientos actualizados.', 'info'); } catch (error) { showNotice(error.message, 'danger'); } }
  const quick = event.target.closest('[data-amount]'); if (quick) $('#withdrawAmount').value = quick.dataset.amount;
  const searchButton = event.target.closest('#searchClients'); if (searchButton) {
    try { const q = encodeURIComponent($('#clientSearch').value.trim()); const result = await request(`/admin/clientes?q=${q}&limit=50`); renderClients(result.data.data); } catch (error) { showNotice(error.message, 'danger'); }
  }
});

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const button = form.querySelector('button[type="submit"]'); button.disabled = true;
  try {
    let result;
    result = await request('/auth/login', { method: 'POST', token: null, body: { correo: $('#loginEmail').value.trim(), password: $('#loginPassword').value } });
    if (state.module === 'admin' && result.data.user.rol !== 'ADMIN') throw new Error('Esta entrada es exclusiva para administradores.');
    if (state.module === 'client' && result.data.user.rol !== 'CLIENTE') throw new Error('Ingresa desde el Panel Administrativo con esta cuenta.');
    await initSession(state.module, result.data.token, result.data.user);
  } catch (error) { showNotice(error.message, 'danger'); } finally { button.disabled = false; }
});

$('#transferForm').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!event.currentTarget.reportValidity()) return;
  const amount = Number($('#transferAmount').value); if (!(amount > 0)) return showNotice('El monto debe ser mayor que cero.', 'danger');
  try {
    const result = await request('/cliente/transferencias', { method: 'POST', body: { numero_cuenta_origen: state.account.numero_cuenta, numero_cuenta_destino: $('#transferTarget').value.trim(), monto: amount, descripcion: $('#transferDescription').value.trim() || 'Transferencia desde banca virtual' } });
    event.currentTarget.reset(); await loadClient(); showNotice(result.data.message || 'Transferencia realizada correctamente.');
  } catch (error) { showNotice(error.message, 'danger'); }
});

$('#profileForm').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!event.currentTarget.reportValidity()) return;
  try { const body = Object.fromEntries(new FormData(event.currentTarget).entries()); const result = await request('/cliente/perfil', { method: 'PUT', body }); await loadClient(); showNotice(result.data.message || 'Perfil actualizado.'); }
  catch (error) { showNotice(error.message, 'danger'); }
});

$('#passwordForm').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!event.currentTarget.reportValidity()) return;
  try { const result = await request('/cliente/password', { method: 'PUT', body: { password_actual: $('#currentPassword').value, password_nueva: $('#newPassword').value } }); event.currentTarget.reset(); showNotice(result.data.message || 'Contraseña actualizada.'); }
  catch (error) { showNotice(error.message, 'danger'); }
});

$('#createClientForm').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!event.currentTarget.reportValidity()) return;
  try {
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    for (const key of ['numero_cuenta']) if (!body[key]) delete body[key];
    const result = await request('/admin/clientes', { method: 'POST', body });
    bootstrap.Modal.getOrCreateInstance($('#createClientModal')).hide(); event.currentTarget.reset(); await loadAdmin();
    showNotice(`Cliente creado. Cuenta asignada: ${result.data.data.numeroCuenta}.`);
  } catch (error) { showNotice(error.message, 'danger'); }
});

$('#depositForm').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!event.currentTarget.reportValidity()) return;
  const amount = Number($('#depositAmount').value); if (!(amount > 0)) return showNotice('El monto debe ser mayor que cero.', 'danger');
  try { const result = await request('/admin/consignaciones', { method: 'POST', body: { numero_cuenta: $('#depositAccount').value.trim(), monto: amount, descripcion: $('#depositDescription').value.trim() || undefined } }); event.currentTarget.reset(); await loadAdmin(); showNotice(result.data.message || 'Consignación registrada.'); }
  catch (error) { showNotice(error.message, 'danger'); }
});

$('#atmLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!event.currentTarget.reportValidity()) return;
  try { const result = await request('/auth/cajero-login', { method: 'POST', token: null, body: { numero_cuenta: $('#atmAccount').value.trim(), pin: $('#atmPin').value } }); await initSession('atm', result.data.token, result.data.user, result.data.account); }
  catch (error) { showNotice(error.message, 'danger'); }
});

$('#withdrawForm').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!event.currentTarget.reportValidity()) return;
  const amount = Number($('#withdrawAmount').value); if (!(amount > 0)) return showNotice('El monto del retiro debe ser mayor que cero.', 'danger');
  try { const result = await request('/cajero/retiros', { method: 'POST', body: { monto: amount } }); $('#withdrawForm').reset(); await loadAtm(); showNotice(result.data.message || 'Retiro realizado correctamente.'); }
  catch (error) { showNotice(error.message, 'danger'); }
});

$('#clientSearch').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); $('#searchClients').click(); } });
