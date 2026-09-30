const dataUrl = new URL('./data/videos.json', document.baseURI);
const grid = document.querySelector('#video-grid');
const empty = document.querySelector('#empty-state');
const noResults = document.querySelector('#no-results');
const searchInput = document.querySelector('#search-input');
const categoryFilter = document.querySelector('#category-filter');
const countryFilter = document.querySelector('#country-filter');
const extraFilters = [
  ['language-filter', 'language'], ['ingredient-filter', 'ingredients'], ['technique-filter', 'techniques'],
  ['chef-filter', 'chef'], ['restaurant-filter', 'restaurant'], ['dish-filter', 'dish'],
  ['duration-filter', 'duration'], ['season-filter', 'season']
].map(([id, field]) => ({ select: document.querySelector(`#${id}`), field }));
let videos = [];

const text = (value) => typeof value === 'string' ? value.trim() : '';
const values = (value) => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
const secureUrl = (value, relative = false) => {
  try { return new URL(value, relative ? document.baseURI : undefined).protocol === 'https:'; }
  catch { return false; }
};
const slugFor = (video) => (text(video.slug) || `${text(video.title)}-${text(video.video_id)}`)
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
const appendOption = (select, value) => {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = value;
  select.append(option);
};
const isEligible = (video) => {
  const verifiedRights = ['OWNED', 'LICENSED', 'OFFICIAL_EMBED_ALLOWED', 'PUBLIC_DOMAIN'].includes(video.rights_status);
  const provenance = video.provenance && typeof video.provenance === 'object' && secureUrl(text(video.provenance.evidence_url));
  const duration = !text(video.duration) || /^PT(?=\d)(?:(?:\d+)H)?(?:(?:\d+)M)?(?:(?:\d+(?:\.\d+)?)S)?$/.test(text(video.duration));
  return video.status === 'PUBLISHED' && verifiedRights && Boolean(provenance) && duration &&
    text(video.video_id).length > 0 && text(video.title).length >= 3 && text(video.description).length >= 15 &&
    text(video.editorial_summary).length >= 60 && text(video.source).length > 0 && secureUrl(text(video.source_url)) &&
    secureUrl(text(video.thumbnail), true) && text(video.attribution).length > 0 &&
    text(video.language).length > 0 && text(video.content_type).length > 0 && Boolean(slugFor(video)) &&
    (video.rights_status !== 'OFFICIAL_EMBED_ALLOWED' || /^(https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/|https:\/\/player\.vimeo\.com\/video\/)/.test(text(video.embed_url)));
};
const make = (tag, className, content) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
};

function renderCards() {
  const query = text(searchInput.value).toLocaleLowerCase('pt-BR');
  const category = categoryFilter.value;
  const country = countryFilter.value;
  const selected = extraFilters.map(({ select, field }) => ({ field, value: select.value })).filter((filter) => filter.value);
  const shown = videos.filter((video) => {
    const haystack = [video.title, video.description, video.editorial_summary, video.dish, video.chef,
      video.restaurant, ...values(video.ingredients), ...values(video.techniques), ...values(video.entities)]
      .map(text).join(' ').toLocaleLowerCase('pt-BR');
    const facetsMatch = selected.every(({ field, value }) => {
      const fieldValue = video[field];
      return Array.isArray(fieldValue) ? values(fieldValue).includes(value) : text(fieldValue) === value;
    });
    return (!query || haystack.includes(query)) && (!category || video.content_type === category) &&
      (!country || video.country === country) && facetsMatch;
  });
  grid.replaceChildren();
  shown.forEach((video) => {
    const card = make('article', 'video-card');
    const anchor = make('a');
    const slug = slugFor(video);
    anchor.href = slug ? `./video/${encodeURIComponent(slug)}/` : './#library';
    if (text(video.thumbnail)) {
      const img = make('img', 'video-thumb');
      img.src = text(video.thumbnail);
      img.alt = text(video.title) ? `Thumbnail: ${text(video.title)}` : 'Thumbnail do vídeo';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => img.replaceWith(make('div', 'video-thumb-placeholder', 'Kitchen AI'));
      anchor.append(img);
    } else anchor.append(make('div', 'video-thumb-placeholder', 'Kitchen AI'));
    const body = make('div', 'video-info');
    const meta = make('div', 'video-meta');
    [video.country, video.language, video.duration].map(text).filter(Boolean).forEach((item) => meta.append(make('span', '', item)));
    body.append(meta, make('h3', '', text(video.title)), make('p', '', text(video.editorial_summary)));
    const tags = make('div', 'video-tags');
    [...values(video.ingredients).slice(0, 2), ...values(video.techniques).slice(0, 1)].forEach((tag) => tags.append(make('span', '', tag)));
    if (tags.childElementCount) body.append(tags);
    anchor.append(body);
    card.append(anchor);
    grid.append(card);
  });
  empty.hidden = videos.length > 0;
  noResults.hidden = videos.length === 0 || shown.length > 0;
  document.querySelector('#library-count').textContent = `${shown.length} ${shown.length === 1 ? 'item' : 'itens'}`;
}

function updateOptions(select, items) {
  const first = select.firstElementChild;
  select.replaceChildren(first);
  [...new Set(items.map(text).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .forEach((item) => appendOption(select, item));
}

function facetValues(field) {
  return videos.flatMap((video) => Array.isArray(video[field]) ? values(video[field]) : [text(video[field])]).filter(Boolean);
}

async function loadCatalog() {
  try {
    const response = await fetch(dataUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const all = Array.isArray(payload) ? payload : payload.videos;
    if (!Array.isArray(all)) throw new Error('manifesto sem lista de vídeos');
    const ids = new Set();
    const slugs = new Set();
    videos = all.filter((video) => {
      const id = text(video?.video_id);
      const slug = slugFor(video || {});
      if (!isEligible(video || {}) || ids.has(id) || slugs.has(slug)) return false;
      ids.add(id); slugs.add(slug);
      return true;
    }).map((video) => ({ ...video, slug: slugFor(video) }));
    document.querySelector('#video-count').textContent = String(all.length);
    document.querySelector('#page-count').textContent = String(videos.length);
    document.querySelector('#rights-count').textContent = String(videos.filter((v) => ['OWNED','LICENSED','OFFICIAL_EMBED_ALLOWED','PUBLIC_DOMAIN'].includes(v.rights_status)).length);
    updateOptions(categoryFilter, videos.map((video) => video.content_type));
    updateOptions(countryFilter, videos.map((video) => video.country));
    extraFilters.forEach(({ select, field }) => updateOptions(select, facetValues(field)));
    renderCards();
    document.querySelector('#build-state').textContent = `${all.length} registro(s) no manifesto local`;
  } catch (error) {
    document.querySelector('#build-state').textContent = 'Não foi possível ler data/videos.json';
    document.querySelector('#video-count').textContent = 'N/D';
    document.querySelector('#page-count').textContent = 'N/D';
    document.querySelector('#rights-count').textContent = 'N/D';
    empty.querySelector('h3').textContent = 'Manifesto local indisponível';
    empty.querySelector('p').textContent = `A biblioteca não exibirá conteúdo sem uma fonte válida (${error.message}).`;
  }
}

for (const control of [searchInput, categoryFilter, countryFilter, ...extraFilters.map(({ select }) => select)]) {
  control.addEventListener('input', renderCards);
  control.addEventListener('change', renderCards);
}

document.querySelector('#manifest-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  const result = document.querySelector('#import-result');
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const rows = Array.isArray(payload) ? payload : payload.videos;
    if (!Array.isArray(rows)) throw new Error('esperada uma lista JSON ou um objeto {"videos":[]}');
    const ids = new Set();
    const slugs = new Set();
    const eligible = rows.filter((video) => {
      const id = text(video?.video_id);
      const slug = slugFor(video || {});
      if (!isEligible(video || {}) || ids.has(id) || slugs.has(slug)) return false;
      ids.add(id); slugs.add(slug);
      return true;
    });
    const needsReview = rows.length - eligible.length;
    result.textContent = `Prévia local: ${rows.length} registro(s), ${eligible.length} elegível(is), ${needsReview} aguardando verificação. Nada foi enviado, salvo ou publicado.`;
  } catch (error) {
    result.textContent = `Manifesto inválido: ${error.message}. Nenhum dado foi enviado ou salvo.`;
  } finally {
    event.target.value = '';
  }
});

loadCatalog();
