
(function(){
  function init(){
  var root=document.querySelector('[data-pt-buy]');if(!root)return;
  var variants=JSON.parse(root.dataset.variants);
  var opts=[];variants.forEach(function(v){if(opts.indexOf(v.opt)<0)opts.push(v.opt)});
  var state={bundle:1,styles:[opts[0],opts[0],opts[0]]};
  function vid(opt){var m=variants.filter(function(v){return v.opt===opt})[0];return m?m.id:variants[0].id}
  function swatchColor(o){var s=o.toLowerCase();
    if(s.indexOf('grey')>-1||s.indexOf('gray')>-1)return '#AEB4C0';
    if(s.indexOf('navy')>-1||s.indexOf('blue')>-1)return '#1F2C4E';
    if(s.indexOf('black')>-1||s.indexOf('jet')>-1)return '#121318';
    if(s.indexOf('pink')>-1)return '#E7A6C7';
    return '#5B3FE0'}
  function renderStyles(){
    root.querySelectorAll('[data-pt-styles]').forEach(function(box){
      var b=+box.dataset.ptStyles;if(b!==state.bundle){box.innerHTML='';return}
      var html='';
      for(var r=0;r<b;r++){
        html+='<span class="pt-buy__stylelabel">'+(b>1?'Color · pillow '+(r+1):'Color')+'</span><div class="pt-buy__swatches">';
        opts.forEach(function(o){
          html+='<button type="button" class="pt-buy__sw'+(state.styles[r]===o?' is-active':'')+'" style="background:'+swatchColor(o)+'" title="'+o.replace(/"/g,'&quot;')+'" aria-label="'+o.replace(/"/g,'&quot;')+'" data-r="'+r+'" data-o="'+o.replace(/"/g,'&quot;')+'"></button>'});
        html+='</div>';
      }
      box.innerHTML=html;
      box.querySelectorAll('.pt-buy__sw').forEach(function(btn){btn.addEventListener('click',function(){state.styles[+btn.dataset.r]=btn.dataset.o;renderStyles();if(+btn.dataset.r===0)showColor(btn.dataset.o)})});
    });
  }
  root.querySelectorAll('[data-pt-bundle]').forEach(function(card){
    card.querySelector('[data-pt-bundle-pick]').addEventListener('click',function(){
      state.bundle=+card.dataset.ptBundle;
      root.querySelectorAll('[data-pt-bundle]').forEach(function(c){
        var sel=+c.dataset.ptBundle===state.bundle;
        c.classList.toggle('is-selected',sel);c.querySelector('.pt-buy__inner').hidden=!sel;
      });
      var pe=root.querySelector('[data-pt-price]'),ce=root.querySelector('[data-pt-compare]'),se=root.querySelector('[data-pt-save]');
      if(pe)pe.textContent=card.dataset.price;if(ce)ce.textContent=card.dataset.compare;if(se)se.textContent='SAVE '+card.dataset.save;
      renderStyles();
    });
  });
  renderStyles();
  function showColor(opt){
    if(!track)return;
    var slides=root.querySelectorAll('.pt-buy__slide');
    var key=opt.toLowerCase().split(' ').pop();
    for(var i=0;i<slides.length;i++){
      var alt=(slides[i].dataset.alt||'').toLowerCase();
      if(alt.indexOf(key)>-1){track.scrollTo({left:track.clientWidth*i,behavior:'smooth'});return}
    }
    track.scrollTo({left:0,behavior:'smooth'});
  }
  var track=root.querySelector('[data-pt-track]');
  var thumbs=root.querySelectorAll('[data-pt-thumb]');
  var slideCount=root.querySelectorAll('.pt-buy__slide').length;
  var realCount=slideCount-1; // last slide is a clone of the first
  function goTo(i,smooth){track.scrollTo({left:track.clientWidth*i,behavior:smooth===false?'auto':'smooth'})}
  thumbs.forEach(function(t){t.addEventListener('click',function(){goTo(+t.dataset.ptThumb)})});
  var scrollTimer=null;
  if(track)track.addEventListener('scroll',function(){
    var i=Math.round(track.scrollLeft/track.clientWidth);
    var vis=i>=realCount?0:i;
    thumbs.forEach(function(t,j){t.classList.toggle('is-active',j===vis)});
    if(thumbs[vis]&&tt)thumbs[vis].scrollIntoView({block:'nearest',inline:'nearest'});
    if(scrollTimer)clearTimeout(scrollTimer);
    scrollTimer=setTimeout(function(){
      var idx=Math.round(track.scrollLeft/track.clientWidth);
      if(idx>=realCount)goTo(0,false);
    },140);
  },{passive:true});
  var tt=root.querySelector('[data-pt-thumbtrack]');
  var tprev=root.querySelector('[data-pt-tprev]'),tnext=root.querySelector('[data-pt-tnext]');
  if(tnext)tnext.addEventListener('click',function(){tt.scrollBy({left:tt.clientWidth,behavior:'smooth'})});
  if(tprev)tprev.addEventListener('click',function(){tt.scrollBy({left:-tt.clientWidth,behavior:'smooth'})});
  var prev=root.querySelector('[data-pt-prev]'),next=root.querySelector('[data-pt-next]');
  function cur(){return Math.round(track.scrollLeft/track.clientWidth)}
  if(next)next.addEventListener('click',function(){var i=cur();if(i>=realCount-1){goTo(realCount);setTimeout(function(){goTo(0,false)},420)}else goTo(i+1)});
  if(prev)prev.addEventListener('click',function(){var i=cur();if(i<=0){goTo(realCount,false);goTo(realCount-1)}else goTo(i-1)});
  var day=864e5,now=new Date();
  function fmt(d){return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
  var d0=root.querySelector('[data-pt-d0]'),d1=root.querySelector('[data-pt-d1]'),d2=root.querySelector('[data-pt-d2]');
  if(d0)d0.textContent=fmt(now);if(d1)d1.textContent=fmt(new Date(+now+2*day));
  if(d2)d2.textContent=fmt(new Date(+now+6*day))+' – '+fmt(new Date(+now+10*day));
  var pct=76+Math.floor(Date.now()/day)%9;
  var fill=root.querySelector('[data-pt-stockfill]');if(fill)fill.style.width=pct+'%';
  var left=root.querySelector('[data-pt-stockleft]');if(left)left.textContent=(214-(Math.floor(Date.now()/day)%9)*11)+' left';
  root.querySelector('[data-pt-atc]').addEventListener('click',function(){
    var btn=this;btn.textContent='Adding…';
    var items=[],counts={};
    for(var u=0;u<state.bundle;u++){var o=state.styles[u];counts[o]=(counts[o]||0)+1}
    Object.keys(counts).forEach(function(o){items.push({id:vid(o),quantity:counts[o]})});
    var inner=root.querySelector('.pt-buy__bundle.is-selected');
    inner.querySelectorAll('[data-pt-addon]').forEach(function(cb){if(cb.checked)items.push({id:+cb.dataset.ptAddon,quantity:1})});
    fetch('/cart/add.js',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:items})})
      .then(function(r){return r.json()})
      .then(function(){btn.textContent='Add to cart';openCart()})
      .catch(function(){btn.textContent='Add to cart';alert('Could not add to cart.')});
  });
  // ---- cart drawer ----
  var cartEl=document.querySelector('[data-pt-cart]');
  function money(c){return '$'+(c/100).toFixed(2)}
  function renderCart(cart){
    var box=cartEl.querySelector('[data-pt-cart-items]');
    var cnt=cartEl.querySelector('[data-pt-cart-count]');
    cnt.textContent='('+cart.item_count+')';
    cartEl.querySelector('[data-pt-cart-subtotal]').textContent=money(cart.items_subtotal_price);
    if(!cart.items.length){box.innerHTML='<div class="pt-cart__empty">Your cart is empty</div>'}
    else{
      box.innerHTML=cart.items.map(function(it,i){
        var v=(it.variant_title&&it.variant_title!=='Default Title')?it.variant_title:'';
        return '<div class="pt-cart__item">'
          +'<img class="pt-cart__itimg" src="'+(it.image?it.image.replace(/(\.[a-z]+)(\?|$)/,'_180x$1$2'):'')+'" alt="">'
          +'<span class="pt-cart__itmid"><b>'+it.product_title+'</b>'+(v?'<em>'+v+'</em>':'')
          +'<span class="pt-cart__qty"><button type="button" data-pt-q="'+(i+1)+'" data-d="-1">&minus;</button><span>'+it.quantity+'</span><button type="button" data-pt-q="'+(i+1)+'" data-d="1">+</button></span></span>'
          +'<span class="pt-cart__itright"><b>'+money(it.final_line_price)+'</b><button type="button" class="pt-cart__remove" data-pt-q="'+(i+1)+'" data-d="0">Remove</button></span>'
          +'</div>';
      }).join('');
      box.querySelectorAll('[data-pt-q]').forEach(function(b){b.addEventListener('click',function(){
        var line=+b.dataset.ptQ,d=+b.dataset.d;
        var it=cart.items[line-1];
        var q=d===0?0:it.quantity+d;if(q<0)q=0;
        fetch('/cart/change.js',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({line:line,quantity:q})})
          .then(function(r){return r.json()}).then(renderCart);
      })});
    }
    var ups=cartEl.querySelector('[data-pt-cart-upsell]');
    var uid=cartEl.dataset.upsellId;
    if(ups&&uid){
      var has=cart.items.some(function(it){return String(it.variant_id)===String(uid)});
      ups.hidden=has||!cart.items.length;
      if(!ups.dataset.ready){
        ups.dataset.ready='1';
        cartEl.querySelector('[data-pt-up-img]').src=cartEl.dataset.upsellImg;
        cartEl.querySelector('[data-pt-up-title]').textContent=cartEl.dataset.upsellTitle;
        cartEl.querySelector('[data-pt-up-price]').textContent=cartEl.dataset.upsellPrice;
        cartEl.querySelector('[data-pt-up-add]').addEventListener('click',function(){
          fetch('/cart/add.js',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[{id:+uid,quantity:1}]})})
            .then(function(){return fetch('/cart.js')}).then(function(r){return r.json()}).then(renderCart);
        });
      }
    }
  }
  function openCart(){
    fetch('/cart.js').then(function(r){return r.json()}).then(function(c){renderCart(c);cartEl.hidden=false;document.body.style.overflow='hidden'});
  }
  if(cartEl)cartEl.querySelectorAll('[data-pt-cart-close]').forEach(function(x){x.addEventListener('click',function(){cartEl.hidden=true;document.body.style.overflow=''})});
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init)}else{init()}
})();
