(function(){
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const PRICE=4999, DESIGN_D=3, PROD_D=25, SHIP_D=5, TOTAL_D=DESIGN_D+PROD_D+SHIP_D; // 33 dage
const fmt=n=>n.toLocaleString('da-DK')+' kr.';
const dfmt=d=>d.toLocaleDateString('da-DK',{day:'numeric',month:'short',year:'numeric'});
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const today=()=>{const t=new Date();t.setHours(0,0,0,0);return t};
const daysBetween=(a,b)=>Math.round((b-a)/864e5);

/* ---------- Pris-model (VEJLEDENDE – ret i denne tabel) ---------- */
const T=window.LM_TENT;
function unitPrice(size,walls){return T.price(size,walls)}
let size='3x3', walls=1;
function fmtIncl(n){return Math.round(n*1.25).toLocaleString('da-DK')+' kr. inkl. moms'}
function calcSvg(){const w=walls; const dark='#0F1F2E'; const light='#C9CED3';
  const back=w>=1, sideHalf=(w===2||w===3), sideFull=(w>=4), frontHalf=(w===3), frontFull=(w===5);
  const side=(x1,x2)=>{const full=sideFull, half=sideHalf; const y2=full?100:(half?86:100);
    return '<path d="M'+x1+' 72 L'+x2+' '+y2+' L'+x2+' 72Z" fill="'+(full||half?dark:'none')+'" stroke="'+light+'" stroke-dasharray="'+(full||half?'0':'3 3')+'"/>'};
  return '<path d="M30 60 100 18l70 42Z" fill="'+dark+'"/><rect x="26" y="60" width="148" height="12" fill="'+dark+'"/>'+
   '<rect x="40" y="72" width="120" height="30" fill="'+(back?dark:'none')+'" opacity=".85" stroke="'+light+'" stroke-dasharray="'+(back?'0':'3 3')+'"/>'+
   side(40,28)+side(160,172)+
   (frontFull?'<rect x="40" y="72" width="120" height="30" fill="'+dark+'" opacity=".55" stroke="'+dark+'"/>':
    frontHalf?'<rect x="40" y="87" width="120" height="15" fill="'+dark+'" opacity=".6" stroke="'+dark+'"/>':
    '<rect x="40" y="72" width="120" height="30" fill="none" stroke="'+light+'" stroke-dasharray="3 3"/>')+
   '<text x="100" y="45" text-anchor="middle" font-family="Archivo" font-weight="700" font-size="9" fill="#fff" opacity=".8">'+(size==='3x6'?'3 × 6 m':'3 × 3 m')+'</text>';}
function renderCalc(){
  const u=unitPrice(size,walls); const n=Math.max(qty,1);
  $('#calcUnit').textContent=fmt(u); $('#calcIncl').textContent=fmtIncl(u);
  $('#calcRows').innerHTML='<div><span>Telt '+size.replace('x',' × ')+' m, tag med fuldt tryk</span><span>inkl.</span></div>'+(walls>0?'<div><span>'+T.label(walls)+' med tryk</span><span>inkl.</span></div>':'<div><span>Ingen vægge</span><span>–</span></div>')+'<div><span>Transporttaske med hjul og designopsætning</span><span>inkl.</span></div><div><span>Fragt</span><span>efter adresse</span></div>';
  $('#calcTotLbl').textContent=(qty>=4?'4+':n)+' '+(n===1?'telt':'telte')+' i alt, ekskl. moms'; $('#calcTot').textContent=fmt(u*n)+(qty>=4?' +':'');
  $('#calcSvg').innerHTML=calcSvg();
  $$('#sizeOpts .opt,#qSize .opt').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===size));
  $$('#wallOpts .opt,#qWalls .opt').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.w===walls));
  $$('#calcQty .opt').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.q===qty));
  const tb=$('#priceTabBody'); if(tb) tb.innerHTML=T.variants.filter(v=>!v.hidden).map(v=>'<tr'+(v.id===walls?' class="on"':'')+'><td>'+v.name+'</td><td class="right num">'+fmt(unitPrice('3x3',v.id))+'</td><td class="right num">'+fmt(unitPrice('3x6',v.id))+'</td></tr>').join('');
  // sync configurator summary + quote summary
  qSummary();
}
document.addEventListener('click',e=>{
  const sb=e.target.closest('#sizeOpts .opt,#qSize .opt'); if(sb){size=sb.dataset.s; renderCalc(); return}
  const wb=e.target.closest('#wallOpts .opt,#qWalls .opt'); if(wb){walls=+wb.dataset.w; renderCalc(); return}
  const qb=e.target.closest('#calcQty .opt'); if(qb){setQty(+qb.dataset.q)}
  const cl=e.target.closest('#copyLetter'); if(cl){const t=$('#letter').innerText; (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>{cl.textContent='Kopieret ✓'; setTimeout(()=>cl.textContent='Kopiér brevet',2000)}).catch(()=>{cl.textContent='Markér og kopiér teksten'})}
});

/* ---------- Configurator ---------- */
let qty=1, color='#0F1F2E';
const fabs=$$('.fab');
function setColor(c){color=c; fabs.forEach(f=>f.setAttribute('fill',c));
  const light=c==='#F2F2EE'; const tc=light?'#0F1F2E':'#fff';
  ['#wallText','#roofText','#valText'].forEach(s=>{if($(s))$(s).setAttribute('fill',tc)});
  $$('.sw').forEach(b=>b.setAttribute('aria-pressed',b.dataset.c===c));
  $('#qColor').value={'#0F1F2E':'Navy','#111111':'Sort','#B8202A':'Rød','#1F6E3E':'Grøn','#F26B1D':'Orange','#1E63B5':'Blå','#F2F2EE':'Hvid'}[c]||'Navy';
}
if($('#swatches')) $('#swatches').addEventListener('click',e=>{const b=e.target.closest('.sw'); if(b) setColor(b.dataset.c)});
if($('#logoUp')) $('#logoUp').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return; const r=new FileReader();
  r.onload=()=>{['#wallLogo','#roofLogo'].forEach(s=>{const im=$(s); im.setAttribute('href',r.result); im.style.display=''});
    $('#wallText').style.display='none'; $('#roofText').style.display='none';
    $('#uplBox').querySelector('b').textContent=f.name+' – skift logo'; state.logoName=f.name};
  r.readAsDataURL(f);
});
if($('#valInput')) $('#valInput').addEventListener('input',e=>{$('#valText').textContent=e.target.value.toUpperCase()||'JERES FORENING · JERES BY'});
function setQty(q){qty=q;
  $$('#qtyOpts .opt').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.q===q));
  $$('#qQty .opt').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.q===q));
  renderCalc();
}
if($('#qtyOpts')) $('#qtyOpts').addEventListener('click',e=>{const b=e.target.closest('.opt'); if(b) setQty(+b.dataset.q)});
$('#qQty').addEventListener('click',e=>{const b=e.target.closest('.opt'); if(b) setQty(+b.dataset.q)});


/* ---------- Merch selection (shared between section and form) ---------- */
const state={merch:new Set(),logoName:''};
function syncMerch(){
  $$('.add').forEach(b=>{const on=state.merch.has(b.dataset.m); b.setAttribute('aria-pressed',on); b.textContent=on?'✓ Med i tilbud':'+ Tilføj'});
  $$('.add2').forEach(b=>b.setAttribute('aria-pressed',state.merch.has(b.dataset.m)));
  $$('#qMerch .opt, #qLaser .opt, #qAcc .opt').forEach(b=>b.setAttribute('aria-pressed',state.merch.has(b.dataset.m)));
  qSummary();
}
document.addEventListener('click',e=>{const b=e.target.closest('.add,.add2,#qMerch .opt,#qLaser .opt,#qAcc .opt'); if(!b) return; const m=b.dataset.m; state.merch.has(m)?state.merch.delete(m):state.merch.add(m); syncMerch()});

/* ---------- Quote form ---------- */
let step=1; const form=$('#qform');
function showStep(n){step=n; $$('.qstep').forEach(s=>s.hidden=+s.dataset.step!==n); $$('.steps span').forEach((s,i)=>s.classList.toggle('on',i<n)); if(n===3) qSummary(); form.scrollIntoView({behavior:'smooth',block:'start'})}
form.addEventListener('click',e=>{if(e.target.closest('[data-next]')) showStep(step+1); if(e.target.closest('[data-prev]')) showStep(step-1)});
$('#qDate').addEventListener('change',()=>{const v=$('#qDate').value; const h=$('#qDateHint'); if(!v){h.hidden=true;return}
  const ev=new Date(v+'T00:00:00'), left=daysBetween(today(),ev); h.hidden=false; h.className='verdict';
  if(left>=42) h.textContent='Fint – det passer med den typiske leveringstid på 4–6 uger. Vi bekræfter datoen i tilbuddet.';
  else if(left>=0){h.classList.add('warn');h.textContent='Det er inden for 6 uger. Send alligevel – vi tjekker lager og siger ærligt, om vi kan nå det.'}
  else{h.classList.add('bad');h.textContent='Datoen ligger i fortiden – tjek lige, om den er rigtig.'}
});
$('#qLogo').addEventListener('change',e=>{const f=e.target.files[0]; if(f){$('#qLogoLbl').textContent='Vedhæftet: '+f.name; state.logoName=f.name}});
function qSummary(){
  const s=$('#qSummary'); if(!s) return; const n=Math.max(qty,1);
  let h='';
  const u=unitPrice(size,walls); if(qty>0) h+='<div><span>'+(qty>=4?'4+':qty)+' × reklametelt '+size.replace('x','×')+', '+T.label(walls).toLowerCase()+', alt inkl.</span><b class="num">'+fmt(u*n)+(qty>=4?' +':'')+'</b></div>';
  state.merch.forEach(m=>h+='<div><span>'+m+'</span><span>Pris efter antal</span></div>');
  if(!h) h='<div><span>Intet valgt endnu</span><span></span></div>';
  h+='<div class="tot"><span>Vejledende, ekskl. moms og fragt</span><b class="num">'+(qty>0?fmt(u*n)+(qty>=4?' +':''):'–')+'</b></div>';
  s.innerHTML=h;
}
/* Telt til/fra i formularen – formularen starter uden telt */
const tentBlock=$('#tentBlock');
function setTent(on){tentBlock.dataset.on=on?'1':'0'; $('#tentOn').setAttribute('aria-pressed',on); $('#tentOff').setAttribute('aria-pressed',!on); setQty(on?Math.max(qty,1):0)}
$('#tentOn').addEventListener('click',()=>setTent(true)); $('#tentOff').addEventListener('click',()=>setTent(false));
const tentFromHash=()=>{ if(location.hash.startsWith('#/telte')) setTent(true) }; setTent(false); tentFromHash(); window.addEventListener('hashchange',tentFromHash);
form.addEventListener('submit',async e=>{
  e.preventDefault(); const err=$('#qErr'); const org=$('#qOrg').value.trim(), name=$('#qName').value.trim(), mail=$('#qMail').value.trim();
  if(!org||!name||!/.+@.+\..+/.test(mail)){err.hidden=false; err.textContent='Vi mangler forening/virksomhed, navn og en gyldig e-mail for at kunne sende tilbuddet.'; return}
  if($('#qWebsite').value){showStep(4); return} // honeypot: bots udfylder skjult felt
  err.hidden=true;
  const btn=form.querySelector('button[type=submit]'); btn.disabled=true; btn.textContent='Sender …';
  try{
    const sb=window.LM_SUPABASE; if(!sb) throw new Error('Supabase ikke konfigureret');
    const id=(crypto.randomUUID?crypto.randomUUID():([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)));
    let logo_path=null; const f=$('#qLogo').files[0];
    if(f && f.size<15*1024*1024){
      const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,'_'); const path=id+'/'+safe;
      const up=await sb.storage.from('logos').upload(path,f,{upsert:false});
      if(!up.error) logo_path=path; else console.warn('Logo-upload fejlede',up.error);
    }
    const lead={id,org,name,email:mail,phone:$('#qTel').value.trim(),event_name:$('#qEvent').value.trim(),event_date:$('#qDate').value||null,color:$('#qColor').value,
      tent_qty:qty,tent_size:size,tent_walls:walls,items:[...state.merch],message:$('#qMsg').value.trim(),sponsor:$('#qSponsor').value.trim(),logo_path,
      est_value:qty>0?unitPrice(size,walls)*Math.max(qty,1):0,source:'logomarketing.dk'};
    const {error}=await sb.rpc('submit_lead',{p:lead}); if(error) throw error;
    showStep(4);
  }catch(ex){
    console.error(ex); err.hidden=false; err.textContent='Noget gik galt, da vi skulle sende. Prøv igen – eller skriv direkte til info@logomarketing.dk.';
  }finally{ btn.disabled=false; btn.textContent='Send – få mockup og tilbud'; }
});

/* ---------- Routing ---------- */
let page='home';
const TITLES={home:'LogoMarketing – reklametelte, dogtags og merchandise med jeres logo',telte:'Reklametelte med jeres logo – LogoMarketing',laser:'Lasergraverede dogtags fra Aulum – LogoMarketing',merch:'Merchandise med logo – LogoMarketing',foreninger:'Til foreninger: få teltet betalt af en sponsor – LogoMarketing',vilkaar:'Handelsbetingelser – LogoMarketing'};
function showPage(pg){page=pg; document.title=TITLES[pg]||TITLES.home; const nl=$('#navLinks'); if(nl){nl.classList.remove('open'); $('#burger').setAttribute('aria-expanded','false')} $$('.page').forEach(p=>p.hidden=p.dataset.page!==pg); $$('[data-nav]').forEach(a=>{if(a.dataset.nav===pg) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current')})}
function route(){
  const h=location.hash||'#/';
  if(h.startsWith('#/')){const pg=h.slice(2)||'home'; showPage(['telte','laser','merch','foreninger','vilkaar'].includes(pg)?pg:'home'); window.scrollTo({top:0,behavior:'instant'}); return}
  // in-page anchor: keep current page, scroll to target
  const el=document.getElementById(h.slice(1)); if(el){el.scrollIntoView({behavior:'smooth',block:'start'})}
}
window.addEventListener('hashchange',route); route();
if($('#burger')) $('#burger').addEventListener('click',()=>{const nl=$('#navLinks'); const o=nl.classList.toggle('open'); $('#burger').setAttribute('aria-expanded',o)});
$$('#navLinks a').forEach(a=>a.addEventListener('click',()=>{$('#navLinks').classList.remove('open')}));
setQty(1); syncMerch();
})();

