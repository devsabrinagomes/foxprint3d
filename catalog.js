(async function loadCatalog() {
  if (!window.foxSupabase) return;

  const { data: products, error } = await window.foxSupabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('position', { ascending: true });

  if (error || !products?.length) {
    if (error) console.error('Não foi possível carregar o catálogo:', error.message);
    return;
  }

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
  const money = (value) => value == null
    ? 'Sob consulta'
    : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const grid = document.querySelector('#productGrid');
  grid.innerHTML = products.map((product) => {
    const images = Array.isArray(product.images) ? product.images : [];
    const title = escapeHtml(product.name);
    const waMessage = escapeHtml(`Oi! Tenho interesse em ${product.name}. Queria saber sobre personalização, entrega e prazo.`);
    return `
      <article class="product-card" data-category="${escapeHtml(product.category)}" data-images="${escapeHtml(images.join(','))}">
        <div class="product-image" data-gallery data-photo-count="${images.length} foto${images.length === 1 ? '' : 's'}" aria-label="Galeria de ${title}">
          <span class="image-placeholder">📦<small>Galeria do produto</small></span>
        </div>
        <div class="product-body">
          <span class="tag">${escapeHtml(product.tag || 'Sob encomenda')}</span>
          <h3>${title}</h3>
          <p>${escapeHtml(product.description)}</p>
          <div class="price-row"><span>${product.price == null ? 'Preço' : 'A partir de'}</span><strong>${money(product.price)}</strong></div>
          <a class="btn btn-full" data-wa="${waMessage}">${product.price == null ? 'Pedir orçamento' : 'Quero esse'}</a>
        </div>
      </article>`;
  }).join('');

  document.querySelectorAll('[data-wa]').forEach((el) => {
    el.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(el.dataset.wa)}`;
    el.target = '_blank';
    el.rel = 'noreferrer';
  });
  document.dispatchEvent(new CustomEvent('catalogready'));
})();
