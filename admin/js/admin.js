// Painel administrativo Nutra — lógica de sessão + CRUD via API.
(function () {
  'use strict';

  var categoriasCache = [];
  var badgesCache = [];

  // ───────── Helpers de API ─────────
  function api(method, path, body) {
    var opts = { method: method, credentials: 'include', headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(path, opts).then(function (r) {
      if (r.status === 401) { location.replace('login.html'); throw new Error('não autenticado'); }
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.erro || 'Erro na requisição');
        return j;
      });
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function precoBR(v) {
    if (v == null || v === '') return '—';
    var n = Number(v);
    if (Number.isNaN(n)) return '—';
    return 'R$ ' + n.toFixed(2).replace('.', ',');
  }

  var toastEl = document.getElementById('toast');
  var toastT;
  function toast(msg, tipo) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show' + (tipo === 'erro' ? ' erro' : '');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  // Status combinado: inativo (some do site) > indisponível (visível, sem carrinho) > ativo
  function statusBadge(p) {
    if (!p.ativo) return '<span class="badge inativo">Inativo</span>';
    if (!p.disponivel) return '<span class="badge indispon">Indisponível</span>';
    return '<span class="badge ativo">Ativo</span>';
  }

  function thumbHtml(p) {
    if (p.imagem_url) return '<div class="thumb"><img src="' + esc(p.imagem_url) + '" alt=""></div>';
    return '<div class="thumb">' + esc(p.emoji || '🌿') + '</div>';
  }

  // ───────── Sessão / topo ─────────
  api('GET', '/api/auth/me').then(function (r) {
    document.getElementById('adminNome').textContent = r.admin.nome;
  });
  document.getElementById('btnLogout').addEventListener('click', function () {
    api('POST', '/api/auth/logout').then(function () { location.replace('login.html'); });
  });

  // ───────── Tabs ─────────
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('ativo'); });
      document.querySelectorAll('.painel').forEach(function (p) { p.classList.remove('ativo'); });
      tab.classList.add('ativo');
      document.getElementById('painel-' + tab.dataset.painel).classList.add('ativo');
    });
  });

  // ───────── Modais ─────────
  function abrir(id) { document.getElementById(id).classList.add('open'); }
  function fechar(id) { document.getElementById(id).classList.remove('open'); }
  document.querySelectorAll('[data-fechar]').forEach(function (b) {
    b.addEventListener('click', function () { this.closest('.modal-overlay').classList.remove('open'); });
  });
  document.querySelectorAll('.modal-overlay').forEach(function (ov) {
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('open'); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(function (m) { m.classList.remove('open'); });
  });

  // ───────── Categorias ─────────
  function carregarCategorias() {
    return api('GET', '/api/admin/categorias').then(function (cats) {
      categoriasCache = cats;
      // Selects (filtro de produtos + form de produto)
      var optFiltro = '<option value="">Todas as categorias</option>';
      var optForm = '<option value="">— sem categoria —</option>';
      cats.forEach(function (c) {
        optFiltro += '<option value="' + c.id + '">' + esc(c.emoji ? c.emoji + ' ' : '') + esc(c.nome) + '</option>';
        optForm += '<option value="' + c.id + '">' + esc(c.emoji ? c.emoji + ' ' : '') + esc(c.nome) + '</option>';
      });
      document.getElementById('prodCategoria').innerHTML = optFiltro;
      document.getElementById('pCategoria').innerHTML = optForm;
      renderCategorias(cats);
    });
  }

  function renderCategorias(cats) {
    document.getElementById('catCarregando').style.display = 'none';
    var tbody = document.getElementById('catTbody');
    var cards = document.getElementById('catCards');
    document.getElementById('catVazio').style.display = cats.length ? 'none' : 'block';

    tbody.innerHTML = cats.map(function (c) {
      return '<tr>'
        + '<td class="col-img"><div class="thumb">' + esc(c.emoji || '🗂️') + '</div></td>'
        + '<td>' + esc(c.nome) + '</td>'
        + '<td>' + c.total + ' <span style="color:var(--texto-cl)">(' + c.total_ativos + ' ativos)</span></td>'
        + '<td>' + c.ordem + '</td>'
        + '<td><div class="acoes">'
        + '<button class="btn btn-ghost btn-sm" data-editar-cat="' + c.id + '">Editar</button>'
        + '<button class="btn btn-danger btn-sm" data-excluir-cat="' + c.id + '">Excluir</button>'
        + '</div></td></tr>';
    }).join('');

    cards.innerHTML = cats.map(function (c) {
      return '<div class="prod-card">'
        + '<div class="thumb">' + esc(c.emoji || '🗂️') + '</div>'
        + '<div class="info"><div class="nome">' + esc(c.nome) + '</div>'
        + '<div class="meta"><span>' + c.total + ' produtos (' + c.total_ativos + ' ativos)</span><span>ordem ' + c.ordem + '</span></div></div>'
        + '<div class="acoes">'
        + '<button class="btn btn-ghost btn-sm" data-editar-cat="' + c.id + '">Editar</button>'
        + '<button class="btn btn-danger btn-sm" data-excluir-cat="' + c.id + '">Excluir</button>'
        + '</div></div>';
    }).join('');
  }

  function abrirCategoria(cat) {
    document.getElementById('formCategoria').reset();
    document.getElementById('cId').value = cat ? cat.id : '';
    document.getElementById('cNome').value = cat ? cat.nome : '';
    document.getElementById('cEmoji').value = cat && cat.emoji ? cat.emoji : '';
    document.getElementById('cOrdem').value = cat ? cat.ordem : 0;
    document.getElementById('modalCategoriaTitulo').textContent = cat ? 'Editar categoria' : 'Nova categoria';
    abrir('modalCategoria');
  }

  document.getElementById('btnNovaCategoria').addEventListener('click', function () { abrirCategoria(null); });

  document.getElementById('formCategoria').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('cId').value;
    var payload = {
      nome: document.getElementById('cNome').value.trim(),
      emoji: document.getElementById('cEmoji').value.trim(),
      ordem: document.getElementById('cOrdem').value,
    };
    var btn = document.getElementById('btnSalvarCategoria');
    btn.disabled = true;
    var req = id ? api('PUT', '/api/admin/categorias/' + id, payload) : api('POST', '/api/admin/categorias', payload);
    req.then(function () {
      fechar('modalCategoria');
      toast('Categoria salva 🌿');
      return carregarCategorias();
    }).catch(function (err) { toast(err.message, 'erro'); })
      .finally(function () { btn.disabled = false; });
  });

  // Delegação de cliques (editar/excluir categoria)
  document.querySelectorAll('#painel-categorias').forEach(function (root) {
    root.addEventListener('click', function (e) {
      var ed = e.target.closest('[data-editar-cat]');
      var ex = e.target.closest('[data-excluir-cat]');
      if (ed) {
        var cat = categoriasCache.find(function (c) { return String(c.id) === ed.dataset.editarCat; });
        abrirCategoria(cat);
      } else if (ex) {
        var c2 = categoriasCache.find(function (c) { return String(c.id) === ex.dataset.excluirCat; });
        if (confirm('Excluir a categoria "' + (c2 ? c2.nome : '') + '"?')) {
          api('DELETE', '/api/admin/categorias/' + ex.dataset.excluirCat)
            .then(function () { toast('Categoria excluída'); return carregarCategorias(); })
            .catch(function (err) { toast(err.message, 'erro'); });
        }
      }
    });
  });

  // ───────── Produtos ─────────
  var produtosCache = [];
  var buscaTimer;

  function carregarProdutos() {
    var params = new URLSearchParams();
    var busca = document.getElementById('prodBusca').value.trim();
    var cat = document.getElementById('prodCategoria').value;
    var status = document.getElementById('prodStatus').value;
    if (busca) params.set('busca', busca);
    if (cat) params.set('categoria_id', cat);
    if (status) params.set('status', status);
    document.getElementById('prodCarregando').style.display = 'block';
    return api('GET', '/api/admin/produtos?' + params.toString()).then(function (r) {
      produtosCache = r.itens;
      renderProdutos(r.itens);
    }).catch(function (err) { toast(err.message, 'erro'); });
  }

  function renderProdutos(itens) {
    document.getElementById('prodCarregando').style.display = 'none';
    document.getElementById('prodVazio').style.display = itens.length ? 'none' : 'block';
    var tbody = document.getElementById('prodTbody');
    var cards = document.getElementById('prodCards');

    tbody.innerHTML = itens.map(function (p) {
      return '<tr>'
        + '<td class="col-img">' + thumbHtml(p) + '</td>'
        + '<td>' + esc(p.nome) + '</td>'
        + '<td>' + esc(p.categoria || '—') + '</td>'
        + '<td>' + statusBadge(p) + '</td>'
        + '<td>' + precoBR(p.preco) + '</td>'
        + '<td><div class="acoes">'
        + '<button class="btn btn-ghost btn-sm" data-editar="' + p.id + '">Editar</button>'
        + '<button class="btn btn-danger btn-sm" data-excluir="' + p.id + '">Excluir</button>'
        + '</div></td></tr>';
    }).join('');

    cards.innerHTML = itens.map(function (p) {
      return '<div class="prod-card">'
        + thumbHtml(p)
        + '<div class="info"><div class="nome">' + esc(p.nome) + '</div>'
        + '<div class="meta">'
        + statusBadge(p)
        + '<span>' + esc(p.categoria || 'sem categoria') + '</span>'
        + '<span>' + precoBR(p.preco) + '</span>'
        + '</div></div>'
        + '<div class="acoes">'
        + '<button class="btn btn-ghost btn-sm" data-editar="' + p.id + '">Editar</button>'
        + '<button class="btn btn-danger btn-sm" data-excluir="' + p.id + '">Excluir</button>'
        + '</div></div>';
    }).join('');
  }

  // Filtros
  document.getElementById('prodBusca').addEventListener('input', function () {
    clearTimeout(buscaTimer); buscaTimer = setTimeout(carregarProdutos, 300);
  });
  document.getElementById('prodCategoria').addEventListener('change', carregarProdutos);
  document.getElementById('prodStatus').addEventListener('change', carregarProdutos);

  // Preview de imagem no formulário
  function setPreview(url) {
    var prev = document.getElementById('pPreview');
    var rem = document.getElementById('pRemoverImg');
    if (url) {
      prev.innerHTML = '<img src="' + esc(url) + '" alt="">';
      rem.style.display = '';
    } else {
      prev.textContent = document.getElementById('pEmoji').value || '🌿';
      rem.style.display = 'none';
    }
  }

  document.getElementById('pImagem').addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    var fd = new FormData();
    fd.append('imagem', file);
    document.getElementById('pPreview').textContent = '…';
    fetch('/api/admin/upload-imagem', { method: 'POST', credentials: 'include', body: fd })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.erro || 'Falha no upload');
        document.getElementById('pImagemUrl').value = res.j.url;
        setPreview(res.j.url);
      })
      .catch(function (err) { toast(err.message, 'erro'); setPreview(document.getElementById('pImagemUrl').value); });
  });
  document.getElementById('pRemoverImg').addEventListener('click', function () {
    document.getElementById('pImagemUrl').value = '';
    document.getElementById('pImagem').value = '';
    setPreview('');
  });
  document.getElementById('pEmoji').addEventListener('input', function () {
    if (!document.getElementById('pImagemUrl').value) setPreview('');
  });

  function abrirProduto(p) {
    document.getElementById('formProduto').reset();
    document.getElementById('pId').value = p ? p.id : '';
    document.getElementById('pNome').value = p ? p.nome : '';
    document.getElementById('pCategoria').value = p && p.categoria_id ? p.categoria_id : '';
    document.getElementById('pEmoji').value = p && p.emoji ? p.emoji : '';
    document.getElementById('pDescricao').value = p && p.descricao ? p.descricao : '';
    document.getElementById('pImagemUrl').value = p && p.imagem_url ? p.imagem_url : '';
    document.getElementById('pImagem').value = '';
    document.getElementById('pPreco').value = p && p.preco != null ? String(p.preco).replace('.', ',') : '';
    document.getElementById('pOrdem').value = p ? p.ordem : 0;
    document.getElementById('pGramaMin').value = p && p.grama_min != null ? p.grama_min : '';
    document.getElementById('pGramaStep').value = p && p.grama_step != null ? p.grama_step : '';
    document.getElementById('pGramaMax').value = p && p.grama_max != null ? p.grama_max : '';
    document.getElementById('pAtivo').checked = p ? !!p.ativo : true;
    document.getElementById('pDisponivel').checked = p ? !!p.disponivel : true;
    document.getElementById('pDestaque').checked = p ? !!p.destaque : false;
    renderBadgePicker(p ? p.badges : []);
    setPreview(document.getElementById('pImagemUrl').value);
    document.getElementById('modalProdutoTitulo').textContent = p ? 'Editar produto' : 'Novo produto';
    abrir('modalProduto');
  }

  document.getElementById('btnNovoProduto').addEventListener('click', function () { abrirProduto(null); });

  document.getElementById('formProduto').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('pId').value;
    var badgeIds = Array.prototype.slice
      .call(document.querySelectorAll('#pBadges input[type="checkbox"]:checked'))
      .map(function (cb) { return parseInt(cb.value, 10); });
    var payload = {
      nome: document.getElementById('pNome').value.trim(),
      categoria_id: document.getElementById('pCategoria').value || null,
      emoji: document.getElementById('pEmoji').value.trim(),
      descricao: document.getElementById('pDescricao').value.trim(),
      imagem_url: document.getElementById('pImagemUrl').value || null,
      preco: document.getElementById('pPreco').value.trim(),
      ordem: document.getElementById('pOrdem').value || 0,
      grama_min: document.getElementById('pGramaMin').value,
      grama_step: document.getElementById('pGramaStep').value,
      grama_max: document.getElementById('pGramaMax').value,
      ativo: document.getElementById('pAtivo').checked,
      disponivel: document.getElementById('pDisponivel').checked,
      destaque: document.getElementById('pDestaque').checked,
      badge_ids: badgeIds,
    };
    var btn = document.getElementById('btnSalvarProduto');
    btn.disabled = true;
    var req = id ? api('PUT', '/api/admin/produtos/' + id, payload) : api('POST', '/api/admin/produtos', payload);
    req.then(function () {
      fechar('modalProduto');
      toast('Produto salvo 🌿');
      return Promise.all([carregarProdutos(), carregarCategorias(), carregarBadges()]);
    }).catch(function (err) { toast(err.message, 'erro'); })
      .finally(function () { btn.disabled = false; });
  });

  // Delegação (editar/excluir produto)
  document.getElementById('painel-produtos').addEventListener('click', function (e) {
    var ed = e.target.closest('[data-editar]');
    var ex = e.target.closest('[data-excluir]');
    if (ed) {
      var p = produtosCache.find(function (x) { return String(x.id) === ed.dataset.editar; });
      abrirProduto(p);
    } else if (ex) {
      var p2 = produtosCache.find(function (x) { return String(x.id) === ex.dataset.excluir; });
      if (confirm('Excluir o produto "' + (p2 ? p2.nome : '') + '"? Essa ação não pode ser desfeita.')) {
        api('DELETE', '/api/admin/produtos/' + ex.dataset.excluir)
          .then(function () { toast('Produto excluído'); return Promise.all([carregarProdutos(), carregarCategorias()]); })
          .catch(function (err) { toast(err.message, 'erro'); });
      }
    }
  });

  // ───────── Badges ─────────
  function carregarBadges() {
    return api('GET', '/api/admin/badges').then(function (badges) {
      badgesCache = badges;
      renderBadges(badges);
    });
  }

  function renderBadges(badges) {
    document.getElementById('badgeCarregando').style.display = 'none';
    document.getElementById('badgeVazio').style.display = badges.length ? 'none' : 'block';
    var tbody = document.getElementById('badgeTbody');
    var cards = document.getElementById('badgeCards');

    tbody.innerHTML = badges.map(function (b) {
      return '<tr>'
        + '<td><span class="badge-chip">' + esc(b.nome) + '</span></td>'
        + '<td>' + b.total + ' produto(s)</td>'
        + '<td>' + b.ordem + '</td>'
        + '<td><div class="acoes">'
        + '<button class="btn btn-ghost btn-sm" data-editar-badge="' + b.id + '">Editar</button>'
        + '<button class="btn btn-danger btn-sm" data-excluir-badge="' + b.id + '">Excluir</button>'
        + '</div></td></tr>';
    }).join('');

    cards.innerHTML = badges.map(function (b) {
      return '<div class="prod-card">'
        + '<div class="info"><div class="nome"><span class="badge-chip">' + esc(b.nome) + '</span></div>'
        + '<div class="meta"><span>' + b.total + ' produto(s)</span><span>ordem ' + b.ordem + '</span></div></div>'
        + '<div class="acoes">'
        + '<button class="btn btn-ghost btn-sm" data-editar-badge="' + b.id + '">Editar</button>'
        + '<button class="btn btn-danger btn-sm" data-excluir-badge="' + b.id + '">Excluir</button>'
        + '</div></div>';
    }).join('');
  }

  function abrirBadge(badge) {
    document.getElementById('formBadge').reset();
    document.getElementById('bId').value = badge ? badge.id : '';
    document.getElementById('bNome').value = badge ? badge.nome : '';
    document.getElementById('bOrdem').value = badge ? badge.ordem : 0;
    document.getElementById('modalBadgeTitulo').textContent = badge ? 'Editar badge' : 'Nova badge';
    abrir('modalBadge');
  }

  document.getElementById('btnNovaBadge').addEventListener('click', function () { abrirBadge(null); });

  document.getElementById('formBadge').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('bId').value;
    var payload = {
      nome: document.getElementById('bNome').value.trim(),
      ordem: document.getElementById('bOrdem').value,
    };
    var btn = document.getElementById('btnSalvarBadge');
    btn.disabled = true;
    var req = id ? api('PUT', '/api/admin/badges/' + id, payload) : api('POST', '/api/admin/badges', payload);
    req.then(function () {
      fechar('modalBadge');
      toast('Badge salva 🌿');
      return carregarBadges();
    }).catch(function (err) { toast(err.message, 'erro'); })
      .finally(function () { btn.disabled = false; });
  });

  document.getElementById('painel-badges').addEventListener('click', function (e) {
    var ed = e.target.closest('[data-editar-badge]');
    var ex = e.target.closest('[data-excluir-badge]');
    if (ed) {
      var b = badgesCache.find(function (x) { return String(x.id) === ed.dataset.editarBadge; });
      abrirBadge(b);
    } else if (ex) {
      var b2 = badgesCache.find(function (x) { return String(x.id) === ex.dataset.excluirBadge; });
      if (confirm('Excluir a badge "' + (b2 ? b2.nome : '') + '"? Ela será removida de todos os produtos.')) {
        api('DELETE', '/api/admin/badges/' + ex.dataset.excluirBadge)
          .then(function () { toast('Badge excluída'); return Promise.all([carregarBadges(), carregarProdutos()]); })
          .catch(function (err) { toast(err.message, 'erro'); });
      }
    }
  });

  // Monta os checkboxes de badges no formulário de produto, marcando as selecionadas.
  function renderBadgePicker(selecionadas) {
    var wrap = document.getElementById('pBadges');
    var ids = (selecionadas || []).map(function (b) { return b.id; });
    if (!badgesCache.length) {
      wrap.innerHTML = '<span class="badge-picker-vazio">Nenhuma badge cadastrada. Crie na aba “Badges”.</span>';
      return;
    }
    wrap.innerHTML = badgesCache.map(function (b) {
      var marcada = ids.indexOf(b.id) > -1 ? ' checked' : '';
      return '<label class="badge-opt">'
        + '<input type="checkbox" value="' + b.id + '"' + marcada + '>'
        + '<span>' + esc(b.nome) + '</span></label>';
    }).join('');
  }

  // ───────── Início ─────────
  Promise.all([carregarCategorias(), carregarBadges()]).then(carregarProdutos);
})();
