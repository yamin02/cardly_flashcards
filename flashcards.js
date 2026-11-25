/* Anki templates are rendered inside a script-free sandbox. */
(() => {
const $ = s => document.querySelector(s);
const app = $('#app');
let deck, cards = [], position = 0, revealed = false, urls = [], busy = false;
let storageKey, ratings = {}, order = [], filter = 'all', storageWarning = false;
let flipping = false;
const ratingNames = {hard:'Hard', good:'Good', easy:'Easy'};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const base = new URL('.', location.href).href;
const studyCSS = `body{margin:0;padding:24px;color:#20231f;font:21px/1.55 system-ui;text-align:center;overflow-wrap:anywhere}img{max-width:100%;height:auto} .cloze{color:#375c4b;font-weight:750;background:#e5f2ca} .extra{margin-top:24px;font-size:17px} #io-wrapper{position:relative;width:100%;max-width:850px;margin:auto}#io-overlay{position:absolute;top:0;left:0;width:100%;z-index:2}#io-original{position:relative;width:100%}#io-wrapper img{display:block;width:100%;height:auto}#io-footer{margin-top:20px;font-size:17px}hr{border:0;border-top:1px solid #ddd}`;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 4000); }
function template(text, fields, card, answer) {
  let previous;
  do { previous = text; text = text.replace(/{{([#^])([^{}]+)}}([\s\S]*?){{\/\2}}/g, (_, kind, name, body) => (Boolean(fields[name]?.trim()) === (kind === '#')) ? body : ''); } while (text !== previous);
  return text.replace(/{{([^{}]+)}}/g, (_, token) => {
    if (token === 'FrontSide') return fields.FrontSide || '';
    const parts = token.split(':'), name = parts.pop();
    let value = fields[name] || '';
    if (parts.includes('cloze')) value = value.replace(/{{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?}}/g, (_, number, content, hint) => Number(number) === card.ord + 1 ? `<span class="cloze">${answer ? content : '[' + (hint || '…') + ']'}</span>` : content);
    if (parts.includes('text')) value = value.replace(/<[^>]*>/g, '');
    return value;
  });
}
function side(card, answer) {
  const note = deck.notes.find(n => n.id === card.nid), model = deck.models[note.mid];
  const fields = Object.fromEntries(model.flds.map((f, i) => [f.name, note.flds.split('\x1f')[i] || '']));
  fields.Tags = esc(note.tags); fields.Deck = esc(deck.decks[card.did]?.name || 'Imported deck');
  const format = model.tmpls[model.type === 1 ? 0 : card.ord] || model.tmpls[0];
  fields.FrontSide = template(format.qfmt, fields, card, false);
  const document = new DOMParser().parseFromString(template(answer ? format.afmt : format.qfmt, fields, card, answer), 'text/html');
  document.querySelectorAll('script,iframe,object,embed,link,meta,base,style,form').forEach(e => e.remove());
  document.querySelectorAll('*').forEach(e => {
    for (const a of [...e.attributes]) if (/^on/i.test(a.name) || ['srcdoc','href','action','style'].includes(a.name)) e.removeAttribute(a.name);
    if (e.hasAttribute('src')) {
      const original = e.getAttribute('src');
      const path = deck.media[original] || deck.media[decodeSafe(original)];
      if (path) e.setAttribute('src', path.startsWith('blob:') ? path : new URL(path, base).href);
      else { e.removeAttribute('src'); e.setAttribute('alt', 'Image not included: ' + original); }
    }
    e.removeAttribute('srcset');
  });
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><style>${studyCSS}</style></head><body>${document.body.innerHTML.replace(/\[sound:([^\]]+)\]/g, (_, name) => deck.media[name] ? `<audio controls src="${esc(deck.media[name].startsWith('blob:') ? deck.media[name] : new URL(deck.media[name], base).href)}"></audio>` : '')}</body></html>`;
}
function decodeSafe(value) { try { return decodeURIComponent(value); } catch { return value; } }
function saveProgress() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ratings, order, filter, cardId:cards[position]?.id, revealed}));
  } catch {
    if (!storageWarning) { storageWarning=true; toast('Browser storage is unavailable. Progress will only last for this session.'); }
  }
}
function selectCards(preferredId) {
  const byId = new Map(deck.cards.map(card => [card.id, card]));
  cards = order.map(id => byId.get(id)).filter(card => card && (filter==='all' || ratings[card.id]===filter));
  const found=cards.findIndex(card=>card.id===preferredId);
  position=found>=0 ? found : Math.max(0, Math.min(position,cards.length-1));
}
function render() {
  const card = cards[position];
  const count = type => deck.cards.filter(c=>ratings[c.id]===type).length;
  const reviewed = deck.cards.filter(c=>ratingNames[ratings[c.id]]).length;
  app.innerHTML = `<div class="study-head"><div class="study-title"><div class="deck-name">${esc(deck.decks[card?.did || deck.cards[0].did]?.name || 'Imported deck')}</div><div class="deck-meta">${reviewed} / ${deck.cards.length} rated · Progress saved on this device</div></div><div class="actions"><button class="quiet-btn" id="shuffleBtn" ${cards.length ? '' : 'disabled'}>⤨ Shuffle</button><button class="quiet-btn" id="resetBtn">↺ Restart</button></div><div class="study-filters" role="group" aria-label="Study cards by rating">${['all','hard','good','easy'].map(type=>`<button class="filter-btn ${type}" data-filter="${type}" aria-pressed="${filter===type}">${type==='all'?'All':ratingNames[type]} <span>${type==='all'?deck.cards.length:count(type)}</span></button>`).join('')}</div></div><div class="progress-wrap" title="${reviewed} of ${deck.cards.length} cards rated"><div class="progress" style="width:${reviewed/deck.cards.length*100}%"></div></div>${card ? `<div class="controls"><button class="arrow" id="prev" aria-label="Previous card" ${position===0?'disabled':''}>←</button><button class="primary" id="reveal">${revealed?'Show question':'Reveal answer'}</button><span class="counter">${position+1} / ${cards.length}</span><button class="arrow" id="next" aria-label="Next card" ${position===cards.length-1?'disabled':''}>→</button><div class="rating-controls" role="group" aria-label="Rate current card">${Object.entries(ratingNames).map(([type,label])=>`<button class="rating-btn ${type}" data-rating="${type}" aria-pressed="${ratings[card.id]===type}" title="Rate this card ${label.toLowerCase()}">${label}</button>`).join('')}</div></div><div class="anki-card"><div class="face-label">${revealed?'Answer':'Question'}${ratings[card.id]?' · '+ratingNames[ratings[card.id]]:''}</div><iframe id="content" title="${revealed?'Answer':'Question'} for card ${position+1}" sandbox="allow-same-origin"></iframe></div><div class="kbd-hint">← → navigate · Space reveal · Rate cards above, then choose a group to study</div>` : `<div class="anki-card empty-selection"><h2>No ${ratingNames[filter]?.toLowerCase() || ''} cards yet</h2><p>Choose All and rate a card to add it to this group.</p></div>`}`;
  app.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.filter;position=0;revealed=false;selectCards();render();});
  $('#resetBtn').onclick=()=>{position=0;revealed=false;render();};
  $('#shuffleBtn').onclick=()=>{
    for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    position=0;revealed=false;selectCards();render();
  };
  if(card) {
    $('#content').srcdoc=side(card,revealed);
    $('#content').onload=()=>{const doc=$('#content').contentDocument;if(doc)doc.addEventListener('keydown',keys);};
    $('#reveal').onclick=flipCard;
    $('#prev').onclick=()=>move(-1);$('#next').onclick=()=>move(1);
    app.querySelectorAll('[data-rating]').forEach(button=>button.onclick=()=>{
      ratings[card.id]=button.dataset.rating;
      selectCards(card.id);render();
    });
  }
  saveProgress();
}
function move(delta) {if(position+delta<0 || position+delta>=cards.length)return;position+=delta;revealed=false;render();}
async function flipCard() {
  const card = $('.anki-card');
  if (!cards.length || flipping || !card) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealed=!revealed;render();return;
  }
  flipping=true;
  const direction=revealed ? -1 : 1;
  const restoreFocus=document.activeElement===$('#reveal');
  try {
    await card.animate([
      {transform:'perspective(1200px) rotateX(0deg)'},
      {transform:`perspective(1200px) rotateX(${direction*90}deg)`}
    ],{duration:240,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'}).finished;
    // Navigating away during a flip must not reveal a different card.
    if (!card.isConnected) return;
    revealed=!revealed;render();
    const nextCard=$('.anki-card');
    const incoming=nextCard.animate([
      {transform:`perspective(1200px) rotateX(${-direction*90}deg)`},
      {transform:'perspective(1200px) rotateX(0deg)'}
    ],{duration:310,easing:'cubic-bezier(0,0,.2,1)'});
    if(restoreFocus)$('#reveal').focus({preventScroll:true});
    await incoming.finished;
  } finally {flipping=false;}
}
function keys(e) {
  if(!cards.length || ['INPUT','SELECT','BUTTON','TEXTAREA','AUDIO'].includes(e.target.tagName))return;
  if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}
  if(e.key==='ArrowRight'){e.preventDefault();move(1);}
  if(e.code==='Space'){e.preventDefault();flipCard();}
}
function activate(data) {
  deck=data;
  // Stable across re-imports: do not include temporary media URLs in the identity.
  let hash=2166136261;
  const identity=JSON.stringify([data.cards.map(c=>[c.id,c.nid,c.ord]),data.notes.map(n=>[n.id,n.flds])]);
  for(let i=0;i<identity.length;i++){hash^=identity.charCodeAt(i);hash=Math.imul(hash,16777619);}
  storageKey='cardly.study.v1.'+(hash>>>0).toString(16);
  let saved={};
  try {saved=JSON.parse(localStorage.getItem(storageKey)) || {};} catch { /* Start fresh if saved data is unavailable. */ }
  if(typeof saved!=='object' || Array.isArray(saved))saved={};
  ratings={};
  for(const card of data.cards)if(ratingNames[saved.ratings?.[card.id]])ratings[card.id]=saved.ratings[card.id];
  const valid=new Set(data.cards.map(c=>c.id));
  order=Array.isArray(saved.order)?[...new Set(saved.order.filter(id=>valid.has(id)))]:[];
  const restored=new Set(order);order.push(...data.cards.map(c=>c.id).filter(id=>!restored.has(id)));
  filter=['all','hard','good','easy'].includes(saved.filter)?saved.filter:'all';
  position=0;revealed=saved.revealed===true;selectCards(saved.cardId);render();
}
async function importDeck(file) {
  if (busy) return;
  busy=true; $('#uploadTop').disabled=true; $('#uploadTop').textContent='Reading deck…';
  const newUrls=[];
  try {
    const files=fflate.unzipSync(new Uint8Array(await file.arrayBuffer()));
    if (!files['collection.anki2'] && !files['collection.anki21']) throw Error('This deck uses a newer compressed Anki format. Export it from Anki with “Support older Anki versions” enabled.');
    const SQL=await initSqlJs(); const db=new SQL.Database(files['collection.anki21'] || files['collection.anki2']);
    const query=sql => { const r=db.exec(sql)[0]; return r ? r.values.map(row=>Object.fromEntries(r.columns.map((key,i)=>[key,typeof row[i]==='number' && ['id','mid','nid','did'].includes(key) ? String(row[i]) : row[i]]))) : []; };
    let data;
    try { const col=query('SELECT models,decks FROM col')[0]; data={models:JSON.parse(col.models),decks:JSON.parse(col.decks),notes:query('SELECT id,mid,flds,tags FROM notes'),cards:query('SELECT id,nid,did,ord FROM cards ORDER BY id'),media:{}}; } finally {db.close();}
    if (!data.cards.length) throw Error('This deck has no cards.');
    if (!Object.keys(data.models).length) throw Error('Please export this deck with “Support older Anki versions” enabled.');
    const media=files.media ? JSON.parse(fflate.strFromU8(files.media)) : {};
    for(const [key,name] of Object.entries(media)) if(files[key]) { const ext=name.split('.').pop().toLowerCase(); const type=({svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',mp3:'audio/mpeg',ogg:'audio/ogg'})[ext] || 'application/octet-stream';const url=URL.createObjectURL(new Blob([files[key]],{type}));data.media[name]=url;newUrls.push(url); }
    // Check the first card before replacing the current study session.
    const oldDeck=deck;deck=data;try {side(data.cards[0],false);} finally {deck=oldDeck;}
    activate(data);urls.forEach(URL.revokeObjectURL);urls=newUrls;toast(`${data.cards.length} cards imported`);
  } catch(e) {newUrls.forEach(URL.revokeObjectURL);toast(e.message || 'Could not read this Anki deck.');}
  finally {busy=false;$('#uploadTop').disabled=false;$('#uploadTop').textContent='↑ Import Anki deck';}
}
$('#uploadTop').onclick=()=>$('#fileInput').click();
$('#fileInput').onchange=e=>{if(e.target.files[0])importDeck(e.target.files[0]);e.target.value='';};
document.addEventListener('keydown',keys);
document.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();});
document.addEventListener('drop',e=>{if(e.dataTransfer.files.length){e.preventDefault();importDeck(e.dataTransfer.files[0]);}});
activate(window.ANATOMY_DECK);
})();
