const db = window.foxSupabase;
const loginView = document.querySelector('#loginView');
const adminView = document.querySelector('#adminView');
const editor = document.querySelector('#productEditor');
const form = document.querySelector('#productForm');
let products = [];
let keptImages = [];

if (!db) {
  document.querySelector('#loginStatus').textContent = 'Configure a URL e a chave pública em supabase-config.js antes de entrar.';
  document.querySelector('#loginForm button').disabled = true;
} else {
  startAdmin();
}

async function startAdmin() {
  const { data } = await db.auth.getSession();
  showSession(data.session);
  db.auth.onAuthStateChange((_event, session) => showSession(session));
}

async function showSession(session) {
  loginView.hidden = Boolean(session);
  adminView.hidden = !session;
  document.body.classList.toggle('admin-authenticated', Boolean(session));
  if (session) {
    document.querySelector('#adminEmail').textContent = session.user.email || 'Administrador';
    await loadProducts();
  }
}

document.querySelector('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('#loginStatus');
  status.textContent = 'Entrando...';
  const { error } = await db.auth.signInWithPassword({
    email: document.querySelector('#loginEmail').value,
    password: document.querySelector('#loginPassword').value
  });
  status.textContent = error ? `Não foi possível entrar: ${error.message}` : '';
});

document.querySelector('#logoutButton').addEventListener('click', () => db.auth.signOut());
document.querySelector('#newProductButton').addEventListener('click', () => openEditor());
document.querySelector('.editor-close').addEventListener('click', () => editor.close());

async function loadProducts() {
  const container = document.querySelector('#adminProducts');
  container.innerHTML = '<p>Carregando produtos...</p>';
  const { data, error } = await db.from('products').select('*').order('position');
  if (error) return container.innerHTML = `<p>Erro: ${escapeHtml(error.message)}</p>`;
  products = data || [];
  container.innerHTML = products.length ? products.map((product) => `
    <article class="admin-product">
      ${product.images?.[0] ? `<img src="${escapeHtml(product.images[0])}" alt="">` : '<div class="admin-product-placeholder">📦</div>'}
      <div><h3>${escapeHtml(product.name)}</h3><p>${formatPrice(product.price)} · ${escapeHtml(product.category)} · ${product.images?.length || 0} foto(s)</p></div>
      <span class="status-pill${product.active ? '' : ' off'}">${product.active ? 'Visível' : 'Oculto'}</span>
      <div class="admin-actions"><button data-edit="${product.id}">Editar</button><button data-delete="${product.id}">Excluir</button></div>
    </article>`).join('') : '<p>Nenhum produto cadastrado.</p>';

  container.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => openEditor(products.find((item) => item.id === button.dataset.edit))));
  container.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deleteProduct(button.dataset.delete)));
}

function openEditor(product = null) {
  form.reset();
  keptImages = [...(product?.images || [])];
  document.querySelector('#editorTitle').textContent = product ? 'Editar produto' : 'Novo produto';
  document.querySelector('#productId').value = product?.id || '';
  document.querySelector('#productName').value = product?.name || '';
  document.querySelector('#productPrice').value = product?.price ?? '';
  document.querySelector('#productCategory').value = product?.category || 'presentes';
  document.querySelector('#productTag').value = product?.tag || '';
  document.querySelector('#productPosition').value = product?.position ?? products.length;
  document.querySelector('#productDescription').value = product?.description || '';
  document.querySelector('#productActive').checked = product?.active ?? true;
  document.querySelector('#productStatus').textContent = '';
  renderExistingImages();
  window.syncCustomSelects?.();
  editor.showModal();
}

function renderExistingImages() {
  const container = document.querySelector('#existingImages');
  container.innerHTML = keptImages.map((url, index) => `<div class="existing-image"><img src="${escapeHtml(url)}" alt="Foto ${index + 1}"><button type="button" data-remove-image="${index}" aria-label="Remover foto">×</button></div>`).join('');
  container.querySelectorAll('[data-remove-image]').forEach((button) => button.addEventListener('click', () => {
    keptImages.splice(Number(button.dataset.removeImage), 1);
    renderExistingImages();
  }));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  const status = document.querySelector('#productStatus');
  submit.disabled = true;
  status.textContent = 'Enviando fotos e salvando...';
  try {
    const newImages = await uploadImages([...document.querySelector('#productImages').files]);
    const priceValue = document.querySelector('#productPrice').value;
    const payload = {
      name: document.querySelector('#productName').value.trim(),
      description: document.querySelector('#productDescription').value.trim(),
      price: priceValue === '' ? null : Number(priceValue),
      category: document.querySelector('#productCategory').value,
      tag: document.querySelector('#productTag').value.trim() || 'Sob encomenda',
      position: Number(document.querySelector('#productPosition').value) || 0,
      active: document.querySelector('#productActive').checked,
      images: [...keptImages, ...newImages],
      updated_at: new Date().toISOString()
    };
    const id = document.querySelector('#productId').value;
    const query = id ? db.from('products').update(payload).eq('id', id) : db.from('products').insert(payload);
    const { error } = await query;
    if (error) throw error;
    editor.close();
    await loadProducts();
  } catch (error) {
    status.textContent = `Erro: ${error.message}`;
  } finally {
    submit.disabled = false;
  }
});

async function uploadImages(files) {
  const urls = [];
  for (const file of files) {
    if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} ultrapassa o limite de 15 MB para conversão.`);
    const webpFile = await convertImageToWebP(file);
    if (webpFile.size > 5 * 1024 * 1024) throw new Error(`${file.name} continuou maior que 5 MB após a conversão.`);
    const path = `${crypto.randomUUID()}.webp`;
    const { error } = await db.storage.from('products').upload(path, webpFile, { cacheControl: '3600', contentType: 'image/webp' });
    if (error) throw error;
    urls.push(db.storage.from('products').getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

async function convertImageToWebP(file) {
  const image = await createImageBitmap(file);
  const maxDimension = 2000;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);
  image.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
  if (!blob || blob.type !== 'image/webp') throw new Error(`Seu navegador não conseguiu converter ${file.name} para WebP.`);
  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  return new File([blob], `${baseName || 'produto'}.webp`, { type: 'image/webp' });
}

async function deleteProduct(id) {
  const product = products.find((item) => item.id === id);
  if (!confirm(`Excluir “${product.name}”? Essa ação não pode ser desfeita.`)) return;
  const { error } = await db.from('products').delete().eq('id', id);
  if (error) return alert(`Erro: ${error.message}`);
  await loadProducts();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}
function formatPrice(value) {
  return value == null ? 'Sob consulta' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function initializeCustomSelects() {
  document.querySelectorAll('.admin-page select:not([data-customized])').forEach((select) => {
    select.dataset.customized = 'true';
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(select);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const list = document.createElement('div');
    list.className = 'custom-select-menu';
    list.setAttribute('role', 'listbox');
    wrapper.append(trigger, list);

    function renderOptions() {
      const selected = select.options[select.selectedIndex];
      trigger.innerHTML = `<span>${selected?.textContent || 'Selecione'}</span><span class="select-chevron">⌄</span>`;
      list.innerHTML = '';
      [...select.options].forEach((option) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `custom-select-option${option.selected ? ' selected' : ''}`;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(option.selected));
        item.textContent = option.textContent;
        item.addEventListener('click', () => {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          renderOptions();
          closeMenu();
          trigger.focus();
        });
        list.append(item);
      });
    }

    function closeMenu() {
      wrapper.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', () => {
      const opening = !wrapper.classList.contains('open');
      document.querySelectorAll('.custom-select.open').forEach((item) => item.classList.remove('open'));
      wrapper.classList.toggle('open', opening);
      trigger.setAttribute('aria-expanded', String(opening));
    });
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        wrapper.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        list.querySelector('.selected')?.focus();
      }
    });
    select.addEventListener('change', renderOptions);
    wrapper._syncCustomSelect = renderOptions;
    renderOptions();
  });
}

window.syncCustomSelects = () => document.querySelectorAll('.custom-select').forEach((wrapper) => wrapper._syncCustomSelect?.());
document.addEventListener('click', (event) => {
  document.querySelectorAll('.custom-select.open').forEach((wrapper) => {
    if (!wrapper.contains(event.target)) {
      wrapper.classList.remove('open');
      wrapper.querySelector('.custom-select-trigger').setAttribute('aria-expanded', 'false');
    }
  });
});
initializeCustomSelects();
