(function(){
  // Config da loja injetada pelo servidor (window.NUTRA_CONFIG). Fallbacks só por segurança.
  var CFG=(window.NUTRA_CONFIG||{}), CART=(CFG.cart||{});
  var PHONE=CFG.whatsapp||'5527996600444', MIN=CART.minGrams||100, STEP=CART.stepGrams||50, MAXG=CART.maxGrams||5000, KEY='nutra_cart_v2', cart=[];
  function load(){ try{var s=localStorage.getItem(KEY);cart=s?JSON.parse(s):[];}catch(e){cart=[];} if(!Array.isArray(cart))cart=[]; }
  function save(){ try{localStorage.setItem(KEY,JSON.stringify(cart));}catch(e){} }
  function find(n){ for(var i=0;i<cart.length;i++) if(cart[i].n===n) return cart[i]; return null; }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function jsq(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

  // ── Preço ──
  // it.u: '100g' | 'kg' => granel, it.g em gramas; 'un' => peça, it.g é a quantidade.
  function moedaBR(v){ return 'R$ '+Number(v).toFixed(2).replace('.',','); }
  function ehUnidade(it){ return it.u==='un'; }
  function passo(it){ return ehUnidade(it)?1:STEP; }
  function minimo(it){ return ehUnidade(it)?1:MIN; }
  function maximo(it){ return ehUnidade(it)?99:MAXG; }
  function quantidadeTxt(it){ return ehUnidade(it)?(it.g+(it.g>1?' un':' un')):(it.g+'g'); }
  function subtotal(it){
    if(it.p==null||!(it.p>0)) return null;
    if(ehUnidade(it)) return it.p*it.g;
    if(it.u==='kg')   return it.p*it.g/1000;
    return it.p*it.g/100;              // '100g' (padrão)
  }
  function totalPedido(){
    var t=0, faltando=false;
    cart.forEach(function(it){ var v=subtotal(it); if(v==null) faltando=true; else t+=v; });
    return {valor:t, faltando:faltando};
  }

  function add(name,cat,preco,un){
    name=(name||'').trim(); if(!name) return;
    un = (un==='un'||un==='kg'||un==='100g') ? un : '100g';
    var pr = (preco==null||preco==='') ? null : Number(preco);
    if(!(pr>0)) pr=null;
    var it=find(name);
    if(it){
      // mantém o preço/unidade mais recente vindos do catálogo
      if(pr!=null) it.p=pr;
      it.u=un;
      it.g=Math.min(it.g+passo(it),maximo(it));
    } else {
      it=null;
      var novo={n:name,c:cat||'',g:0,p:pr,u:un};
      novo.g=minimo(novo);
      cart.push(novo);
    }
    save(); renderCart();
    toast(it?('+'+(un==='un'?'1 un':passo({u:un})+'g')+' · '+name):(name+' adicionado ao pedido'));
  }
  function renderCart(){
    var body=document.getElementById('nutraBody'),badge=document.getElementById('nutraBadge'),fin=document.getElementById('nutraFinalize');
    if(!body) return;
    badge.textContent=cart.length; badge.classList.toggle('show',cart.length>0);
    fin.disabled=cart.length===0;
    if(!cart.length){ body.innerHTML='<div class="nutra-empty"><span>🛒</span>Seu carrinho está vazio.<br>Escolha seus produtos e monte seu pedido.</div>'; renderTotal(); return; }
    body.innerHTML=cart.map(function(it){
      return '<div class="nutra-item"><div class="nutra-item-info">'
        +(it.c?'<div class="nutra-item-cat">'+esc(it.c)+'</div>':'')
        +'<div class="nutra-item-name">'+esc(it.n)+'</div>'
        +'<div class="nutra-stepper">'
        +'<button class="nutra-step" '+(it.g<=minimo(it)?'disabled':'')+' aria-label="Diminuir" onclick="nutraChange(\''+jsq(it.n)+'\',-1)">&minus;</button>'
        +'<span class="nutra-grams">'+quantidadeTxt(it)+'</span>'
        +'<button class="nutra-step" aria-label="Aumentar" onclick="nutraChange(\''+jsq(it.n)+'\',1)">+</button>'
        +(subtotal(it)!=null?'<span class="nutra-sub">'+moedaBR(subtotal(it))+'</span>':'')
        +'</div></div>'
        +'<button class="nutra-remove" aria-label="Remover" onclick="nutraRemove(\''+jsq(it.n)+'\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>'
        +'</div>';
    }).join('');
    renderTotal();
  }
  function renderTotal(){
    var el=document.getElementById('nutraTotal');
    if(!el) return;
    if(!cart.length){ el.innerHTML=''; return; }
    var t=totalPedido();
    el.innerHTML='<span class="nutra-total-label">Total</span>'
      +'<span class="nutra-total-valor">'+moedaBR(t.valor)+'</span>'
      +(t.faltando?'<span class="nutra-total-obs">+ itens sem preço</span>':'');
  }
  var toastT;
  function toast(txt){
    var el=document.getElementById('nutraToast');
    if(!el){el=document.createElement('div');el.className='nutra-toast';el.id='nutraToast';document.body.appendChild(el);}
    el.textContent=txt; el.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(function(){el.classList.remove('show');},1800);
  }

  window.addToCart=add;
  window.nutraChange=function(n,d){var it=find(n);if(!it)return;it.g=Math.max(minimo(it),Math.min(it.g+d*passo(it),maximo(it)));save();renderCart();};
  window.nutraRemove=function(n){cart=cart.filter(function(x){return x.n!==n;});save();renderCart();};
  var cartTrap=null, cartAberto=false;
  window.nutraOpenCart=function(){
    var d=document.getElementById('nutraDrawer');
    d.classList.add('open');document.getElementById('nutraOverlay').classList.add('open');document.body.style.overflow='hidden';
    cartAberto=true;
    if(window.criarFocusTrap){ if(!cartTrap) cartTrap=window.criarFocusTrap(d); cartTrap.ativar(); }
  };
  window.nutraCloseCart=function(){
    if(!cartAberto) return; cartAberto=false;
    document.getElementById('nutraDrawer').classList.remove('open');document.getElementById('nutraOverlay').classList.remove('open');document.body.style.overflow='';
    if(cartTrap) cartTrap.desativar();
  };
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') window.nutraCloseCart(); });
  window.nutraFinalize=function(){
    if(!cart.length) return;
    var msg='Olá! Quero fazer um pedido na Nutra 🌿\n\n';
    cart.forEach(function(it){
      var v=subtotal(it);
      msg+='• '+it.n+' - '+quantidadeTxt(it)+(v!=null?' - '+moedaBR(v):'')+'\n';
    });
    var t=totalPedido();
    msg+='\nTotal de itens: '+cart.length;
    msg+='\nTotal: '+moedaBR(t.valor)+(t.faltando?' (+ itens sem preço)':'');
    window.open('https://wa.me/'+PHONE+'?text='+encodeURIComponent(msg.trim()),'_blank');
  };

  var ADD='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
  function badges(p){
    if(!p.badges||!p.badges.length) return '';
    return '<div class="pcat-badges">'+p.badges.map(function(b){
      return '<span class="pcat-badge">'+esc(b.nome)+'</span>';
    }).join('')+'</div>';
  }
  function sufixoUn(un){ return un==='un' ? ' cada' : (un==='kg' ? ' / kg' : ' / 100g'); }
  function precoCard(p){
    if(p.preco==null||!(p.preco>0)) return '';
    return '<span class="pcat-price">'+esc(moedaBR(p.preco))+'<small>'+esc(sufixoUn(p.un))+'</small></span>';
  }
  window.renderCard=function(p){
    var img = p.img
      ? '<img src="'+esc(p.img)+'" alt="'+esc(p.n)+'" loading="lazy" width="400" height="300">'
      : '<span class="pcat-img-emoji">'+esc(p.e)+'</span><span class="pcat-img-label">foto em breve</span>';
    var off = (p.disp === false);
    var botao = off
      ? '<button type="button" class="pcat-wa pcat-wa-off" disabled>Indisponível</button>'
      : '<button type="button" class="pcat-wa">'+ADD+' Adicionar</button>';
    var dados = (p.preco!=null&&p.preco>0) ? ' data-preco="'+esc(p.preco)+'" data-un="'+esc(p.un||'100g')+'"' : '';
    return '<div class="pcat-card'+(off?' pcat-off':'')+'"'+(off?' data-off="1"':'')+dados+'>'
      +'<div class="pcat-img">'+badges(p)+img+'</div>'
      +'<div class="pcat-body"><span class="pcat-tag">'+esc(p.c)+'</span><span class="pcat-name">'+esc(p.n)+'</span>'
      +precoCard(p)+botao+'</div></div>';
  };

  function wireCatalog(){
    var grid=document.getElementById('pcatGrid');
    if(!grid||grid.dataset.nutraWired) return; grid.dataset.nutraWired='1';
    grid.addEventListener('click',function(e){
      var card=e.target.closest('.pcat-card'); if(!card) return; e.preventDefault();
      if(card.dataset.off) return; // produto indisponível: não adiciona
      var nm=card.querySelector('.pcat-name'),cat=card.querySelector('.pcat-tag');
      if(nm) add(nm.textContent.trim(), cat?cat.textContent.trim():'', card.dataset.preco, card.dataset.un);
    });
  }
  function wireFeatured(){
    document.querySelectorAll('.pcard').forEach(function(card){
      if(card.dataset.nutraWired) return; card.dataset.nutraWired='1';
      var nm=card.querySelector('.pcard-name'),cta=card.querySelector('.pcard-cta');
      if(nm&&cta){ var name=nm.textContent.trim(), pr=card.dataset.preco, un=card.dataset.un;
        cta.removeAttribute('href'); cta.style.cursor='pointer';
        cta.innerHTML=ADD+' Adicionar ao carrinho';
        cta.addEventListener('click',function(ev){ev.preventDefault();add(name,'',pr,un);});
      }
    });
  }
  // Exposto para o catalogo.js re-vincular após carregar os produtos da API
  // (idempotente: o guard dataset.nutraWired evita listeners duplicados).
  window.wireCatalog = wireCatalog;
  window.wireFeatured = wireFeatured;
  function init(){
    var d=document.getElementById('nutraDrawer');
    if(d){ d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true'); d.setAttribute('aria-label','Carrinho de compras'); }
    load(); if(typeof render==='function'){try{render();}catch(e){}} wireCatalog(); wireFeatured(); renderCart();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
  window.addEventListener('load',function(){ if(typeof render==='function'){try{render();}catch(e){}} wireCatalog(); wireFeatured(); });
})();
