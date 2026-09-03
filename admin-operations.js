const STAGES = [
  ['ideias', 'Ideias'], ['preparar', 'Preparar arquivo'], ['pronto', 'Pronto para imprimir'],
  ['imprimindo', 'Em impressão'], ['acabamento', 'Acabamento'], ['finalizado', 'Finalizado']
];
let sales = [];
let jobs = [];
let customers = [];
let collapsedStages = JSON.parse(localStorage.getItem('fox-collapsed-stages') || '[]');

document.querySelectorAll('.admin-tab').forEach((tab) => tab.addEventListener('click', async () => {
  document.querySelectorAll('.admin-tab').forEach((item) => item.classList.toggle('active', item === tab));
  document.querySelectorAll('.admin-view').forEach((view) => { view.hidden = view.id !== tab.dataset.view; });
  if (tab.dataset.view === 'salesView') await loadSales();
  if (tab.dataset.view === 'customersView') await loadCustomers();
  if (tab.dataset.view === 'productionView') await loadJobs();
  closeSidebar();
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
  sidebarCollapse.textContent = collapsed ? '›' : '‹';
  sidebarCollapse.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
  sidebarCollapse.title = collapsed ? 'Expandir menu' : 'Recolher menu';
  localStorage.setItem('fox-sidebar-collapsed', String(collapsed));
}
setSidebarCollapsed(localStorage.getItem('fox-sidebar-collapsed') === 'true');
sidebarCollapse.addEventListener('click', () => setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed')));

document.querySelector('#newSaleButton').addEventListener('click', () => openSale());
document.querySelector('.sale-close').addEventListener('click', () => document.querySelector('#saleEditor').close());
document.querySelector('#saleCancelButton').addEventListener('click', () => document.querySelector('#saleEditor').close());
document.querySelector('#newJobButton').addEventListener('click', () => openJob());
document.querySelector('.job-close').addEventListener('click', () => document.querySelector('#jobEditor').close());

async function loadSales() {
  const { data, error } = await db.from('sales').select('*').order('sale_date', { ascending: false });
  if (error) return alert(`Erro ao carregar vendas: ${error.message}`);
  sales = data || [];
  const total = sales.filter((s) => s.status !== 'cancelado').reduce((sum, s) => sum + Math.max(0, Number(s.total) - Number(s.discount || 0)), 0);
  const received = sales.filter((s) => s.status !== 'cancelado').reduce((sum, s) => sum + Number(s.paid), 0);
  const pending = Math.max(0, total - received);
  document.querySelector('#salesSummary').innerHTML = [['Vendas', sales.length], ['Total vendido', money(total)], ['Recebido', money(received)], ['A receber', money(pending)]].map(([label, value]) => `<div class="summary-card"><small>${label}</small><strong>${value}</strong></div>`).join('');
  document.querySelector('#salesList').innerHTML = sales.length ? sales.map((sale) => { const discount = Number(sale.discount || 0); const finalValue = Math.max(0, Number(sale.total) - discount); return `<tr><td><strong>${escapeHtml(sale.customer)}</strong><small>${escapeHtml(sale.description)}</small></td><td><strong>${money(finalValue)}</strong>${discount > 0 ? `<span class="discount-pill">Desconto ${money(discount)}</span><small class="original-value">De ${money(sale.total)}</small>` : ''}<small>Pago: ${money(sale.paid)}</small></td><td><div class="payment-info"><strong class="payment-method">${escapeHtml(sale.payment_method)}</strong><span class="payment-pill ${sale.status}">${sale.status}</span></div></td><td>${formatDate(sale.due_date) || '—'}</td><td class="row-actions"><button data-sale="${sale.id}">Editar</button></td></tr>`; }).join('') : '<tr><td colspan="5">Nenhuma venda registrada.</td></tr>';
  document.querySelectorAll('[data-sale]').forEach((button) => button.addEventListener('click', () => openSale(sales.find((sale) => sale.id === button.dataset.sale))));
}

async function openSale(sale = null) {
  document.querySelector('#saleForm').reset();
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
  document.querySelector('#saleNotes').value = sale?.notes || '';
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
  const payload = { customer: val('saleCustomer'), contact: val('saleContact'), description: val('saleDescription'), total, discount, paid: Number(val('salePaid') || 0), payment_method: val('saleMethod'), status: val('saleStatus'), sale_date: val('saleDate'), due_date: val('saleDueDate') || null, notes: val('saleNotes'), updated_at: new Date().toISOString() };
  const normalizedContact = payload.contact.replace(/\s+/g, ' ').trim().toLowerCase();
  const { data: existingCustomer } = await db.from('customers').select('id,marketing_consent').eq('contact', normalizedContact).maybeSingle();
  const customerData = { name: payload.customer, contact: normalizedContact, marketing_consent: document.querySelector('#saleMarketingConsent').checked, updated_at: new Date().toISOString() };
  const { error: customerError } = existingCustomer
    ? await db.from('customers').update(customerData).eq('id', existingCustomer.id)
    : await db.from('customers').insert(customerData);
  if (customerError) return document.querySelector('#saleStatusText').textContent = `Erro ao salvar cliente: ${customerError.message}`;
  const { error } = await (id ? db.from('sales').update(payload).eq('id', id) : db.from('sales').insert(payload));
  if (error) return document.querySelector('#saleStatusText').textContent = error.message;
  document.querySelector('#saleEditor').close(); await loadSales();
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
  const { data, error } = await db.from('customers').select('*').order('name');
  if (error) return alert(`Erro ao carregar clientes: ${error.message}`);
  customers = data || [];
  renderCustomers(customers);
}

function renderCustomers(list) {
  document.querySelector('#customerCount').textContent = `${list.length} cliente${list.length === 1 ? '' : 's'}`;
  document.querySelector('#customerList').innerHTML = list.length ? list.map((customer) => {
    const isPhone = /^\+?[\d ()-]{8,}$/.test(customer.contact);
    const cleanPhone = customer.contact.replace(/\D/g, '');
    const href = isPhone ? `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`}` : `mailto:${encodeURIComponent(customer.contact)}`;
    return `<article class="customer-row"><div class="customer-avatar">${escapeHtml(customer.name.slice(0, 2).toUpperCase())}</div><div><strong>${escapeHtml(customer.name)}</strong><a href="${href}" target="_blank" rel="noreferrer">${escapeHtml(customer.contact)}</a></div><span class="consent-pill ${customer.marketing_consent ? 'allowed' : ''}">${customer.marketing_consent ? 'Aceita promoções' : 'Sem autorização'}</span></article>`;
  }).join('') : '<p class="empty-state">Nenhum cliente cadastrado.</p>';
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
  document.querySelector('#kanbanBoard').innerHTML = STAGES.map(([key, label]) => {
    const stageJobs = jobs.filter((job) => job.stage === key);
    const collapsed = collapsedStages.includes(key);
    return `<section class="kanban-column${collapsed ? ' collapsed' : ''}" data-stage="${key}"><div class="kanban-head"><h3>${label}</h3><div class="kanban-head-actions"><span class="kanban-count">${stageJobs.length}</span><button class="collapse-column" type="button" data-collapse-stage="${key}" aria-label="${collapsed ? 'Expandir' : 'Recolher'} ${label}" title="${collapsed ? 'Expandir quadro' : 'Recolher quadro'}">${collapsed ? '›' : '‹'}</button></div></div><div class="kanban-cards">${stageJobs.map(jobCard).join('')}</div><button class="add-job" data-add-stage="${key}">＋ Adicionar cartão</button></section>`;
  }).join('');
  bindBoardEvents();
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
