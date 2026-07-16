(function(){
  var PHONE='5527996600444', MIN=100, STEP=50, MAXG=5000, KEY='nutra_cart_v1', cart=[];
  function load(){ try{var s=localStorage.getItem(KEY);cart=s?JSON.parse(s):[];}catch(e){cart=[];} if(!Array.isArray(cart))cart=[]; }
  function save(){ try{localStorage.setItem(KEY,JSON.stringify(cart));}catch(e){} }
  function find(n){ for(var i=0;i<cart.length;i++) if(cart[i].n===n) return cart[i]; return null; }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function jsq(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

  function add(name,cat){
    name=(name||'').trim(); if(!name) return;
    var it=find(name);
    if(it) it.g=Math.min(it.g+STEP,MAXG);
    else cart.push({n:name,c:cat||'',g:MIN});
    save(); renderCart(); toast(it?('+'+STEP+'g · '+name):(name+' adicionado ao pedido'));
  }
  function renderCart(){
    var body=document.getElementById('nutraBody'),badge=document.getElementById('nutraBadge'),fin=document.getElementById('nutraFinalize');
    if(!body) return;
    badge.textContent=cart.length; badge.classList.toggle('show',cart.length>0);
    fin.disabled=cart.length===0;
    if(!cart.length){ body.innerHTML='<div class="nutra-empty"><span>🛒</span>Seu carrinho está vazio.<br>Escolha seus produtos e monte seu pedido.</div>'; return; }
    body.innerHTML=cart.map(function(it){
      return '<div class="nutra-item"><div class="nutra-item-info">'
        +(it.c?'<div class="nutra-item-cat">'+esc(it.c)+'</div>':'')
        +'<div class="nutra-item-name">'+esc(it.n)+'</div>'
        +'<div class="nutra-stepper">'
        +'<button class="nutra-step" '+(it.g<=MIN?'disabled':'')+' aria-label="Diminuir" onclick="nutraChange(\''+jsq(it.n)+'\',-1)">&minus;</button>'
        +'<span class="nutra-grams">'+it.g+'g</span>'
        +'<button class="nutra-step" aria-label="Aumentar" onclick="nutraChange(\''+jsq(it.n)+'\',1)">+</button>'
        +'</div></div>'
        +'<button class="nutra-remove" aria-label="Remover" onclick="nutraRemove(\''+jsq(it.n)+'\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>'
        +'</div>';
    }).join('');
  }
  var toastT;
  function toast(txt){
    var el=document.getElementById('nutraToast');
    if(!el){el=document.createElement('div');el.className='nutra-toast';el.id='nutraToast';document.body.appendChild(el);}
    el.textContent=txt; el.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(function(){el.classList.remove('show');},1800);
  }

  window.addToCart=add;
  window.nutraChange=function(n,d){var it=find(n);if(!it)return;it.g=Math.max(MIN,Math.min(it.g+d*STEP,MAXG));save();renderCart();};
  window.nutraRemove=function(n){cart=cart.filter(function(x){return x.n!==n;});save();renderCart();};
  window.nutraOpenCart=function(){document.getElementById('nutraDrawer').classList.add('open');document.getElementById('nutraOverlay').classList.add('open');document.body.style.overflow='hidden';};
  window.nutraCloseCart=function(){document.getElementById('nutraDrawer').classList.remove('open');document.getElementById('nutraOverlay').classList.remove('open');document.body.style.overflow='';};
  window.nutraFinalize=function(){
    if(!cart.length) return;
    var msg='Olá! Quero fazer um pedido na Nutra 🌿\n\n';
    cart.forEach(function(it){msg+='• '+it.n+' - '+it.g+'g\n';});
    msg+='\nTotal de itens: '+cart.length;
    window.open('https://wa.me/'+PHONE+'?text='+encodeURIComponent(msg.trim()),'_blank');
  };

  var ADD='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
  function badges(p){
    if(!p.badges||!p.badges.length) return '';
    return '<div class="pcat-badges">'+p.badges.map(function(b){
      return '<span class="pcat-badge">'+esc(b.nome)+'</span>';
    }).join('')+'</div>';
  }
  window.renderCard=function(p){
    var img = p.img
      ? '<img src="'+esc(p.img)+'" alt="'+esc(p.n)+'" loading="lazy" width="400" height="300">'
      : '<span class="pcat-img-emoji">'+esc(p.e)+'</span><span class="pcat-img-label">foto em breve</span>';
    var off = (p.disp === false);
    var botao = off
      ? '<button type="button" class="pcat-wa pcat-wa-off" disabled>Indisponível</button>'
      : '<button type="button" class="pcat-wa">'+ADD+' Adicionar</button>';
    return '<div class="pcat-card'+(off?' pcat-off':'')+'"'+(off?' data-off="1"':'')+'>'
      +'<div class="pcat-img">'+badges(p)+img+'</div>'
      +'<div class="pcat-body"><span class="pcat-tag">'+esc(p.c)+'</span><span class="pcat-name">'+esc(p.n)+'</span>'
      +botao+'</div></div>';
  };

  function wireCatalog(){
    var grid=document.getElementById('pcatGrid');
    if(!grid||grid.dataset.nutraWired) return; grid.dataset.nutraWired='1';
    grid.addEventListener('click',function(e){
      var card=e.target.closest('.pcat-card'); if(!card) return; e.preventDefault();
      if(card.dataset.off) return; // produto indisponível: não adiciona
      var nm=card.querySelector('.pcat-name'),cat=card.querySelector('.pcat-tag');
      if(nm) add(nm.textContent.trim(), cat?cat.textContent.trim():'');
    });
  }
  function wireFeatured(){
    document.querySelectorAll('.pcard').forEach(function(card){
      if(card.dataset.nutraWired) return; card.dataset.nutraWired='1';
      var nm=card.querySelector('.pcard-name'),cta=card.querySelector('.pcard-cta');
      if(nm&&cta){ var name=nm.textContent.trim(); cta.removeAttribute('href'); cta.style.cursor='pointer';
        cta.innerHTML=ADD+' Adicionar ao carrinho';
        cta.addEventListener('click',function(ev){ev.preventDefault();add(name);});
      }
    });
  }
  // Exposto para o catalogo.js re-vincular após carregar os produtos da API
  // (idempotente: o guard dataset.nutraWired evita listeners duplicados).
  window.wireCatalog = wireCatalog;
  window.wireFeatured = wireFeatured;
  function init(){ load(); if(typeof render==='function'){try{render();}catch(e){}} wireCatalog(); wireFeatured(); renderCart(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
  window.addEventListener('load',function(){ if(typeof render==='function'){try{render();}catch(e){}} wireCatalog(); wireFeatured(); });
})();
