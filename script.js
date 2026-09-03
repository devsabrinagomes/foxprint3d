// TROQUE APENAS O NÚMERO ABAIXO PELO SEU WHATSAPP COM DDD E DDI.
// Exemplo para Brasil: 5588996403012
const WHATSAPP_NUMBER = "5588996403012";

document.querySelectorAll('[data-wa]').forEach((el) => {
  el.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(el.dataset.wa)}`;
  el.target = '_blank';
  el.rel = 'noreferrer';
});

document.querySelector('.filters')?.addEventListener('click', (event) => {
  const button = event.target.closest('.filter');
  if (!button) return;
    document.querySelectorAll('.filter').forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    const filter = button.dataset.filter;

    document.querySelectorAll('.product-card').forEach((card) => {
      const categories = card.dataset.category.split(' ');
      card.classList.toggle('hidden', filter !== 'todos' && !categories.includes(filter));
    });
});

// GALERIAS: adicione os arquivos na pasta assets/produtos e informe os nomes
// no atributo data-images do produto, separados por vírgula.
const modal = document.querySelector('#imageModal');
const modalImage = document.querySelector('#modalImage');
const modalCaption = document.querySelector('#modalCaption');
const modalDots = document.querySelector('#modalDots');
const modalImageStage = document.querySelector('#modalImageStage');
let currentGallery = [];
let currentImageIndex = 0;
let currentProductTitle = '';
let touchStartX = 0;
let touchStartY = 0;

function openImageModal(images, index, title) {
  currentGallery = images;
  currentImageIndex = index;
  currentProductTitle = title;
  updateModalImage();
  modal.showModal();
  document.body.style.overflow = 'hidden';
}

function updateModalImage(direction = 0) {
  if (direction) {
    modalImage.classList.add(direction > 0 ? 'changing-left' : 'changing-right');
  }

  window.setTimeout(() => {
    modalImage.src = currentGallery[currentImageIndex];
    modalImage.alt = `${currentProductTitle} — foto ${currentImageIndex + 1}`;
    modalCaption.textContent = `${currentProductTitle} · ${currentImageIndex + 1} de ${currentGallery.length}`;
    modalDots.innerHTML = '';
    currentGallery.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `modal-dot${index === currentImageIndex ? ' active' : ''}`;
      dot.setAttribute('aria-label', `Ir para foto ${index + 1}`);
      dot.addEventListener('click', () => {
        const directionToImage = index > currentImageIndex ? 1 : -1;
        currentImageIndex = index;
        updateModalImage(directionToImage);
      });
      modalDots.append(dot);
    });
    modalImage.classList.remove('changing-left', 'changing-right');
  }, direction ? 180 : 0);
}

function changeModalImage(direction) {
  if (!currentGallery.length) return;
  currentImageIndex = (currentImageIndex + direction + currentGallery.length) % currentGallery.length;
  updateModalImage(direction);
}

function initializeGalleries() {
document.querySelectorAll('.product-card:not([data-gallery-ready])').forEach((card) => {
  card.dataset.galleryReady = 'true';
  const gallery = card.querySelector('[data-gallery]');
  const title = card.querySelector('h3').textContent;
  const images = (card.dataset.images || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (!gallery || !images.length) return;

  const loadImage = (src) => new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve(src);
    probe.onerror = () => resolve(null);
    probe.src = src;
  });

  Promise.all(images.map(loadImage)).then((loadedImages) => {
    const availableImages = loadedImages.filter(Boolean);
    if (availableImages.length) {
      gallery.dataset.photoCount = `${availableImages.length} foto${availableImages.length > 1 ? 's' : ''}`;
      gallery.setAttribute('aria-label', `Galeria com ${availableImages.length} foto${availableImages.length > 1 ? 's' : ''} de ${title}`);
      renderGallery(availableImages);
    }
  });

  function renderGallery(availableImages) {
    gallery.innerHTML = '';
    const mainImage = document.createElement('img');
    mainImage.src = availableImages[0];
    mainImage.alt = `${title} — foto 1`;
    gallery.append(mainImage);

    const hint = document.createElement('span');
    hint.className = 'zoom-hint';
    hint.textContent = 'Ampliar';
    gallery.append(hint);

    const thumbs = document.createElement('div');
    thumbs.className = 'gallery-thumbs';
    availableImages.forEach((src, index) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = `gallery-thumb${index === 0 ? ' active' : ''}`;
      thumb.setAttribute('aria-label', `Ver foto ${index + 1} de ${title}`);
      thumb.innerHTML = `<img src="${src}" alt="" />`;
      thumb.addEventListener('click', () => {
        mainImage.src = src;
        mainImage.alt = `${title} — foto ${index + 1}`;
        thumbs.querySelectorAll('.gallery-thumb').forEach((item) => item.classList.remove('active'));
        thumb.classList.add('active');
        mainImage.onclick = () => openImageModal(availableImages, index, title);
      });
      thumbs.append(thumb);
    });
    gallery.append(thumbs);
    mainImage.onclick = () => openImageModal(availableImages, 0, title);
  }
});
}

initializeGalleries();
document.addEventListener('catalogready', initializeGalleries);

function closeImageModal() {
  modal.close();
  document.body.style.overflow = '';
}

document.querySelector('.modal-close').addEventListener('click', closeImageModal);
document.querySelector('.modal-prev').addEventListener('click', () => changeModalImage(-1));
document.querySelector('.modal-next').addEventListener('click', () => changeModalImage(1));
modal.addEventListener('click', (event) => { if (event.target === modal) closeImageModal(); });
modal.addEventListener('close', () => { document.body.style.overflow = ''; });

modalImageStage.addEventListener('touchstart', (event) => {
  touchStartX = event.changedTouches[0].clientX;
  touchStartY = event.changedTouches[0].clientY;
}, { passive: true });

modalImageStage.addEventListener('touchend', (event) => {
  const distanceX = event.changedTouches[0].clientX - touchStartX;
  const distanceY = event.changedTouches[0].clientY - touchStartY;
  if (Math.abs(distanceX) < 45 || Math.abs(distanceX) < Math.abs(distanceY)) return;
  changeModalImage(distanceX < 0 ? 1 : -1);
}, { passive: true });
document.addEventListener('keydown', (event) => {
  if (!modal.open) return;
  if (event.key === 'ArrowLeft') changeModalImage(-1);
  if (event.key === 'ArrowRight') changeModalImage(1);
});
