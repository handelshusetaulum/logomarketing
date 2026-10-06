/* LogoMarketing admin – Supabase-udgave */
(function(){
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const sb=window.LM_SUPABASE;
const TOTAL_D=33;
const fmt=n=>Math.round(+n||0).toLocaleString('da-DK')+' kr.';
const dfmt=d=>d.toLocaleDateString('da-DK',{day:'numeric',month:'short',year:'numeric'});
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const today=()=>{const t=new Date();t.setHours(0,0,0,0);return t};
const daysBetween=(a,b)=>Math.round((b-a)/864e5);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const STAGES=[['ny','Ny'],['kontakt','Kontaktet'],['tilbud','Tilbud sendt'],['vundet','Vundet'],['tabt','Tabt']];
const STAGE_NAME=Object.fromEntries(STAGES);
/* Produktionsflow efter "vundet": [nøgle, navn, knaptekst for at gå HERTIL] */
const PROD=[['korrektur','Korrektur sendt','Korrektur sendt til kunden'],['godkendt','Korrektur godkendt','Kunden har godkendt korrektur'],['bestilt','Bestilt','Bestilt hos leverandør'],['modtaget','Modtaget','Varer modtaget i Aulum'],['leveret','Leveret','Leveret til kunden'],['faktureret','Faktureret','Faktureret – afslut']];
const PROD_IDX=Object.fromEntries(PROD.map((p,i)=>[p[0],i]));
const prodIdx=l=>l.prod_step?PROD_IDX[l.prod_step]:-1;
const inProd=l=>l.stage==='vundet'&&l.prod_step!=='faktureret';
const notOrdered=l=>prodIdx(l)<PROD_IDX.bestilt;
const LEAD_TIME=35; // dage fra bestilling til varerne er i Aulum (bruges som forslag til ETA)
const T=window.LM_TENT;
function unitPrice(size,walls){return T.price(size,walls==null?1:walls)}

if(!sb){document.body.innerHTML='<div class="login"><h1>Supabase er ikke sat op</h1><p>Ret <code>assets/js/config.js</code> med URL og anon-key fra dit Supabase-projekt, og genindlæs siden.</p></div>'; return}

/* ---------- Auth ---------- */
async function boot(){
  const {data:{session}}=await sb.auth.getSession();
  if(session){ showAdmin(session) } else { $('#loginView').hidden=false }
}
sb.auth.onAuthStateChange((_e,session)=>{ if(session) showAdmin(session); else { $('#admin').hidden=true; $('#loginView').hidden=false } });
$('#loginBtn').addEventListener('click',async()=>{
  const email=$('#loginMail').value.trim(); const m=$('#loginMsg'); m.hidden=false; m.className='msg';
  if(!email){m.className='msg bad'; m.textContent='Skriv din e-mail.'; return}
  const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:false}});
  if(error){m.className='msg bad'; m.textContent=/signup|not allowed|not found/i.test(error.message)?'Den mail har ikke adgang til admin.':'Kunne ikke sende link: '+error.message} else m.textContent='Tjek din indbakke – klik på linket, så er du logget ind.';
});
$('#logout').addEventListener('click',async()=>{await sb.auth.signOut(); location.reload()});

let leads=[], events={}, quotes=[];
async function showAdmin(session){
  const chk=await sb.rpc('is_admin');
  if(!chk.error && chk.data===false){ await sb.auth.signOut(); $('#admin').hidden=true; $('#loginView').hidden=false; const m=$('#loginMsg'); m.hidden=false; m.className='msg bad'; m.textContent=session.user.email+' har ikke adgang til admin. Log ind med en admin-mail.'; return }
  $('#loginView').hidden=true; $('#admin').hidden=false; $('#who').textContent='Logget ind som '+session.user.email;
  await reload();
}
async function reload(){
  const r=await sb.from('leads').select('*').order('created_at',{ascending:false});
  if(r.error){ alert('Kunne ikke hente leads: '+r.error.message+'\n\nEr din mail på admin-listen? (tabellen public.admins)'); return }
  leads=r.data||[];
  const q=await sb.from('quotes').select('*').order('created_at',{ascending:false}); quotes=q.data||[];
  render();
}

/* ---------- Helpers ---------- */
const val=l=>+l.est_value||0;
const items=l=>l.items||[];
function orderBy(l){return l.event_date?addD(new Date(l.event_date+'T00:00:00'),-TOTAL_D):null}
const needsOrder=l=>l.stage!=='tabt'&&!(l.stage==='vundet'&&!notOrdered(l)); // bestil-fristen er relevant indtil der ER bestilt
function dueClass(l){const o=orderBy(l); if(!o||!needsOrder(l)) return ''; const d=daysBetween(today(),o); return d<0?'late':d<=7?'due':''}
function stepper(l){const i=prodIdx(l); return '<div class="stepper" title="'+PROD.map(p=>p[1]).join(' → ')+'">'+PROD.map((p,k)=>'<span class="sp'+(k<=i?' on':'')+(k===i?' cur':'')+'"></span>').join('')+'</div>'}
function nextBtn(l){const i=prodIdx(l); const n=PROD[i+1]; if(!n) return '<span class="chip ok">Afsluttet</span>'; return '<button class="btn btn-signal btn-sm" data-advance="'+l.id+'" data-to="'+n[0]+'">'+esc(n[2])+' →</button>'}
async function advance(id,to){
  const l=leads.find(x=>x.id===id); if(!l) return; const upd={prod_step:to};
  if(to==='bestilt'){const def=addD(today(),LEAD_TIME).toISOString().slice(0,10); const eta=prompt('Bestilt hos leverandør i dag.\nForventet modtagelse i Aulum (åååå-mm-dd):',l.eta_date||def); if(eta===null) return; upd.ordered_at=new Date().toISOString().slice(0,10); upd.eta_date=eta||null}
  if(to==='faktureret'&&!confirm('Markér '+l.org+' som faktureret og afslut ordren?')) return;
  const r=await sb.from('leads').update(upd).eq('id',id); if(r.error) return alert(r.error.message);
  await reload(); if($('#drawer').classList.contains('open')) openLead(id);
}

/* ---------- Render ---------- */
function render(){
  const t=today();
  const open=leads.filter(l=>['ny','kontakt','tilbud'].includes(l.stage));
  const won=leads.filter(l=>l.stage==='vundet'); const wonVal=won.reduce((a,l)=>a+val(l),0);
  const pipeVal=leads.filter(l=>l.stage==='tilbud').reduce((a,l)=>a+val(l),0);
  const next=leads.filter(l=>needsOrder(l)&&orderBy(l)&&orderBy(l)>=t).sort((a,b)=>orderBy(a)-orderBy(b))[0];
  const prodOpen=leads.filter(inProd);
  const overdue=leads.filter(l=>l.follow_up&&new Date(l.follow_up+'T00:00:00')<=t&&!['vundet','tabt'].includes(l.stage)).length;
  $('#kpis').innerHTML=
    '<div class="kpi"><small>Åbne leads</small><b class="num">'+open.length+'</b><i>'+leads.filter(l=>l.stage==='ny').length+' nye, ikke kontaktet</i></div>'+
    '<div class="kpi"><small>Tilbud ude</small><b class="num">'+fmt(pipeVal)+'</b><i>'+leads.filter(l=>l.stage==='tilbud').length+' afventer svar</i></div>'+
    '<div class="kpi"><small>Vundet</small><b class="num">'+fmt(wonVal)+'</b><i>'+won.length+' ordrer · '+prodOpen.length+' i produktion</i></div>'+
    '<div class="kpi"><small>Opfølgninger</small><b class="num" style="color:'+(overdue?'var(--signal)':'inherit')+'">'+overdue+'</b><i>forfaldne eller i dag</i></div>'+
    '<div class="kpi"><small>Næste bestil-frist</small><b style="font-size:1.15rem">'+(next?dfmt(orderBy(next)):'–')+'</b><i>'+(next?esc(next.org):'ingen aktive')+'</i></div>';
  $('#board').innerHTML=STAGES.map(([k,n])=>{const ls=leads.filter(l=>l.stage===k); return '<div class="col"><h4>'+n+'<span>'+ls.length+'</span></h4>'+ls.map(card).join('')+'</div>'}).join('');
  const byOrg={}; leads.forEach(l=>{(byOrg[l.org]=byOrg[l.org]||[]).push(l)});
  $('#custList').innerHTML='<div class="arow" style="background:transparent;border:0;font-size:.74rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)"><span>Forening / virksomhed</span><span>Kontakt</span><span>Forespørgsler</span><span>Vundet</span><span></span></div>'+
    Object.entries(byOrg).sort((a,b)=>a[0].localeCompare(b[0],'da')).map(([o,ls])=>'<div class="arow"><b>'+esc(o)+'</b><span>'+esc(ls[0].name)+'<br><small style="color:var(--muted)">'+esc(ls[0].email)+'</small></span><span class="num">'+ls.length+'</span><span class="num">'+fmt(ls.filter(l=>l.stage==='vundet').reduce((a,l)=>a+val(l),0))+'</span><button class="btn btn-ghost btn-sm" data-open="'+ls[0].id+'">Åbn</button></div>').join('')||'<p style="color:var(--muted)">Ingen kunder endnu.</p>';
  // Produktion: vundne ordrer med stepper, sorteret efter hvad der haster mest
  const urgency=l=>{if(notOrdered(l)) return orderBy(l)?orderBy(l).getTime():8e15; return l.eta_date?new Date(l.eta_date+'T00:00:00').getTime()+1e12:9e15};
  const prod=leads.filter(inProd).sort((a,b)=>urgency(a)-urgency(b));
  const what=l=>(l.tent_qty>0?l.tent_qty+' × telt '+String(l.tent_size||'3x3').replace('x','×')+' '+esc(l.color||''):'')+(items(l).length?(l.tent_qty>0?'<br>':'')+'<small style="color:var(--muted)">'+esc(items(l).join(', '))+'</small>':'');
  const dateCell=l=>{
    if(notOrdered(l)){const o=orderBy(l); if(!o) return '<small style="color:var(--muted)">Bestil senest</small><br><span style="color:var(--warn-text)">Sæt arrangementsdato</span>'; const d=daysBetween(t,o); const c=d<0?'bad':d<=7?'warn':'ok'; return '<small style="color:var(--muted)">Bestil senest</small><br><b class="num">'+dfmt(o)+'</b> <span class="chip '+c+'">'+(d<0?(-d)+' dage over':d===0?'I dag':'om '+d+' dage')+'</span>'}
    if(l.prod_step==='bestilt'){if(!l.eta_date) return '<small style="color:var(--muted)">Bestilt '+(l.ordered_at?dfmt(new Date(l.ordered_at+'T00:00:00')):'')+'</small><br>ETA ikke sat'; const e=new Date(l.eta_date+'T00:00:00'), d=daysBetween(t,e); const ev=l.event_date?new Date(l.event_date+'T00:00:00'):null; const risk=ev&&e>addD(ev,-3); return '<small style="color:var(--muted)">Forventes i Aulum</small><br><b class="num">'+dfmt(e)+'</b> <span class="chip '+(risk?'bad':d<=3?'warn':'ok')+'">'+(d<0?(-d)+' dage forsinket':d===0?'I dag':'om '+d+' dage')+'</span>'+(risk?'<br><small style="color:var(--bad)">Tæt på arrangementet – ryk leverandøren</small>':'')}
    return '<small style="color:var(--muted)">Arrangement</small><br><b class="num">'+(l.event_date?dfmt(new Date(l.event_date+'T00:00:00')):'–')+'</b>';
  };
  $('#prodList').innerHTML=prod.length?prod.map(l=>'<div class="arow prow"><b>'+esc(l.org)+'<br><small style="color:var(--muted);font-weight:400">'+esc(l.event_name||'')+(l.event_date?' · '+dfmt(new Date(l.event_date+'T00:00:00')):'')+'</small></b><span>'+what(l)+'</span><span>'+dateCell(l)+'</span><span>'+stepper(l)+'<small style="color:var(--muted)">'+(PROD[prodIdx(l)]||['','Ikke startet'])[1]+(l.prod_step==='korrektur'?(l.proof_url?' · v'+(l.proof_version||1)+' afventer kunden':' · <span style="color:var(--warn-text)">upload korrektur</span>'):'')+'</small></span><span style="display:flex;gap:.4rem;flex-wrap:wrap;justify-content:flex-end">'+nextBtn(l)+'<button class="btn btn-ghost btn-sm" data-open="'+l.id+'">Åbn</button></span></div>').join(''):'<p style="color:var(--muted)">Ingen ordrer i produktion. Når et lead bliver <b>Vundet</b> – eller kunden accepterer et tilbud – lander det her.</p>';
  const waiting=leads.filter(l=>l.stage==='tilbud'&&l.event_date).sort((a,b)=>orderBy(a)-orderBy(b));
  $('#waitList').innerHTML=waiting.length?waiting.map(l=>{const o=orderBy(l), d=daysBetween(t,o); const c=d<0?'bad':d<=7?'warn':'ok';
    return '<div class="arow"><b>'+esc(l.org)+'<br><small style="color:var(--muted);font-weight:400">'+esc(l.event_name||'')+'</small></b><span>'+what(l)+'</span><span><small style="color:var(--muted)">Skal bestilles senest</small><br><b class="num">'+dfmt(o)+'</b> <span class="chip '+c+'">'+(d<0?(-d)+' dage over':d===0?'I dag':'om '+d+' dage')+'</span></span><span></span><button class="btn btn-ghost btn-sm" data-open="'+l.id+'">Åbn</button></div>'}).join(''):'<p style="color:var(--muted)">Ingen tilbud afventer svar.</p>';
  const done=leads.filter(l=>l.stage==='vundet'&&l.prod_step==='faktureret'); $('#doneCount').textContent=done.length;
  $('#doneList').innerHTML=done.map(l=>'<div class="arow"><b>'+esc(l.org)+'</b><span>'+what(l)+'</span><span class="num">'+fmt(val(l))+'</span><span></span><button class="btn btn-ghost btn-sm" data-open="'+l.id+'">Åbn</button></div>').join('');
  $('#quoteList').innerHTML=quotes.length?quotes.map(q=>{const tot=(q.lines||[]).reduce((a,x)=>a+(+x.qty||0)*(+x.unit||0),0)+(+q.shipping||0); const st={kladde:'',sendt:'warn',set:'warn',accepteret:'ok',afvist:'bad',udloebet:'bad'}[q.status]||'';
    return '<div class="arow"><b>'+esc(q.org)+'<br><small style="color:var(--muted);font-weight:400">'+esc(q.contact_name||'')+'</small></b><span class="num">'+fmt(tot)+' ekskl.</span><span><span class="chip '+st+'">'+esc(q.status)+'</span>'+(q.seen_at?'<br><small style="color:var(--muted)">Set '+dfmt(new Date(q.seen_at))+'</small>':'')+'</span><span><a href="'+quoteUrl(q.code)+'" target="_blank" rel="noopener" style="font-size:.85rem">Åbn side ↗</a></span><button class="btn btn-ghost btn-sm" data-quote="'+q.code+'">Redigér</button></div>'}).join(''):'<p style="color:var(--muted)">Ingen tilbud endnu. Opret ét fra et lead, eller med knappen ovenfor.</p>';
}
function quoteUrl(code){return location.origin+location.pathname.replace(/admin\.html$/,'')+'t/?k='+code}
function card(l){const o=orderBy(l); const it=[l.tent_qty>0?l.tent_qty+' × telt':'',...items(l)].filter(Boolean).join(' · ');
  return '<div class="card '+dueClass(l)+'" data-open="'+l.id+'" tabindex="0"><b>'+esc(l.org)+'</b><small>'+esc(it)+'</small><span class="val num">'+(val(l)?fmt(val(l)):'Pris efter antal')+'</span><div class="meta"><span>'+(l.event_date?'Arr. '+dfmt(new Date(l.event_date+'T00:00:00')):'Ingen dato')+'</span><span>'+(l.stage==='vundet'&&l.prod_step?(PROD[prodIdx(l)]||[])[1]:o&&needsOrder(l)?'Bestil '+o.toLocaleDateString('da-DK',{day:'numeric',month:'short'}):'')+'</span></div>'+(l.stage==='vundet'?stepper(l):'')+'</div>'}

/* ---------- Korrektur (produktionsboks i lead-panelet) ---------- */
function prodBox(l,q){
  const i=prodIdx(l); const cust=q?quoteUrl(q.code):'';
  const proofState = l.proof_approved_at ? '<span class="chip ok">Godkendt af '+esc(l.proof_approved_by||'kunden')+' · '+dfmt(new Date(l.proof_approved_at))+'</span>'
    : l.proof_url ? '<span class="chip warn">v'+(l.proof_version||1)+' sendt '+(l.proof_sent_at?dfmt(new Date(l.proof_sent_at)):'')+' · afventer kunden</span>'
    : '<span class="chip">Ingen korrektur uploadet</span>';
  const mailBody='Hej '+(l.name||'').split(' ')[0]+',\n\nHer er korrekturen på jeres '+(l.tent_qty>0?'telt':'bestilling')+'. Kig den grundigt igennem – logo, farver og stavning – og godkend den med ét klik her:\n'+cust+'\n\nNår korrekturen er godkendt, sætter vi produktionen i gang. Levering typisk 4–6 uger efter godkendt korrektur.\n\nVenlig hilsen\nKenneth Storm\nLogoMarketing · 97 47 31 78';
  return '<div class="prodbox"><div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap"><b>Produktion · '+esc((PROD[i]||['','Ikke startet'])[1])+'</b>'+nextBtn(l)+'</div>'+stepper(l)+
    '<ol class="prodsteps">'+PROD.map((p,k)=>'<li class="'+(k<i?'done':k===i?'cur':'')+'">'+p[1]+'</li>').join('')+'</ol>'+
    '<div class="proof"><div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap"><label style="margin:0">Korrektur til kunden</label>'+proofState+'</div>'+
    (l.proof_url?'<a href="'+esc(l.proof_url)+'" target="_blank" rel="noopener" class="proofimg"><img src="'+esc(l.proof_url)+'" alt="Korrektur v'+(l.proof_version||1)+'"></a>':'')+
    '<div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-top:.5rem"><input type="file" id="f_proof" accept="image/*,.pdf" style="max-width:260px"><button class="btn btn-ink btn-sm" id="sendProof">'+(l.proof_url?'Send ny version (v'+((l.proof_version||1)+1)+')':'Upload og send korrektur')+'</button>'+
    (l.proof_url&&cust?'<a class="btn btn-ghost btn-sm" href="mailto:'+esc(l.email)+'?subject='+encodeURIComponent('Korrektur til godkendelse – '+l.org)+'&body='+encodeURIComponent(mailBody)+'">Mail kunden linket</a>':'')+'</div>'+
    '<small style="color:var(--muted);display:block;margin-top:.4rem">'+(cust?'Kunden ser korrekturen og godkender den på sin ordreside: <a href="'+cust+'" target="_blank">'+cust+'</a>':'Lav et tilbud til leadet først – så får kunden en ordreside, hvor korrekturen kan godkendes.')+' Den orange knap ovenfor bruger du kun, hvis kunden godkender på anden vis (telefon, mail).</small></div>'+
    '<div class="grid2" style="margin-top:.6rem"><div><label>Bestilt hos leverandør</label><input type="date" id="f_ordered" value="'+esc(l.ordered_at||'')+'"></div><div><label>Forventet i Aulum (ETA)</label><input type="date" id="f_eta" value="'+esc(l.eta_date||'')+'"></div></div></div>';
}
async function sendProof(l){
  const f=$('#f_proof').files[0]; if(!f) return alert('Vælg først en fil (billede eller PDF).');
  if(f.size>15*1024*1024) return alert('Filen er over 15 MB – gør den mindre først.');
  const v=(l.proof_version||0)+1; const ext=(f.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
  const path='korrektur/'+l.id+'/v'+v+'-'+Date.now()+'.'+ext;
  const up=await sb.storage.from('mockups').upload(path,f,{contentType:f.type||undefined}); if(up.error) return alert('Upload fejlede: '+up.error.message);
  const url=sb.storage.from('mockups').getPublicUrl(path).data.publicUrl;
  const r=await sb.from('leads').update({proof_url:url,proof_version:v,proof_sent_at:new Date().toISOString(),proof_approved_at:null,proof_approved_by:null,prod_step:'korrektur'}).eq('id',l.id);
  if(r.error) return alert(r.error.message);
  await sb.from('lead_events').insert({lead_id:l.id,message:'Korrektur v'+v+' uploadet og sendt til kunden',actor:'kenneth'});
  await reload(); openLead(l.id);
}

/* ---------- Lead-pane ---------- */
async function openLead(id){
  const l=leads.find(x=>x.id===id); if(!l) return; const o=orderBy(l);
  const ev=await sb.from('lead_events').select('*').eq('lead_id',id).order('created_at',{ascending:false}); const log=ev.data||[];
  let logoUrl=''; if(l.logo_path){const s=await sb.storage.from('logos').createSignedUrl(l.logo_path,3600); logoUrl=s.data?.signedUrl||''}
  const myQuotes=quotes.filter(q=>q.lead_id===id);
  $('#pane').innerHTML=
    '<div style="display:flex;justify-content:space-between;align-items:start;gap:1rem"><div><p class="eyebrow">'+STAGE_NAME[l.stage]+'</p><h3>'+esc(l.org)+'</h3><p style="color:var(--muted)">'+esc(l.name)+' · <a href="mailto:'+esc(l.email)+'">'+esc(l.email)+'</a>'+(l.phone?' · <a href="tel:'+esc(l.phone)+'">'+esc(l.phone)+'</a>':'')+'</p></div><button class="btn btn-ghost btn-sm" data-close>Luk</button></div>'+
    '<div class="grid2"><div><label>Forening / virksomhed</label><input id="f_org" value="'+esc(l.org)+'"></div><div><label>Kontaktperson</label><input id="f_name" value="'+esc(l.name)+'"></div><div><label>E-mail</label><input id="f_email" value="'+esc(l.email)+'"></div><div><label>Telefon</label><input id="f_phone" value="'+esc(l.phone||'')+'"></div></div>'+
    '<div class="grid2"><div><label>Status</label><select id="f_stage">'+STAGES.map(([k,n])=>'<option value="'+k+'"'+(k===l.stage?' selected':'')+'>'+n+'</option>').join('')+'</select></div><div><label>Følg op</label><input type="date" id="f_follow" value="'+esc(l.follow_up||'')+'"></div><div><label>Arrangementsdato</label><input type="date" id="f_date" value="'+esc(l.event_date||'')+'"></div><div><label>Vejledende værdi (ekskl. moms)</label><input type="number" id="f_value" value="'+(val(l)||'')+'"></div></div>'+
    '<dl class="kv"><dt>Anledning</dt><dd>'+esc(l.event_name||'–')+'</dd><dt>Bestil hos leverandør</dt><dd>'+(o?'<b>'+dfmt(o)+'</b> <small style="color:var(--muted)">(arr. − '+TOTAL_D+' dage)</small>':'–')+'</dd><dt>Telte</dt><dd>'+(l.tent_qty>0?l.tent_qty+' × '+String(l.tent_size||'3x3').replace('x','×')+', '+T.label(l.tent_walls==null?1:l.tent_walls).toLowerCase()+', '+esc(l.color||''):'Ingen')+'</dd><dt>Andet</dt><dd>'+(items(l).length?esc(items(l).join(', ')):'–')+'</dd><dt>Logo</dt><dd>'+(logoUrl?'<a href="'+logoUrl+'" target="_blank" rel="noopener">Hent logo ↗</a>':'<span style="color:var(--warn-text)">Mangler – bed om fil</span>')+'</dd>'+(l.sponsor?'<dt>Sponsor</dt><dd>'+esc(l.sponsor)+'</dd>':'')+(l.message?'<dt>Besked</dt><dd>“'+esc(l.message)+'”</dd>':'')+'<dt>Modtaget</dt><dd>'+new Date(l.created_at).toLocaleString('da-DK')+'</dd></dl>'+
    (l.stage==='vundet'?prodBox(l,myQuotes[0]):'')+
    '<div><label>Noter</label><textarea id="f_notes" rows="3">'+esc(l.notes||'')+'</textarea></div>'+
    '<div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn btn-ink btn-sm" id="saveLead">Gem ændringer</button><button class="btn btn-ghost btn-sm" id="mkQuote">Lav tilbud til denne kunde</button><a class="btn btn-ghost btn-sm" href="mailto:'+esc(l.email)+'?subject='+encodeURIComponent('Mockup og tilbud – '+l.org)+'">Skriv mail</a></div>'+
    (myQuotes.length?'<div><label>Tilbud</label>'+myQuotes.map(q=>'<div class="linkbox"><b>'+esc(q.status)+'</b> · <a href="'+quoteUrl(q.code)+'" target="_blank">'+quoteUrl(q.code)+'</a></div>').join('')+'</div>':'')+
    '<div><label>Log en aktivitet</label><div style="display:flex;gap:.5rem"><input id="f_log" placeholder="Ringet, sendt mockup, korrektur godkendt …"><button class="btn btn-ink btn-sm" id="addLog">Log</button></div></div>'+
    '<div class="log">'+log.map(e=>'<div><time>'+new Date(e.created_at).toLocaleString('da-DK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' · '+esc(e.actor)+'</time>'+esc(e.message)+'</div>').join('')+'</div>'+
    '<div><button class="btn btn-ghost btn-sm" id="delLead" style="color:var(--bad);border-color:var(--bad)">Slet lead</button></div>';
  $('#drawer').classList.add('open');
  $('#saveLead').onclick=async()=>{
    const upd={org:$('#f_org').value,name:$('#f_name').value,email:$('#f_email').value,phone:$('#f_phone').value,stage:$('#f_stage').value,follow_up:$('#f_follow').value||null,event_date:$('#f_date').value||null,est_value:+$('#f_value').value||0,notes:$('#f_notes').value};
    if($('#f_ordered')){upd.ordered_at=$('#f_ordered').value||null; upd.eta_date=$('#f_eta').value||null}
    const r=await sb.from('leads').update(upd).eq('id',id); if(r.error) return alert(r.error.message); await reload(); openLead(id);
  };
  $('#addLog').onclick=async()=>{const m=$('#f_log').value.trim(); if(!m) return; await sb.from('lead_events').insert({lead_id:id,message:m,actor:'kenneth'}); openLead(id)};
  $('#delLead').onclick=async()=>{if(!confirm('Slet '+l.org+'? Det kan ikke fortrydes.')) return; await sb.from('leads').delete().eq('id',id); closePane(); reload()};
  $('#mkQuote').onclick=()=>openQuote(null,l);
  const sp=$('#sendProof'); if(sp) sp.onclick=()=>sendProof(l);
}
function closePane(){$('#drawer').classList.remove('open')}

/* ---------- Tilbud ---------- */
const genCode=()=>{const a='abcdefghjkmnpqrstuvwxyz23456789'; let s=''; const r=crypto.getRandomValues(new Uint8Array(10)); r.forEach(b=>s+=a[b%a.length]); return s};
function defaultLines(l){const ls=[]; if(l&&l.tent_qty>0) ls.push({title:'Reklametelt '+String(l.tent_size||'3x3').replace('x','×')+' m – '+T.label(l.tent_walls==null?1:l.tent_walls).toLowerCase()+', fuldt tryk, transporttaske med hjul og designopsætning',qty:l.tent_qty,unit:unitPrice(l.tent_size||'3x3',l.tent_walls)}); (l?items(l):[]).forEach(m=>ls.push({title:m,qty:1,unit:0})); if(!ls.length) ls.push({title:'',qty:1,unit:0}); return ls}
function openQuote(q,lead){
  const isNew=!q; q=q||{code:genCode(),lead_id:lead?lead.id:null,org:lead?lead.org:'',contact_name:lead?lead.name:'',intro:'Tak for snakken. Her er mockup og tilbud på det, vi talte om. Priserne er ekskl. moms, og tilbuddet gælder i 30 dage.',lines:defaultLines(lead),shipping:0,delivery_text:'Typisk 4–6 uger efter godkendt korrektur – vi bekræfter datoen, når korrekturen er godkendt.',mockup_url:'',status:'kladde',valid_until:addD(today(),30).toISOString().slice(0,10)};
  const lineHtml=(x,i)=>'<div class="qline"><input placeholder="Beskrivelse" data-i="'+i+'" data-k="title" value="'+esc(x.title)+'"><input type="number" data-i="'+i+'" data-k="qty" value="'+(x.qty||1)+'" placeholder="Antal"><input type="number" data-i="'+i+'" data-k="unit" value="'+(x.unit||0)+'" placeholder="Stk. pris"><button data-del="'+i+'" title="Fjern">×</button></div>';
  $('#pane').innerHTML=
    '<div style="display:flex;justify-content:space-between;align-items:start"><div><p class="eyebrow">'+(isNew?'Nyt tilbud':'Tilbud · '+esc(q.status))+'</p><h3>'+esc(q.org||'Tilbud')+'</h3></div><button class="btn btn-ghost btn-sm" data-close>Luk</button></div>'+
    '<div class="quote-form">'+
    '<div class="grid2"><div><label>Forening / virksomhed</label><input id="q_org" value="'+esc(q.org)+'"></div><div><label>Kontaktperson</label><input id="q_name" value="'+esc(q.contact_name||'')+'"></div><div><label>Gyldigt til</label><input type="date" id="q_valid" value="'+esc(q.valid_until||'')+'"></div><div><label>Status</label><select id="q_status">'+['kladde','sendt','set','accepteret','afvist','udloebet'].map(s=>'<option'+(s===q.status?' selected':'')+'>'+s+'</option>').join('')+'</select></div></div>'+
    '<div><label>Personlig intro</label><textarea id="q_intro" rows="3">'+esc(q.intro||'')+'</textarea></div>'+
    '<div><label>Linjer (antal × stk.pris ekskl. moms)</label><div class="qlines" id="qlines">'+(q.lines||[]).map(lineHtml).join('')+'</div><button class="btn btn-ghost btn-sm" id="addLine" style="margin-top:.4rem">+ Linje</button></div>'+
    '<div class="grid2"><div><label>Fragt (ekskl. moms)</label><input type="number" id="q_ship" value="'+(q.shipping||0)+'"></div><div><label>Leveringstekst</label><input id="q_deliv" value="'+esc(q.delivery_text||'')+'"></div></div>'+
    '<div><label>Mockup-billede</label><input type="file" id="q_mock" accept="image/*"><small style="color:var(--muted)">'+(q.mockup_url?'Nuværende: <a href="'+esc(q.mockup_url)+'" target="_blank">se ↗</a>':'Upload leverandørens mockup, så kunden ser den øverst på tilbuddet.')+'</small></div>'+
    '<div class="linkbox">Kundens link: <a href="'+quoteUrl(q.code)+'" target="_blank">'+quoteUrl(q.code)+'</a></div>'+
    '<div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn btn-signal" id="saveQuote">Gem tilbud</button>'+(isNew?'':'<button class="btn btn-ghost btn-sm" id="delQuote" style="color:var(--bad);border-color:var(--bad)">Slet</button>')+'</div>'+
    '</div>';
  $('#drawer').classList.add('open');
  const readLines=()=>{const ls=[]; $$('#qlines .qline').forEach(row=>{const [t,qy,u]=$$('input',row); if(t.value.trim()) ls.push({title:t.value.trim(),qty:+qy.value||1,unit:+u.value||0})}); return ls};
  $('#addLine').onclick=()=>{q.lines=readLines(); q.lines.push({title:'',qty:1,unit:0}); $('#qlines').innerHTML=q.lines.map(lineHtml).join('')};
  $('#qlines').addEventListener('click',e=>{const b=e.target.closest('[data-del]'); if(!b) return; q.lines=readLines(); q.lines.splice(+b.dataset.del,1); $('#qlines').innerHTML=q.lines.map(lineHtml).join('')});
  $('#saveQuote').onclick=async()=>{
    const rec={code:q.code,lead_id:q.lead_id,org:$('#q_org').value,contact_name:$('#q_name').value,valid_until:$('#q_valid').value||null,status:$('#q_status').value,intro:$('#q_intro').value,lines:readLines(),shipping:+$('#q_ship').value||0,delivery_text:$('#q_deliv').value,mockup_url:q.mockup_url||null};
    const f=$('#q_mock').files[0];
    if(f){const path=q.code+'/'+f.name.replace(/[^a-zA-Z0-9._-]/g,'_'); const up=await sb.storage.from('mockups').upload(path,f,{upsert:true}); if(up.error) return alert('Mockup-upload fejlede: '+up.error.message); rec.mockup_url=sb.storage.from('mockups').getPublicUrl(path).data.publicUrl}
    const r=await sb.from('quotes').upsert(rec); if(r.error) return alert(r.error.message);
    if(q.lead_id){const l=leads.find(x=>x.id===q.lead_id); if(l&&['ny','kontakt'].includes(l.stage)&&rec.status!=='kladde'){await sb.from('leads').update({stage:'tilbud'}).eq('id',q.lead_id)} await sb.from('lead_events').insert({lead_id:q.lead_id,message:'Tilbud '+q.code+' '+(isNew?'oprettet':'opdateret')+' ('+rec.status+')',actor:'kenneth'})}
    await reload(); openQuote(quotes.find(x=>x.code===q.code));
  };
  const d=$('#delQuote'); if(d) d.onclick=async()=>{if(!confirm('Slet tilbuddet?')) return; await sb.from('quotes').delete().eq('code',q.code); closePane(); reload()};
}

/* ---------- Events ---------- */
document.addEventListener('click',e=>{
  const adv=e.target.closest('[data-advance]'); if(adv){e.stopPropagation(); advance(adv.dataset.advance,adv.dataset.to);return}
  const o=e.target.closest('[data-open]'); if(o){openLead(o.dataset.open);return}
  const dt=e.target.closest('#doneToggle'); if(dt){$('#doneList').hidden=!$('#doneList').hidden;return}
  const qb=e.target.closest('[data-quote]'); if(qb){openQuote(quotes.find(x=>x.code===qb.dataset.quote));return}
  if(e.target.closest('[data-close]')||e.target===$('#drawer')) closePane();
  const tab=e.target.closest('.atabs button'); if(tab){$$('.atabs button').forEach(b=>b.setAttribute('aria-selected',b===tab)); ['pipeline','kunder','produktion','tilbud'].forEach(v=>$('#v-'+v).hidden=v!==tab.dataset.view)}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape') closePane()});
$('#newLead').addEventListener('click',async()=>{const org=prompt('Forening / virksomhed:'); if(!org) return; const r=await sb.from('leads').insert({org,name:'',email:'',source:'manuelt',notes:'Oprettet manuelt i admin'}).select('id').single(); if(r.error) return alert(r.error.message); await reload(); openLead(r.data.id)});
$('#newQuote').addEventListener('click',()=>openQuote(null,null));
boot();
})();
