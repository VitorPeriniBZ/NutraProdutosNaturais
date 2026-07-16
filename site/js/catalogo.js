// ─── Catálogo Nutra ───
// Fonte de dados: API (GET /api/produtos, GET /api/categorias).
// Antes era um array estático ALL_PRODS embutido no HTML; agora vem do banco.
// A base da API pode ser sobrescrita definindo window.NUTRA_API_BASE antes deste
// script (útil se um dia o frontend for servido separado da API). Vazio = mesma origem.
var API_BASE = (window.NUTRA_API_BASE || '');

var ALL_PRODS = [];        // populado pelo fetch: {id, n, c, e, img, disp, badges, desc, destaque}
var PER_PAGE  = 12;
var curFilter = 'Todos';
var curBadge  = null;      // id da badge selecionada no filtro (null = todas)
var curPage   = 1;
var filtered  = [];
var loaded    = false;     // evita "nenhum produto" piscar antes do fetch terminar

// Gradientes rotativos para os cards de destaque sem foto (mantém o visual colorido).
var DESTAQUE_GRADS = [
  'linear-gradient(160deg,#f8d0d8 0%,#d4788a 100%)',
  'linear-gradient(160deg,#d4e8bc 0%,#8cbf74 100%)',
  'linear-gradient(160deg,#e8dcc8 0%,#b89060 100%)',
  'linear-gradient(160deg,#d4e8bc 0%,#7aaa64 100%)',
  'linear-gradient(160deg,#d8d0ee 0%,#9070c8 100%)'
];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

// Chips de badge (estilo transparente com letra branca, como nos destaques).
function badgesHtml(p) {
  if (!p.badges || !p.badges.length) return '';
  return '<div class="pcat-badges">' + p.badges.map(function (b) {
    return '<span class="pcat-badge">' + esc(b.nome) + '</span>';
  }).join('') + '</div>';
}

function waIcon() {
  return '<svg aria-hidden="true" focusable="false" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
}

// Card padrão (fluxo WhatsApp direto). O carrinho.js sobrescreve window.renderCard
// para trocar o botão por "Adicionar ao carrinho" — mesma dinâmica de antes.
function waLink(nome) {
  return 'https://wa.me/5527996600444?text=' + encodeURIComponent('Oi! Quero pedir: ' + nome + ' 🌿');
}
function imgHtml(p) {
  if (p.img) return '<img src="' + esc(p.img) + '" alt="' + esc(p.n) + '" loading="lazy" width="400" height="300">';
  return '<span class="pcat-img-emoji">' + esc(p.e) + '</span><span class="pcat-img-label">foto em breve</span>';
}
function renderCard(p) {
  if (p.disp === false) {
    return '<div class="pcat-card pcat-off">'
      + '<div class="pcat-img">' + badgesHtml(p) + imgHtml(p) + '</div>'
      + '<div class="pcat-body">'
      + '<span class="pcat-tag">' + esc(p.c) + '</span>'
      + '<span class="pcat-name">' + esc(p.n) + '</span>'
      + '<button class="pcat-wa pcat-wa-off" disabled>Indisponível</button>'
      + '</div>'
      + '</div>';
  }
  return '<a href="' + waLink(p.n) + '" target="_blank" class="pcat-card">'
    + '<div class="pcat-img">' + badgesHtml(p) + imgHtml(p) + '</div>'
    + '<div class="pcat-body">'
    + '<span class="pcat-tag">' + esc(p.c) + '</span>'
    + '<span class="pcat-name">' + esc(p.n) + '</span>'
    + '<button class="pcat-wa">' + waIcon() + ' Pedir pelo WhatsApp</button>'
    + '</div>'
    + '</a>';
}

function applyFilters() {
  var q = document.getElementById('pSearch').value.trim().toLowerCase();
  filtered = ALL_PRODS.filter(function(p) {
    var matchCat   = (curFilter === 'Todos' || p.c === curFilter);
    var matchQ     = !q || p.n.toLowerCase().indexOf(q) > -1;
    var matchBadge = !curBadge || (p.badges || []).some(function(b){ return b.id === curBadge; });
    return matchCat && matchQ && matchBadge;
  });
  curPage = 1;
  render();
}

function setFilter(cat, btn) {
  curFilter = cat;
  document.querySelectorAll('.pf-btn').forEach(function(b){b.classList.remove('pf-active');});
  if (btn) btn.classList.add('pf-active');
  applyFilters();
}

function render() {
  var grid  = document.getElementById('pcatGrid');
  var pgDiv = document.getElementById('pPagination');
  var empty = document.getElementById('pEmpty');
  if (!grid) return;

  // Ainda carregando: não mostra "nenhum produto" nem paginação.
  if (!loaded) {
    grid.innerHTML = '';
    if (pgDiv) pgDiv.innerHTML = '';
    if (empty) empty.style.display = 'none';
    return;
  }

  var total = filtered.length;
  var pages = Math.ceil(total / PER_PAGE);

  if (!total) {
    grid.innerHTML = '';
    pgDiv.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  var start = (curPage - 1) * PER_PAGE;
  var slice = filtered.slice(start, start + PER_PAGE);
  grid.innerHTML = slice.map(renderCard).join('');

  // Paginação
  if (pages <= 1) { pgDiv.innerHTML = ''; return; }
  var pg = '';
  pg += '<button class="pg-btn" onclick="goCatPage('+(curPage-1)+')" '+(curPage===1?'disabled':'')+'>←</button>';
  for (var i=1;i<=pages;i++) {
    if (i===1||i===pages||Math.abs(i-curPage)<=2) {
      pg += '<button class="pg-btn'+(i===curPage?' pg-active':'')+'" onclick="goCatPage('+i+')">'+i+'</button>';
    } else if (Math.abs(i-curPage)===3) {
      pg += '<span style="color:var(--texto-cl);padding:0 4px;">…</span>';
    }
  }
  pg += '<button class="pg-btn" onclick="goCatPage('+(curPage+1)+')" '+(curPage===pages?'disabled':'')+'>→</button>';
  pgDiv.innerHTML = pg;
}

function goCatPage(p) {
  curPage = p;
  render();
  document.getElementById('catalogo').scrollIntoView({behavior:'smooth',block:'start'});
}

// ── Barra de filtros dinâmica (a partir das categorias do banco) ──
function buildFilterBar(cats, total) {
  var bar = document.getElementById('pfBar');
  if (!bar) return;
  var html = '<button class="pf-btn pf-active" onclick="setFilter(\'Todos\',this)">Todos <span class="pf-count">'+total+'</span></button>';
  cats.forEach(function(c) {
    var nome = String(c.nome);
    var safe = nome.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    html += '<button class="pf-btn" onclick="setFilter(\''+safe+'\',this)">'
      + (c.emoji ? (c.emoji + ' ') : '') + nome
      + ' <span class="pf-count">' + c.total + '</span></button>';
  });
  bar.innerHTML = html;
}

// ── Barra de filtros por badge (só badges com produtos ativos) ──
function buildBadgeBar(badges) {
  var bar = document.getElementById('pbBar');
  if (!bar) return;
  var comProdutos = (badges || []).filter(function(b){ return Number(b.total) > 0; });
  if (!comProdutos.length) { bar.style.display = 'none'; return; }
  var html = '<span class="pb-label">Filtrar por:</span>';
  comProdutos.forEach(function(b) {
    html += '<button class="pb-btn" data-badge="' + b.id + '" onclick="setBadgeFilter(' + b.id + ',this)">'
      + esc(b.nome) + '</button>';
  });
  bar.innerHTML = html;
  bar.style.display = '';
}

function setBadgeFilter(id, btn) {
  // Clicar na badge já ativa desliga o filtro.
  if (curBadge === id) {
    curBadge = null;
    if (btn) btn.classList.remove('pb-active');
  } else {
    curBadge = id;
    document.querySelectorAll('.pb-btn').forEach(function(b){ b.classList.remove('pb-active'); });
    if (btn) btn.classList.add('pb-active');
  }
  applyFilters();
}

// ── Seção "Produtos em destaque" (dinâmica, a partir do banco) ──
function destaqueImg(p, i) {
  if (p.img) return '<img src="' + esc(p.img) + '" alt="' + esc(p.n) + '" class="pcard-photo" loading="lazy">';
  return '<span class="pcard-emoji" aria-hidden="true">' + esc(p.e || '🌿') + '</span>';
}
function destaqueCard(p, i) {
  var grad = DESTAQUE_GRADS[i % DESTAQUE_GRADS.length];
  var bg = p.img ? '' : (' style="background:' + grad + ';"');
  return '<div class="pcard">'
    + '<div class="pcard-img"' + bg + '>'
    + badgesHtml(p)
    + destaqueImg(p, i)
    + '</div>'
    + '<div class="pcard-body">'
    + '<div class="pcard-name">' + esc(p.n) + '</div>'
    + (p.desc ? '<div class="pcard-desc">' + esc(p.desc) + '</div>' : '')
    + '<a href="' + waLink(p.n) + '" target="_blank" class="pcard-cta">' + waIcon() + ' Pedir pelo WhatsApp</a>'
    + '</div>'
    + '</div>';
}
function renderDestaque() {
  var grid = document.getElementById('pcardGrid');
  var sec = document.getElementById('produtos');
  if (!grid) return;
  var destaques = ALL_PRODS.filter(function(p){ return p.destaque; });
  if (!destaques.length) {
    // Sem destaques cadastrados: esconde a seção inteira para não ficar um vazio.
    grid.innerHTML = '';
    if (sec) sec.style.display = 'none';
    return;
  }
  if (sec) sec.style.display = '';
  grid.innerHTML = destaques.map(destaqueCard).join('');
  // Re-vincula os CTAs ao carrinho (carrinho.js), já que os cards são dinâmicos agora.
  if (typeof window.wireFeatured === 'function') window.wireFeatured();
}

// ── Carga inicial via API ──
function loadCatalog() {
  var pProds = fetch(API_BASE + '/api/produtos?por_pagina=1000')
    .then(function(r){ if(!r.ok) throw new Error('produtos '+r.status); return r.json(); });
  var pCats = fetch(API_BASE + '/api/categorias')
    .then(function(r){ if(!r.ok) throw new Error('categorias '+r.status); return r.json(); })
    .catch(function(){ return []; }); // barra de filtros é opcional
  var pBadges = fetch(API_BASE + '/api/badges')
    .then(function(r){ if(!r.ok) throw new Error('badges '+r.status); return r.json(); })
    .catch(function(){ return []; }); // filtro de badges é opcional

  pProds.then(function(data) {
    var itens = (data && data.itens) ? data.itens : [];
    ALL_PRODS = itens.map(function(p) {
      return {
        id: p.id, n: p.nome, c: p.categoria, e: p.emoji || '🌿', img: p.imagem_url || '',
        disp: (p.disponivel == null) ? true : !!Number(p.disponivel),
        badges: p.badges || [],
        desc: p.descricao || '',
        destaque: !!Number(p.destaque)
      };
    });
    filtered = ALL_PRODS.slice();
    loaded = true;

    var label = document.getElementById('pTotalLabel');
    if (label) label.textContent = (data.total != null ? data.total : ALL_PRODS.length) + ' produtos disponíveis';

    pCats.then(function(cats) {
      if (Array.isArray(cats) && cats.length) buildFilterBar(cats, ALL_PRODS.length);
    });
    pBadges.then(function(badges) {
      if (Array.isArray(badges)) buildBadgeBar(badges);
    });

    renderDestaque();
    render();
    if (typeof window.wireCatalog === 'function') window.wireCatalog();
  }).catch(function(err) {
    loaded = true;
    var grid = document.getElementById('pcatGrid');
    if (grid) grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--texto-cl);padding:40px;">Não foi possível carregar os produtos agora. Tente recarregar a página. 🌿</p>';
    console.error('Falha ao carregar catálogo:', err);
  });
}

// ── Init ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadCatalog);
} else {
  loadCatalog();
}

// Expõe funções globais para os onclick="" inline
window.goCatPage   = goCatPage;
window.setFilter   = setFilter;
window.setBadgeFilter = setBadgeFilter;
window.applyFilters = applyFilters;
