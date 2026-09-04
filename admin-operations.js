const STAGES = [
  ['ideias', 'Ideias', 'lightbulb'], ['preparar', 'Preparar arquivo', 'file-cog'], ['pronto', 'Pronto para imprimir', 'badge-check'],
  ['imprimindo', 'Em impressão', 'printer'], ['acabamento', 'Acabamento', 'sparkles'], ['finalizado', 'Finalizado', 'circle-check-big']
];
let sales = [];
let jobs = [];
let customers = [];
let collapsedStages = JSON.parse(localStorage.getItem('fox-collapsed-stages') || '[]');

async function activateAdminView(tab) {
  document.querySelectorAll('.admin-tab').forEach((item) => item.classList.toggle('active', item === tab));
  document.querySelectorAll('.admin-view').forEach((view) => { view.hidden = view.id !== tab.dataset.view; });
  if (tab.dataset.view === 'dashboardView') await loadDashboard();
  if (tab.dataset.view === 'productsView') await loadProducts();
  if (tab.dataset.view === 'salesView') await loadSales();
  if (tab.dataset.view === 'customersView') await loadCustomers();
  if (tab.dataset.view === 'productionView') await loadJobs();
  closeSidebar();
}

document.querySelectorAll('.admin-tab').forEach((tab) => tab.addEventListener('click', () => activateAdminView(tab)));
document.querySelectorAll('[data-open-view]').forEach((button) => button.addEventListener('click', () => {
  const tab = document.querySelector(`.admin-tab[data-view="${button.dataset.openView}"]`);
  if (tab) activateAdminView(tab);
}));

const sidebar = document.querySelector('#adminSidebar');
const sidebarToggle = document.querySelector('#sidebarToggle');
const sidebarBackdrop = document.querySelector('#sidebarBackdrop');
const sidebarCollapse = document.querySelector('#sidebarCollapse');
function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('visible');
  sidebarToggle.setAttribute('aria-expanded', 'false');
}
sidebarToggle.addEventListener('click', () => {
  const opening = !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', opening);
  sidebarBackdrop.classList.toggle('visible', opening);
  sidebarToggle.setAttribute('aria-expanded', String(opening));
});
sidebarBackdrop.addEventListener('click', closeSidebar);

function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  sidebarCollapse.innerHTML = `<i data-lucide="${collapsed ? 'chevron-right' : 'chevron-left'}"></i>`;
  sidebarCollapse.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
  sidebarCollapse.title = collapsed ? 'Expandir menu' : 'Recolher menu';
  localStorage.setItem('fox-sidebar-collapsed', String(collapsed));
  window.refreshLucideIcons?.();
}
setSidebarCollapsed(localStorage.getItem('fox-sidebar-collapsed') === 'true');
sidebarCollapse.addEventListener('click', () => setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed')));

document.querySelector('#newSaleButton').addEventListener('click', () => openSale());
document.querySelector('#dashboardNewSaleButton').addEventListener('click', () => openSale());
document.querySelector('.sale-close').addEventListener('click', () => document.querySelector('#saleEditor').close());
document.querySelector('#saleCancelButton').addEventListener('click', () => document.querySelector('#saleEditor').close());
document.querySelector('#saleSearch').addEventListener('input', renderFilteredSales);
document.querySelector('#salePaymentFilter').addEventListener('change', renderFilteredSales);
document.querySelector('#saleStatusFilter').addEventListener('change', renderFilteredSales);
document.querySelector('#newJobButton').addEventListener('click', () => openJob());
document.querySelector('.job-close').addEventListener('click', () => document.querySelector('#jobEditor').close());

async function loadDashboard() {
  const status = document.querySelector('#dashboardStatus');
  status.textContent = '';
  const [{ data: saleData, error: salesError }, { data: jobData, error: jobsError }] = await Promise.all([
    db.from('sales').select('*').order('sale_date', { ascending: false }),
    db.from('print_jobs').select('*').order('position')
  ]);
  if (salesError || jobsError) {
    status.textContent = `Não foi possível carregar o resumo: ${(salesError || jobsError).message}`;
    return;
  }

  sales = saleData || [];
  jobs = jobData || [];
  const today = new Date();
  const todayKey = localDateKey(today);
  const monthKey = todayKey.slice(0, 7);
  const validSales = sales.filter((sale) => sale.status !== 'cancelado');
  const monthSales = validSales.filter((sale) => String(sale.sale_date || '').startsWith(monthKey));
  const monthTotal = monthSales.reduce((sum, sale) => sum + saleFinalValue(sale), 0);
  const monthReceived = monthSales.reduce((sum, sale) => sum + Number(sale.paid || 0), 0);
  const allPending = validSales.reduce((sum, sale) => sum + Math.max(0, saleFinalValue(sale) - Number(sale.paid || 0)), 0);
  const activeJobs = jobs.filter((job) => job.stage !== 'finalizado');

  const summary = [
    ['calendar-days', 'Vendido no mês', money(monthTotal), `${monthSales.length} venda${monthSales.length === 1 ? '' : 's'}`],
    ['circle-check-big', 'Recebido no mês', money(monthReceived), 'pagamentos registrados'],
    ['clock-3', 'Total a receber', money(allPending), 'vendas não canceladas'],
    ['printer', 'Em produção', activeJobs.length, 'cartões ativos']
  ];
  document.querySelector('#dashboardSummary').innerHTML = summary.map(([icon, label, value, detail]) => `<article class="dashboard-stat"><span><i data-lucide="${icon}"></i></span><div><small>${label}</small><strong>${value}</strong><em>${detail}</em></div></article>`).join('');

  const deliveries = validSales
    .filter((sale) => sale.due_date && !sale.delivered)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 6);
  document.querySelector('#dashboardDeliveries').innerHTML = deliveries.length ? `<div class="dashboard-list">${deliveries.map((sale) => {
    const overdue = sale.due_date < todayKey;
    return `<article class="dashboard-delivery${overdue ? ' overdue' : ''}"><span class="delivery-date"><strong>${formatDay(sale.due_date)}</strong><small>${formatMonth(sale.due_date)}</small></span><button type="button" class="dashboard-delivery-open" data-dashboard-sale="${sale.id}"><strong>${escapeHtml(sale.customer)}</strong><small>${escapeHtml(sale.description)}</small></button><div class="dashboard-delivery-actions"><em>${overdue ? 'Atrasada' : money(saleFinalValue(sale))}</em><button type="button" data-dashboard-delivered="${sale.id}" title="Marcar pedido como entregue"><i data-lucide="package-check"></i> Entregue</button></div></article>`;
  }).join('')}</div>` : '<p class="dashboard-empty">Nenhuma entrega agendada.</p>';

  document.querySelector('#dashboardProduction').innerHTML = STAGES.map(([key, label, icon]) => {
    const count = jobs.filter((job) => job.stage === key).length;
    return `<button type="button" class="production-stage" data-dashboard-stage="${key}"><span><i data-lucide="${icon}"></i></span><strong>${label}</strong><em>${count}</em></button>`;
  }).join('');

  document.querySelectorAll('[data-dashboard-sale]').forEach((button) => button.addEventListener('click', () => openSale(sales.find((sale) => sale.id === button.dataset.dashboardSale))));
  document.querySelectorAll('[data-dashboard-delivered]').forEach((button) => button.addEventListener('click', () => markSaleAsDelivered(button.dataset.dashboardDelivered, button, true)));
  document.querySelectorAll('[data-dashboard-stage]').forEach((button) => button.addEventListener('click', () => {
    const tab = document.querySelector('.admin-tab[data-view="productionView"]');
    if (tab) activateAdminView(tab);
  }));
  window.refreshLucideIcons?.();
}
window.loadDashboard = loadDashboard;

async function loadSales() {
  const { data, error } = await db.from('sales').select('*').order('sale_date', { ascending: false });
  if (error) return alert(`Erro ao carregar vendas: ${error.message}`);
  sales = data || [];
  const total = sales.filter((s) => s.status !== 'cancelado').reduce((sum, s) => sum + Math.max(0, Number(s.total) - Number(s.discount || 0)), 0);
  const received = sales.filter((s) => s.status !== 'cancelado').reduce((sum, s) => sum + Number(s.paid), 0);
  const pending = Math.max(0, total - received);
  document.querySelector('#salesSummary').innerHTML = [['Vendas', sales.length], ['Total vendido', money(total)], ['Recebido', money(received)], ['A receber', money(pending)]].map(([label, value]) => `<div class="summary-card"><small>${label}</small><strong>${value}</strong></div>`).join('');
  renderFilteredSales();
}

function renderFilteredSales() {
  const query = document.querySelector('#saleSearch').value.trim().toLowerCase();
  const payment = document.querySelector('#salePaymentFilter').value;
  const status = document.querySelector('#saleStatusFilter').value;
  const filtered = sales.filter((sale) => {
    const matchesText = !query || `${sale.customer} ${sale.contact} ${sale.description} ${sale.payment_method} ${sale.status}`.toLowerCase().includes(query);
    const matchesPayment = payment === 'all' || sale.payment_method === payment;
    const matchesStatus = status === 'all' || sale.status === status;
    return matchesText && matchesPayment && matchesStatus;
  });
  renderSales(filtered);
}

function renderSales(list) {
  document.querySelector('#saleResultCount').textContent = `${list.length} venda${list.length === 1 ? '' : 's'}`;
  document.querySelector('#salesList').innerHTML = list.length ? list.map((sale) => { const discount = Number(sale.discount || 0); const finalValue = Math.max(0, Number(sale.total) - discount); const awaitingPayment = sale.status !== 'pago' && sale.status !== 'cancelado'; const awaitingDelivery = !sale.delivered && sale.status !== 'cancelado'; return `<tr><td><strong>${escapeHtml(sale.customer)}</strong><small>${escapeHtml(sale.description)}</small></td><td><strong>${money(finalValue)}</strong>${discount > 0 ? `<span class="discount-pill">Desconto ${money(discount)}</span><small class="original-value">De ${money(sale.total)}</small>` : ''}<small>Pago: ${money(sale.paid)}</small></td><td><div class="payment-info"><strong class="payment-method">${escapeHtml(sale.payment_method)}</strong><span class="payment-pill ${sale.status}">${sale.status}</span></div></td><td><div class="delivery-info"><strong>${formatDate(sale.due_date) || 'Sem previsão'}</strong><span class="delivery-pill ${sale.delivered ? 'delivered' : 'pending'}">${sale.delivered ? 'Entregue' : 'Pendente'}</span></div></td><td class="row-actions"><div class="row-action-buttons">${awaitingPayment ? `<button class="quick-paid" data-mark-paid="${sale.id}" title="Registrar valor total como recebido"><i data-lucide="circle-check-big"></i> Marcar como pago</button>` : ''}${awaitingDelivery ? `<button class="quick-delivered" data-mark-delivered="${sale.id}" title="Marcar pedido como entregue"><i data-lucide="package-check"></i> Marcar entregue</button>` : ''}<button data-sale="${sale.id}">Editar</button></div></td></tr>`; }).join('') : '<tr><td colspan="5">Nenhuma venda encontrada.</td></tr>';
  document.querySelectorAll('[data-sale]').forEach((button) => button.addEventListener('click', () => openSale(sales.find((sale) => sale.id === button.dataset.sale))));
  document.querySelectorAll('[data-mark-paid]').forEach((button) => button.addEventListener('click', () => markSaleAsPaid(button.dataset.markPaid, button)));
  document.querySelectorAll('[data-mark-delivered]').forEach((button) => button.addEventListener('click', () => markSaleAsDelivered(button.dataset.markDelivered, button)));
  window.refreshLucideIcons?.();
}

async function markSaleAsPaid(id, button) {
  const sale = sales.find((item) => item.id === id);
  if (!sale) return;
  button.disabled = true;
  const paid = saleFinalValue(sale);
  const { error } = await db.from('sales').update({ paid, status: 'pago', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    button.disabled = false;
    return alert(`Não foi possível registrar o pagamento: ${error.message}`);
  }
  sale.paid = paid;
  sale.status = 'pago';
  await loadSales();
}

async function markSaleAsDelivered(id, button, fromDashboard = false) {
  const sale = sales.find((item) => item.id === id);
  if (!sale) return;
  button.disabled = true;
  const { error } = await db.from('sales').update({ delivered: true, delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    button.disabled = false;
    return alert(`Não foi possível registrar a entrega: ${error.message}`);
  }
  sale.delivered = true;
  sale.delivered_at = new Date().toISOString();
  if (fromDashboard) await loadDashboard();
  else await loadSales();
}

async function openSale(sale = null) {
  document.querySelector('#saleForm').reset();
  document.querySelector('#saleStatusText').textContent = '';
  document.querySelector('#saleEditorTitle').textContent = sale ? 'Editar venda' : 'Nova venda';
  document.querySelector('#saleId').value = sale?.id || '';
  document.querySelector('#saleCustomer').value = sale?.customer || '';
  document.querySelector('#saleContact').value = sale?.contact || '';
  document.querySelector('#saleMarketingConsent').checked = false;
  if (sale?.contact) {
    const normalizedContact = sale.contact.replace(/\s+/g, ' ').trim().toLowerCase();
    const { data: savedCustomer } = await db.from('customers').select('marketing_consent').eq('contact', normalizedContact).maybeSingle();
    document.querySelector('#saleMarketingConsent').checked = Boolean(savedCustomer?.marketing_consent);
  }
  document.querySelector('#saleDescription').value = sale?.description || '';
  document.querySelector('#saleTotal').value = sale?.total ?? '';
  document.querySelector('#saleDiscountType').value = 'fixed';
  document.querySelector('#saleDiscount').value = sale?.discount ?? 0;
  setDiscountVisible(Number(sale?.discount || 0) > 0);
  document.querySelector('#salePaid').value = sale?.paid ?? 0;
  document.querySelector('#saleMethod').value = sale?.payment_method || 'Pix';
  document.querySelector('#saleStatus').value = sale?.status || 'pendente';
  document.querySelector('#saleDate').value = sale?.sale_date || new Date().toISOString().slice(0, 10);
  document.querySelector('#saleDueDate').value = sale?.due_date || '';
  document.querySelector('#saleDelivered').checked = Boolean(sale?.delivered);
  document.querySelector('#saleNotes').value = sale?.notes || '';
  document.querySelector('#saleAddToQueue').checked = false;
  document.querySelector('#saleQueueOption').hidden = Boolean(sale);
  updateSaleTotalPreview();
  document.querySelector('.delete-sale').hidden = !sale;
  window.syncCustomSelects?.();
  document.querySelector('#saleEditor').showModal();
}

document.querySelector('#saleForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.querySelector('#saleId').value;
  const total = Number(val('saleTotal'));
  const discount = calculateDiscount(total);
  if (discount > total) return document.querySelector('#saleStatusText').textContent = 'O desconto não pode ser maior que o valor da venda.';
  const delivered = document.querySelector('#saleDelivered').checked;
  const currentSale = id ? sales.find((sale) => sale.id === id) : null;
  const payload = { customer: val('saleCustomer'), contact: val('saleContact'), description: val('saleDescription'), total, discount, paid: Number(val('salePaid') || 0), payment_method: val('saleMethod'), status: val('saleStatus'), sale_date: val('saleDate'), due_date: val('saleDueDate') || null, delivered, delivered_at: delivered ? (currentSale?.delivered_at || new Date().toISOString()) : null, notes: val('saleNotes'), updated_at: new Date().toISOString() };
  const normalizedContact = payload.contact.replace(/\s+/g, ' ').trim().toLowerCase();
  const { data: existingCustomer } = await db.from('customers').select('id,marketing_consent').eq('contact', normalizedContact).maybeSingle();
  const customerData = { name: payload.customer, contact: normalizedContact, marketing_consent: document.querySelector('#saleMarketingConsent').checked, updated_at: new Date().toISOString() };
  const { error: customerError } = existingCustomer
    ? await db.from('customers').update(customerData).eq('id', existingCustomer.id)
    : await db.from('customers').insert(customerData);
  if (customerError) return document.querySelector('#saleStatusText').textContent = `Erro ao salvar cliente: ${customerError.message}`;
  let savedSaleId = id;
  let saveError;
  if (id) {
    const { error } = await db.from('sales').update(payload).eq('id', id);
    saveError = error;
  } else {
    const { data, error } = await db.from('sales').insert(payload).select('id').single();
    saveError = error;
    savedSaleId = data?.id || '';
  }
  if (saveError) return document.querySelector('#saleStatusText').textContent = saveError.message;

  let queueError = null;
  if (!id && document.querySelector('#saleAddToQueue').checked) {
    const queuePayload = {
      title: `${payload.customer} — ${payload.description}`,
      stage: 'preparar',
      priority: 'normal',
      estimated_minutes: 0,
      due_date: payload.due_date,
      notes: `Cliente: ${payload.customer}\nContato: ${payload.contact}\nVenda: ${savedSaleId}`,
      position: jobs.length,
      updated_at: new Date().toISOString()
    };
    const result = await db.from('print_jobs').insert(queuePayload);
    queueError = result.error;
  }

  document.querySelector('#saleEditor').close();
  await loadSales();
  if (!document.querySelector('#dashboardView').hidden) await loadDashboard();
  if (queueError) alert(`A venda foi salva, mas não conseguimos criar o cartão na fila: ${queueError.message}`);
});

function updateSaleTotalPreview() {
  const total = Number(document.querySelector('#saleTotal').value || 0);
  const discount = calculateDiscount(total);
  const type = document.querySelector('#saleDiscountType').value;
  const entered = Number(document.querySelector('#saleDiscount').value || 0);
  const detail = discount > 0 ? ` · desconto ${type === 'percent' ? `${entered}% (${money(discount)})` : money(discount)}` : '';
  document.querySelector('#saleTotalPreview').textContent = money(Math.max(0, total - discount));
  document.querySelector('#saleDiscountSummary').textContent = detail.replace(' · ', '');
}
function calculateDiscount(total) {
  if (document.querySelector('#discountFields').hidden) return 0;
  const value = Number(document.querySelector('#saleDiscount').value || 0);
  return document.querySelector('#saleDiscountType').value === 'percent' ? total * Math.min(value, 100) / 100 : value;
}
function setDiscountVisible(visible) {
  document.querySelector('#discountFields').hidden = !visible;
  document.querySelector('#applyDiscountButton').hidden = visible;
  if (!visible) document.querySelector('#saleDiscount').value = 0;
  updateSaleTotalPreview();
}
document.querySelector('#saleTotal').addEventListener('input', updateSaleTotalPreview);
document.querySelector('#saleDiscount').addEventListener('input', updateSaleTotalPreview);
document.querySelector('#saleDiscountType').addEventListener('change', updateSaleTotalPreview);
document.querySelector('#applyDiscountButton').addEventListener('click', () => setDiscountVisible(true));
document.querySelector('#removeDiscountButton').addEventListener('click', () => setDiscountVisible(false));

document.querySelector('.delete-sale').addEventListener('click', async () => {
  const id = val('saleId');
  if (!id || !confirm('Excluir esta venda?')) return;
  const { error } = await db.from('sales').delete().eq('id', id);
  if (error) return alert(error.message);
  document.querySelector('#saleEditor').close(); await loadSales();
});

async function loadCustomers() {
  await syncCustomersFromSales();
  const { data, error } = await db.from('customers').select('*').order('name');
  if (error) return alert(`Erro ao carregar clientes: ${error.message}`);
  customers = data || [];
  renderCustomers(customers);
}

async function syncCustomersFromSales() {
  const { data: oldSales, error: salesError } = await db
    .from('sales')
    .select('customer,contact,sale_date,created_at')
    .order('sale_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (salesError) {
    console.error('Não foi possível sincronizar os clientes das vendas:', salesError.message);
    return;
  }

  const uniqueCustomers = new Map();
  (oldSales || []).forEach((sale) => {
    const contact = String(sale.contact || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const name = String(sale.customer || '').trim();
    if (contact && name && !uniqueCustomers.has(contact)) {
      uniqueCustomers.set(contact, { name, contact, marketing_consent: false });
    }
  });
  if (!uniqueCustomers.size) return;

  const { error } = await db
    .from('customers')
    .upsert([...uniqueCustomers.values()], { onConflict: 'contact', ignoreDuplicates: true });
  if (error) console.error('Não foi possível importar clientes antigos:', error.message);
}

function renderCustomers(list) {
  document.querySelector('#customerCount').textContent = `${list.length} cliente${list.length === 1 ? '' : 's'}`;
  document.querySelector('#customerList').innerHTML = list.length ? list.map((customer) => {
    const isPhone = /^\+?[\d ()-]{8,}$/.test(customer.contact);
    const cleanPhone = customer.contact.replace(/\D/g, '');
    const href = isPhone ? `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`}` : `mailto:${encodeURIComponent(customer.contact)}`;
    return `<article class="customer-row"><div class="customer-details"><strong>${escapeHtml(customer.name)}</strong><a href="${href}" target="_blank" rel="noreferrer">${escapeHtml(customer.contact)}</a></div><label class="customer-consent"><input type="checkbox" data-customer-consent="${customer.id}" ${customer.marketing_consent ? 'checked' : ''}><span>Aceita promoções</span></label></article>`;
  }).join('') : '<p class="empty-state">Nenhum cliente cadastrado.</p>';
  document.querySelectorAll('[data-customer-consent]').forEach((checkbox) => checkbox.addEventListener('change', async () => {
    checkbox.disabled = true;
    const { error } = await db.from('customers').update({ marketing_consent: checkbox.checked, updated_at: new Date().toISOString() }).eq('id', checkbox.dataset.customerConsent);
    checkbox.disabled = false;
    if (error) {
      checkbox.checked = !checkbox.checked;
      return alert(`Não foi possível atualizar: ${error.message}`);
    }
    const customer = customers.find((item) => item.id === checkbox.dataset.customerConsent);
    if (customer) customer.marketing_consent = checkbox.checked;
  }));
  window.refreshLucideIcons?.();
}

document.querySelector('#customerSearch').addEventListener('input', (event) => {
  const query = event.target.value.trim().toLowerCase();
  renderCustomers(customers.filter((customer) => `${customer.name} ${customer.contact}`.toLowerCase().includes(query)));
});

document.querySelector('#exportCustomersButton').addEventListener('click', () => {
  const allowed = customers.filter((customer) => customer.marketing_consent);
  if (!allowed.length) return alert('Nenhum cliente autorizou o recebimento de promoções.');
  const csv = ['Nome,Contato', ...allowed.map((customer) => `"${customer.name.replaceAll('"', '""')}","${customer.contact.replaceAll('"', '""')}"`)].join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'clientes-foxprint3d.csv';
  link.click();
  URL.revokeObjectURL(link.href);
});

async function loadJobs() {
  const { data, error } = await db.from('print_jobs').select('*').order('position');
  if (error) return alert(`Erro ao carregar fila: ${error.message}`);
  jobs = data || []; renderBoard();
}

function renderBoard() {
  document.querySelector('#kanbanBoard').innerHTML = STAGES.map(([key, label, icon]) => {
    const stageJobs = jobs.filter((job) => job.stage === key);
    const collapsed = collapsedStages.includes(key);
    return `<section class="kanban-column${collapsed ? ' collapsed' : ''}" data-stage="${key}"><div class="kanban-head"><div class="kanban-stage-title"><span class="stage-icon"><i data-lucide="${icon}"></i></span><h3>${label}</h3></div><div class="kanban-head-actions"><span class="kanban-count">${stageJobs.length}</span><button class="collapse-column" type="button" data-collapse-stage="${key}" aria-label="${collapsed ? 'Expandir' : 'Recolher'} ${label}" title="${collapsed ? 'Expandir quadro' : 'Recolher quadro'}"><i data-lucide="${collapsed ? 'chevron-right' : 'chevron-left'}"></i></button></div></div><div class="kanban-cards">${stageJobs.map(jobCard).join('')}</div><button class="add-job" data-add-stage="${key}"><i data-lucide="plus"></i> Adicionar cartão</button></section>`;
  }).join('');
  bindBoardEvents();
  window.refreshLucideIcons?.();
}

function jobCard(job) {
  return `<article class="job-card priority-${job.priority}" draggable="true" data-job="${job.id}"><h4>${escapeHtml(job.title)}</h4><p>${escapeHtml(job.notes || 'Sem detalhes')}</p><div class="job-meta"><span>${job.estimated_minutes ? `${job.estimated_minutes} min` : 'Sem tempo'}</span><span>${formatDate(job.due_date) || ''}</span></div></article>`;
}

function bindBoardEvents() {
  document.querySelectorAll('[data-collapse-stage]').forEach((button) => button.addEventListener('click', () => {
    const stage = button.dataset.collapseStage;
    collapsedStages = collapsedStages.includes(stage) ? collapsedStages.filter((item) => item !== stage) : [...collapsedStages, stage];
    localStorage.setItem('fox-collapsed-stages', JSON.stringify(collapsedStages));
    renderBoard();
  }));
  document.querySelectorAll('[data-add-stage]').forEach((button) => button.addEventListener('click', () => openJob(null, button.dataset.addStage)));
  document.querySelectorAll('.job-card').forEach((card) => {
    card.addEventListener('click', () => {
      if (card.dataset.touchMoved === 'true') { card.dataset.touchMoved = 'false'; return; }
      openJob(jobs.find((job) => job.id === card.dataset.job));
    });
    card.addEventListener('dragstart', (event) => { card.classList.add('dragging'); event.dataTransfer.setData('text/plain', card.dataset.job); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    let touchX = 0;
    let touchY = 0;
    let touchMoving = false;
    card.addEventListener('touchstart', (event) => {
      touchX = event.touches[0].clientX;
      touchY = event.touches[0].clientY;
      touchMoving = false;
    }, { passive: true });
    card.addEventListener('touchmove', (event) => {
      const dx = event.touches[0].clientX - touchX;
      const dy = event.touches[0].clientY - touchY;
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        event.preventDefault();
        touchMoving = true;
        card.classList.add('dragging');
        card.style.transform = `translateX(${dx}px)`;
      }
    }, { passive: false });
    card.addEventListener('touchend', async (event) => {
      card.classList.remove('dragging');
      card.style.transform = '';
      if (!touchMoving) return;
      card.dataset.touchMoved = 'true';
      const target = document.elementFromPoint(event.changedTouches[0].clientX, event.changedTouches[0].clientY)?.closest('.kanban-column');
      if (target) await moveJob(card.dataset.job, target.dataset.stage);
    });
  });
  document.querySelectorAll('.kanban-column').forEach((column) => {
    column.addEventListener('dragover', (event) => { event.preventDefault(); column.classList.add('drag-over'); });
    column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
    column.addEventListener('drop', async (event) => { event.preventDefault(); column.classList.remove('drag-over'); await moveJob(event.dataTransfer.getData('text/plain'), column.dataset.stage); });
  });
}

async function moveJob(id, stage) {
  const job = jobs.find((item) => item.id === id); if (!job || job.stage === stage) return;
  job.stage = stage; renderBoard();
  const { error } = await db.from('print_jobs').update({ stage, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { alert(error.message); await loadJobs(); }
}

function openJob(job = null, stage = 'ideias') {
  document.querySelector('#jobForm').reset(); document.querySelector('#jobEditorTitle').textContent = job ? 'Editar cartão' : 'Novo cartão';
  document.querySelector('#jobId').value = job?.id || ''; document.querySelector('#jobTitle').value = job?.title || ''; document.querySelector('#jobStage').value = job?.stage || stage; document.querySelector('#jobPriority').value = job?.priority || 'normal'; document.querySelector('#jobMinutes').value = job?.estimated_minutes || ''; document.querySelector('#jobDueDate').value = job?.due_date || ''; document.querySelector('#jobNotes').value = job?.notes || '';
  document.querySelector('.delete-job').hidden = !job; document.querySelector('#jobEditor').showModal();
  window.syncCustomSelects?.();
}

document.querySelector('#jobForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const id = val('jobId'); const payload = { title: val('jobTitle'), stage: val('jobStage'), priority: val('jobPriority'), estimated_minutes: Number(val('jobMinutes') || 0), due_date: val('jobDueDate') || null, notes: val('jobNotes'), position: id ? jobs.find((job) => job.id === id)?.position || 0 : jobs.length, updated_at: new Date().toISOString() };
  const { error } = await (id ? db.from('print_jobs').update(payload).eq('id', id) : db.from('print_jobs').insert(payload)); if (error) return document.querySelector('#jobStatusText').textContent = error.message;
  document.querySelector('#jobEditor').close(); await loadJobs();
});

document.querySelector('.delete-job').addEventListener('click', async () => { const id = val('jobId'); if (!id || !confirm('Excluir este cartão?')) return; const { error } = await db.from('print_jobs').delete().eq('id', id); if (error) return alert(error.message); document.querySelector('#jobEditor').close(); await loadJobs(); });
function val(id) { return document.querySelector(`#${id}`).value.trim(); }
function money(value) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatDate(value) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : ''; }
function saleFinalValue(sale) { return Math.max(0, Number(sale.total || 0) - Number(sale.discount || 0)); }
function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function formatDay(value) { return String(Number(String(value).slice(8, 10))).padStart(2, '0'); }
function formatMonth(value) { return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''); }

if (!document.querySelector('#adminView').hidden) loadDashboard();
