const app=document.querySelector('#app'), modal=document.querySelector('#modal'), toast=document.querySelector('#toast');
const storageKey='checkpoint-podkarpacie-v1';
const screens={plan:['Plan','route'],odkrywaj:['Odkrywaj','compass'],noclegi:['Noclegi','bed'],dziennik:['Dziennik','book'],ustawienia:['Ustawienia','gear']};
const icons={
 route:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M6 16V8a2 2 0 0 1 2-2h5m-1 12h4a2 2 0 0 0 2-2V8"/>',
 compass:'<circle cx="12" cy="12" r="8.5"/><path d="m15.8 8.2-2.3 5.3-5.3 2.3 2.3-5.3z"/>',
 bed:'<path d="M3 19V8m18 11v-6a2 2 0 0 0-2-2h-8v5M3 16h18M6 13V9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v4"/>',
 book:'<path d="M5 5a2 2 0 0 1 2-2h12v18H7a2 2 0 0 1 0-4h12M5 5v14m4-11h6m-6 4h4"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="m10 3-1 3-2 1-3-.5-1.5 2.6L4.5 12l-2 2.9L4 17.5l3-.5 2 1 1 3h4l1-3 2-1 3 .5 1.5-2.6-2-2.9 2-2.9L20 6.5 17 7l-2-1-1-3z"/>',
 pin:'<path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/>',
 calendar:'<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 4v4m8-4v4M4 11h16"/>',
 dice:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h.01M12 12h.01M16 16h.01"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 heart:'<path d="M20 9a4.3 4.3 0 0 0-8-2 4.3 4.3 0 0 0-8 2c0 4 8 9.5 8 9.5S20 13 20 9Z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 edit:'<path d="m5 15 10-10 4 4-10 10H5zm8-8 4 4"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',
 shuffle:'<path d="M3 7h3c3 0 5 10 8 10h6m-3-3 3 3-3 3M3 17h3c1 0 2-1 3-3m-4-4 4-3h7m-3-3 3 3-3 3"/>',
 mountain:'<path d="m3 19 7-13 4 7 2-3 5 9H3Zm5-9 2 2 2-2"/>',
 moon:'<path d="M19.5 15A8 8 0 0 1 9 4.5 8 8 0 1 0 19.5 15Z"/>',
};
const icon=name=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v).toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const param=encodeURIComponent;
const map=q=>'https://www.google.com/maps/search/?api=1&query='+param(q);
const reviewsLink=q=>'https://www.tripadvisor.com.pl/Search?q='+param(q);
const findStay=(q,d)=>'https://www.booking.com/searchresults.pl.html?ss='+param(q)+(d?.checkin?'&checkin='+d.checkin+'&checkout='+d.checkout:'');
const pointQuery=p=>p.mapQuery||[p.name,p.town,'Podkarpackie'].filter(Boolean).join(', ');
const external=(url,label,cls='button')=>`<a class="${cls}" href="${h(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
const act=(label,action,cls='',item='',glyph='')=>`<button type="button" class="${cls}" data-action="${action}" data-id="${h(item)}">${glyph?icon(glyph):''}${label}</button>`;
const options=(entries,selected)=>entries.map(([v,t])=>`<option value="${h(v)}"${v===selected?' selected':''}>${h(t)}</option>`).join('');
const regionOptions=Object.entries(regions).map(([id,r])=>[id,r.name]);
const daysText=n=>n===1?'1 dzień':n+' dni';
const dateText=(iso,full=false)=>iso?new Intl.DateTimeFormat('pl-PL',{day:'numeric',month:full?'long':'short',...(full?{year:'numeric'}:{}),timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z')):'';
const known=(obj,id)=>typeof id==='string'&&Object.hasOwn(obj,id);
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const bounded=(v,max)=>typeof v==='string'&&v.length<=max;
const seed={duration:3,mood:'mix',area:'all',origin:'Łańcut',date:''};
let storageWarning=false;
let state=readState();
const current=()=>state.trips.find(trip=>trip.id===state.active)||state.trips[0];
const firstOpen=trip=>{
 const index=trip.days.findIndex(day=>!day.complete);
 return index<0?trip.days.length-1:index;
};
let dayIndex=firstOpen(current()), duration=current().days.length;
const catalogTag=new URLSearchParams(location.search).get('katalog');
let catalog={query:'',region:'all',tag:known(categories,catalogTag)?catalogTag:'all',status:'all',limit:24};
let hotelSearch={query:'',radius:10,saved:false,location:null,results:[],status:'idle'}, selectingHotel=false;
let lodgingController, lodgingTimer;
let osm={loading:false,error:false,places:[]};
let toastTimer;
const photoUrls=[...new Set(Object.values(placePhotos).map(photo=>photo[0]))];
const photoOfferKey='checkpoint-podkarpacie-photo-offer';
const photoOfflineSupported=location.protocol!=='file:'&&'caches' in window&&'serviceWorker' in navigator;
const photoDownload={status:'idle',saved:0,checked:0};
let showPhotoOffer=true;
try{showPhotoOffer=localStorage.getItem(photoOfferKey)!=='seen';}catch{}

function readState() {
 try {const saved=localStorage.getItem(storageKey);if(saved)return validate(JSON.parse(saved));}
 catch {storageWarning=true;}
 const trip=buildTrip(seed);
 return {version:1,trips:[trip],active:trip.id,stars:[],hotels:[],liveStays:{},seen:{},ratings:{}};
}
function validate(raw) {
 if(!record(raw)||raw.version!==1||!Array.isArray(raw.trips)||!raw.trips.length||raw.trips.length>500||
 !Array.isArray(raw.stars)||!Array.isArray(raw.hotels)||!record(raw.seen)||!record(raw.ratings))throw Error('backup');
 const liveStays=Object.fromEntries(Object.values(record(raw.liveStays)?raw.liveStays:{}).map(normalizeSavedLodging).filter(Boolean).map(s=>[s.id,s]));
 const savedStay=id=>known(stayById,id)||known(liveStays,id);
 const ids=new Set();
 for(const t of raw.trips){
  if(!record(t)||!bounded(t.id,100)||!t.id||ids.has(t.id)||!bounded(t.name,90)||!t.name||!origins.includes(t.origin)||
  !known(moods,t.mood)||(t.area!=='all'&&!known(regions,t.area))||(t.date!==''&&!isoDay(t.date))||
  !Array.isArray(t.days)||t.days.length<1||t.days.length>14)throw Error('backup');
  ids.add(t.id);
  for(const d of t.days){
   if(!record(d)||!known(routeById,d.route)||!Array.isArray(d.ids)||!d.ids.length||d.ids.length>24||
   d.ids.some(id=>!known(placeById,id))||new Set(d.ids).size!==d.ids.length||!Array.isArray(d.done)||
   d.done.some(id=>!d.ids.includes(id))||new Set(d.done).size!==d.done.length||typeof d.complete!=='boolean'||
   !bounded(d.note,2000)||(d.stay!==null&&!savedStay(d.stay)))throw Error('backup');
  }
 }
 const seen=Object.fromEntries(Object.entries(raw.seen).filter(([id,v])=>known(placeById,id)&&v===true));
 const ratings=Object.fromEntries(Object.entries(raw.ratings).filter(([id,v])=>known(placeById,id)&&record(v)&&Number.isInteger(v.stars)&&v.stars>=1&&v.stars<=5&&bounded(v.note,500)));
 return {version:1,trips:raw.trips,active:ids.has(raw.active)?raw.active:raw.trips[0].id,seen,ratings,liveStays,
  stars:[...new Set(raw.stars.filter(id=>known(placeById,id)))],hotels:[...new Set(raw.hotels.filter(savedStay))]};
}
function save(message){
 try{localStorage.setItem(storageKey,JSON.stringify(state));storageWarning=false;if(message)notify(message);}
 catch{storageWarning=true;notify('Pamięć przeglądarki jest niedostępna. Pobierz kopię w ustawieniach.');}
}
function notify(message){toast.textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.textContent='';},4000);}
const screen=()=>Object.hasOwn(screens,location.hash.slice(1))?location.hash.slice(1):'plan';
const completed=t=>t.days.filter(d=>d.complete).length;
function render(){
 const page=screen();
 document.querySelector('#navigation').innerHTML=Object.entries(screens).map(([key,[label,glyph]])=>`<a href="#${key}" ${key===page?'class="active" aria-current="page"':''}>${icon(glyph)}<span>${label}</span></a>`).join('');
 app.innerHTML=({plan:planView,odkrywaj:catalogView,noclegi:hotelsView,dziennik:journalView,ustawienia:settingsView})[page]();
 if((page==='plan'||page==='odkrywaj')&&photoOfflineSupported){
  app.querySelector('.page-heading, .trip-hero').insertAdjacentHTML('afterend','<div id="photo-offer">'+photoDownloadOffer()+'</div>');
 }
 if(storageWarning)app.insertAdjacentHTML('afterbegin','<p class="panel muted">Zapis na tym urządzeniu jest niedostępny. Kopię możesz pobrać w ustawieniach.</p>');
}
function title(kicker,name,description=''){
 return `<header class="page-heading"><span class="eyebrow">${kicker}</span><h1>${name}</h1>${description?`<p class="muted">${description}</p>`:''}</header>`;
}

function plannerForm(t){
 return `<form id="planner" class="panel planner">
 <div class="planner-heading"><div><span class="eyebrow">Ułóż trasę</span><h2>Ile masz dni?</h2></div><span class="planner-note">${icon('calendar')} Od 1 dnia do 2 tygodni</span></div>
 <div class="duration-row" aria-label="Długość wycieczki">
 ${[1,2,3,4,5,7,14].map(n=>`<button type="button" class="duration${n===duration?' picked':''}" data-action="duration" data-id="${n}" aria-pressed="${n===duration}">${daysText(n)}</button>`).join('')}
 <label class="duration-input">Liczba dni<input aria-label="Własna liczba dni" name="duration" type="number" min="1" max="14" required value="${duration}"></label></div>
 <div class="planner-fields">
 <label>Start<select name="origin">${options(origins.map(c=>[c,c]),t.origin)}</select></label>
 <label>Rejon<select name="area">${options([['all','Całe Podkarpacie'],...regionOptions],t.area)}</select></label>
 <label>Klimat wycieczki<select name="mood">${options(Object.entries(moods),t.mood)}</select></label>
 <label>Data startu <small>opcjonalnie</small><input name="date" type="date" value="${h(t.date)}"></label>
 <button class="primary build-button" type="submit">${icon('route')} Ułóż wycieczkę</button>
 </div></form>`;
}
function planView(){
 const t=current(), d=t.days[dayIndex], r=routeById[d.route], n=completed(t);
 return `<section class="hero trip-hero" aria-labelledby="hero-title">
 <div class="hero-content"><span class="eyebrow hero-kicker">${icon('pin')} Województwo podkarpackie</span>
 <h1 id="hero-title">Podkarpacie<br>w twoim tempie.</h1>
 <p>Zamki, połoniny i miejsca na spokojny weekend. Wybierz liczbę dni i ruszaj po swoje checkpointy.</p>
 <div class="actions">${act('Zaplanuj wyjazd','start','primary','','route')}${act('Zaskocz mnie','surprise','glass','','dice')}</div></div>
 <div class="hero-caption">${icon('mountain')} Ilustracja Bieszczadów</div></section>
 ${plannerForm(t)}
 <section class="itinerary" aria-labelledby="itinerary-heading">
 <header class="section-head"><div><span class="eyebrow">Aktywna wycieczka</span><h2 id="itinerary-heading">${h(t.name)}</h2>
 <p class="muted">${h(t.origin)} · ${daysText(t.days.length)}${t.date?' · '+dateText(t.date,true):''}</p></div>${act('Edytuj wycieczkę','edit-trip','secondary','','edit')}</header>
 <div class="progress"><div class="bar" role="progressbar" aria-label="Zakończone dni" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="${t.days.length}"><i style="width:${n/t.days.length*100}%"></i></div><span>${n} z ${t.days.length} dni</span></div>
 <div class="day-tabs" aria-label="Dni wycieczki">${t.days.map((day,index)=>`<button type="button" class="day-tab${dayIndex===index?' chosen':''}" aria-pressed="${dayIndex===index}" data-action="day" data-id="${index}"><strong>Dzień ${index+1}${day.complete?icon('check'):''}</strong><small>${t.date?dateText(isoDay(t.date,index)):h(routeById[day.route].base)}</small></button>`).join('')}</div>
 <div class="day-layout">
 <article class="panel route-card"><span class="eyebrow ${d.complete?'mint':''}">${d.complete?'Dzień zakończony':h(regions[routeRegion(r)].name)}</span><h3>${h(dayTitle(d,t.mood))}</h3>
 <div class="stops">${d.ids.map((id,index)=>stopRow(placeById[id],d,index)).join('')}</div>
 ${d.note?`<p class="day-note">${h(d.note)}</p>`:''}
 <div class="actions route-actions">${act(d.complete?'Otwórz dzień ponownie':'Zakończ dzień','finish','primary','','check')}
 ${act('Notatka','note','secondary','','edit')}${d.complete?'':act('Zmień dzień','alternatives','secondary','','shuffle')}${act('Dodaj punkt','add-stop','secondary','','plus')}${routeLink(d)}</div></article>
 ${staySuggestion(t,d,r)}</div></section>
 <section class="featured"><header class="section-head"><div><span class="eyebrow">Polecajki z katalogu</span><h2>Następne checkpointy</h2></div><a href="#odkrywaj" class="button secondary">Zobacz katalog</a></header>
 <div class="feature-grid">${(t.mood==='natura'?featuredNature(routeRegion(r)):['lancut','gondola','wetlinska'].map(id=>placeById[id])).map(p=>placeCard(p,true)).join('')}</div></section>`;
}
function featuredNature(region){
 const trails=natureTrails.filter(p=>p.tags.includes('widokowy'));
 return [...trails.filter(p=>p.region===region),...trails.filter(p=>p.region!==region)].slice(0,3);
}
function stopRow(p,d,index){
 const done=d.done.includes(p.id);
 return `<div class="stop"><button type="button" class="tick${done?' checked':''}" aria-label="${done?'Cofnij odwiedzenie':'Oznacz odwiedzone'}: ${h(p.name)}" aria-pressed="${done}" data-action="toggle-stop" data-id="${p.id}">${done?icon('check'):index+1}</button>
 <button type="button" class="stop-name" data-action="place" data-id="${p.id}"><strong>${h(p.name)}</strong><small>${h(p.town)} · ${categories[p.tags[0]]}</small></button>
 <button type="button" class="icon-button stop-remove" aria-label="Usuń z dnia: ${h(p.name)}" data-action="remove-stop" data-id="${p.id}" ${d.ids.length===1?'disabled':''}>${icon('close')}</button></div>`;
}
function routeLink(d){
 const start=placeById[d.ids[0]];
 if(start.trailhead)return external(map(start.trailhead),'Mapa startu szlaku','button secondary');
 const points=d.ids.map(id=>pointQuery(placeById[id]));
 if(points.length===1||points.length>5||d.ids.some(id=>placeById[id].tags.includes('szlak')))return external(map(points[0]),'Mapa pierwszego punktu','button secondary');
 const waypoints=points.slice(1,-1).join('|');
 const url='https://www.google.com/maps/dir/?api=1&origin='+param(points[0])+'&destination='+param(points.at(-1))+(waypoints?'&waypoints='+param(waypoints):'');
 return external(url,'Mapa przejazdu','button secondary');
}
function staySuggestion(t,d,r){
 if(dayIndex===t.days.length-1)return `<aside class="panel sleep-card"><span class="card-icon">${icon('moon')}</span><span class="eyebrow">Ostatni dzień</span><h3>Powrót</h3><p class="muted">Jeśli zostajesz dłużej, sprawdź noclegi w okolicy.</p>
 <div class="actions">${external(findStay(r.base+', Polska'),'Booking.com','button secondary')}${act('Katalog noclegów','show-hotels','secondary',routeRegion(r))}</div></aside>`;
 const hotel=stayById[d.stay]||state.liveStays[d.stay], where=hotel?.town||hotel?.searchTown||r.base, dates=getStayDates(t,dayIndex);
 return `<aside class="panel sleep-card"><span class="card-icon">${icon('bed')}</span><span class="eyebrow">${hotel?'Zapisany nocleg':'Propozycja noclegu'}</span><h3>${h(hotel?.name||where)}</h3>
 <p class="muted">${hotel?h(where)+' · ':''}${dates.checkin?dateText(dates.checkin)+' – '+dateText(dates.checkout):'Baza wypadowa po dniu '+(dayIndex+1)}</p>
 <div class="actions">${external(findStay((hotel?hotel.name+', ':'')+where+', Polska',dates),'Booking.com','button primary')}
 ${act(hotel?'Zmień nocleg':'Wybierz nocleg','choose-hotel','secondary',routeRegion(r))}${hotel?act('Odepnij','remove-hotel','quiet'):''}</div></aside>`;
}
const placeArtIcons={natura:'mountain',szlak:'mountain',szczyt:'mountain',widokowy:'compass',zabytki:'pin',rodzina:'compass',muzeum:'book',relaks:'compass'};
function dismissPhotoOffer(){
 showPhotoOffer=false;
 try{localStorage.setItem(photoOfferKey,'seen');}catch{}
}
function photoDownloadControls(){
 const {status,saved,checked}=photoDownload, total=photoUrls.length;
 if(!photoOfflineSupported)return '<p class="muted">Pobieranie offline wymaga przeglądarki z obsługą pamięci podręcznej aplikacji.</p>';
 const loading=status==='loading', done=status==='done';
 const message=loading?'Pobieranie miniatur…':done?'Zdjęcia zapisane do użycia offline.':
  status==='partial'?('Zapisano '+saved+' z '+total+' zdjęć. Spróbuj pobrać pozostałe ponownie.'):
  status==='error'?'Pobieranie przerwane. Spróbuj ponownie po połączeniu z internetem.':
  'Zapisz '+total+' miniatur na tym urządzeniu, żeby wyświetlały się także bez internetu.';
 return `<p class="muted photo-download-status" role="status">${message}</p>
 ${loading?`<div class="photo-download-progress"><progress max="${total}" value="${checked}" aria-label="Postęp pobierania zdjęć"></progress><span>${checked} / ${total}</span></div>`:''}
 <div class="actions photo-download-actions">${loading||done?'':act(status==='partial'?'Pobierz brakujące':'Pobierz zdjęcia offline','download-photos','primary')}</div>`;
}
function photoDownloadOffer(){
 if(!showPhotoOffer)return '';
 return `<section class="panel photo-offer" aria-label="Zdjęcia offline"><h2>Zdjęcia offline</h2>
 <div data-photo-download>${photoDownloadControls()}</div>
 ${act(photoDownload.status==='done'?'Zamknij':'Później','dismiss-photos','quiet')}</section>`;
}
function refreshPhotoDownload(){
 const offer=document.querySelector('#photo-offer');
 if(offer){
  const active=offer.contains(document.activeElement);
  offer.innerHTML=photoDownloadOffer();
  if(active)(offer.querySelector('[data-action="dismiss-photos"]')??app.querySelector('h1'))?.focus({preventScroll:true});
 }
 const settings=document.querySelector('#photo-settings');
 if(settings)settings.innerHTML=photoDownloadControls();
}
async function startPhotoDownload(){
 if(!photoOfflineSupported||photoDownload.status==='loading')return;
 photoDownload.status='loading';
 refreshPhotoDownload();
 try{
  photoDownload.saved=await downloadPhotoPack(photoUrls,(saved,checked)=>{
   Object.assign(photoDownload,{saved,checked});
   for(const bar of app.querySelectorAll('.photo-download-progress')){
    bar.querySelector('progress').value=checked;
    bar.querySelector('span').textContent=checked+' / '+photoUrls.length;
   }
  });
  photoDownload.status=photoDownload.saved===photoUrls.length?'done':'partial';
  if(photoDownload.status==='done'){
   try{localStorage.setItem(photoOfferKey,'seen');}catch{}
  }
 }catch{photoDownload.status='error';}
 refreshPhotoDownload();
}
async function restorePhotoDownload(){
 if(!photoOfflineSupported)return;
 try{
  if(!(await caches.has(photoCacheName)))return;
  const stored=await storedPhotoUrls(await caches.open(photoCacheName));
  if(photoDownload.status!=='idle')return;
  const saved=photoUrls.filter(url=>stored.has(url)).length;
  if(!saved)return;
  Object.assign(photoDownload,{saved,status:saved===photoUrls.length?'done':'partial'});
  refreshPhotoDownload();
 }catch{}
}
function photoAttribution(id){
 const photo=placePhotos[id];
 if(!photo)return '';
 const [,file,author,license]=photo;
 const label=license==='pd'?'Domena publiczna':license==='cc0'?'CC0 1.0':'CC '+license.replace('/',' ').replace('/pl',' PL').toUpperCase();
 const rights=license==='pd'?'':license==='cc0'?'https://creativecommons.org/publicdomain/zero/1.0/':'https://creativecommons.org/licenses/'+license+'/';
 return external(file,h(author),'source-link')+' · '+(rights?external(rights,label,'source-link'):label);
}
function placeCard(p,featured=false){
 const saved=state.stars.includes(p.id), visited=state.seen[p.id], name=h(p.name), photo=placePhotos[p.id];
 const image=photo?' <img src="'+h(photo[0])+'" class="place-photo" alt="" loading="lazy" decoding="async">':'';

 return `<article class="place-card ${featured?'featured-card':''} region-${p.region}">
 <div class="place-art"><span class="place-art-icon" aria-hidden="true">${icon(placeArtIcons[p.tags[0]])}</span>${image}<div class="card-tags"><span>${categories[p.tags[0]]}</span>${visited?'<span class="mint">Odwiedzone</span>':''}</div>
 ${p.live?'':`<button type="button" aria-label="${saved?'Usuń z zapisanych':'Zapisz miejsce'}: ${name}" class="icon-button bookmark${saved?' is-saved':''}" aria-pressed="${saved}" data-action="star" data-id="${h(p.id)}">${icon('heart')}</button>`}</div>
 <button type="button" class="place-body" data-action="place" data-id="${h(p.id)}"><small>${icon('pin')} ${h(p.town||regions[p.region].name)}${p.elevation?` · ${p.elevation} m n.p.m.`:''}</small><strong>${name}</strong>${featured||p.catalogOnly?'':`<span>${h(p.description)}</span>`}</button></article>`;
}

function catalogView(){
 return title('Katalog Podkarpacia','Odkrywaj miejsca','Zapisuj polecajki, sprawdzaj opinie i dodawaj przystanki do wycieczki.')+
 `<section class="panel filters-panel"><div class="actions catalog-shortcuts" aria-label="Skróty katalogu">${catalogShortcuts()}</div><div class="filter-grid">
 <label>Szukaj miejsca<input type="search" id="place-search" value="${h(catalog.query)}" placeholder="np. Tarnica, Liwocz, wodospad"></label>
 <label>Rejon<select id="place-region">${options([['all','Wszystkie rejony'],...regionOptions],catalog.region)}</select></label>
 <label>Typ miejsca<select id="place-tag">${options([['all','Wszystkie typy'],...Object.entries(categories)],catalog.tag)}</select></label>
 <label>Twoje miejsca<select id="place-status">${options([['all','Wszystkie miejsca'],['saved','Zapisane'],['visited','Odwiedzone']],catalog.status)}</select></label>
 </div><div class="actions">${act(catalog.tag==='szczyt'?'Wylosuj szczyt':'Poleć mi miejsce','surprise','primary','','dice')}${act('Wyczyść filtry','reset','secondary')}</div></section>
 <details class="panel osm-panel"><summary>Więcej miejsc z OpenStreetMap</summary><p class="muted">Pobierz punkty z otwartej bazy w pobliżu centrum wybranego rejonu. Domyślnie sprawdzamy okolice Rzeszowa.</p>
 <div class="actions">${act('Pobierz z OpenStreetMap','osm','secondary','','pin')}${external(sources.extract,'Dane regionu w Geofabrik','source-link')}</div>
 <div id="osm-results">${osmOutput()}</div></details>
 <section aria-label="Wyniki katalogu" id="place-results">${placeResults()}</section>`;
}
function catalogShortcuts(){
 return [['all','Wszystkie'],['natura','Natura'],['szczyt','Szczyty Bieszczadów'],['widokowy','Szlaki widokowe']].map(([id,label])=>`<button type="button" data-action="catalog-type" data-id="${id}" class="secondary" aria-pressed="${catalog.tag===id}">${label}</button>`).join('');
}
function filteredPlaces(){
 const q=norm(catalog.query).trim();
 const list=destinations.filter(p=>(catalog.region==='all'||p.region===catalog.region)&&(catalog.tag==='all'||p.tags.includes(catalog.tag))&&
 (catalog.status==='all'||(catalog.status==='saved'?state.stars.includes(p.id):state.seen[p.id]))&&
 (!q||norm([p.name,p.town,p.elevation,p.aliases,p.itinerary,p.description,regions[p.region].name,...p.tags].join(' ')).includes(q)));
 if(catalog.tag==='szczyt')return list.sort((a,b)=>(b.elevation??0)-(a.elevation??0)||a.name.localeCompare(b.name,'pl'));
 if(catalog.tag==='natura')return list.sort((a,b)=>Number(!!b.itinerary)-Number(!!a.itinerary));
 return list;
}
function placeResults(){
 const list=filteredPlaces();
 const visible=list.slice(0,catalog.limit);
 const description=catalog.tag==='szczyt'?'Opisane dojścia znajdziesz w kartach powiązanych szlaków.':'';
 return `<p class="result-count">${list.length} miejsc${description?' · '+description:''}</p>`+
 (visible.length?`<div class="feature-grid catalog-grid">${visible.map(p=>placeCard(p)).join('')}</div>`:'<p class="panel muted">Brak miejsc pasujących do filtrów.</p>')+
 (visible.length<list.length?`<div class="actions catalog-more">${act('Pokaż więcej','catalog-more','secondary')}</div>`:'');
}
const mapCenters={centrum:[50.04,22.01],san:[49.78,22.77],bieszczady:[49.19,22.55],solina:[49.4,22.44],beskid:[49.68,21.77],roztocze:[50.19,23.36]};
function osmOutput(){
 if(osm.loading)return '<p class="result-count" role="status">Pobieram punkty z OpenStreetMap…</p>';
 if(osm.error)return '<p class="result-count" role="status">Pobranie się nie udało. Wróć do katalogu albo otwórz mapę.</p>'+external('https://www.openstreetmap.org/#map=9/49.95/22.05','Otwórz OpenStreetMap','source-link');
 if(!osm.places.length)return osm.finished?'<p class="result-count">Brak dodatkowych punktów.</p>':'';
 return `<p class="result-count">${osm.places.length} dodatkowych miejsc · ${external(sources.osm,'© autorzy OpenStreetMap (ODbL)','source-link')}</p><div class="feature-grid catalog-grid">${osm.places.map(p=>placeCard(p)).join('')}</div>`;
}
async function loadOsm(){
 if(osm.loading)return;
 const region=catalog.region==='all'?'centrum':catalog.region,[lat,lon]=mapCenters[region];
 const query=`[out:json][timeout:12];area["ISO3166-2"="PL-18"]->.r;nwr["tourism"~"^(attraction|museum|viewpoint|zoo|theme_park)$"]["name"](area.r)(${lat-.13},${lon-.19},${lat+.13},${lon+.19});out center 35;`;
 const request={loading:true,error:false,places:[]};
 osm=request;
 const update=()=>{const el=document.querySelector('#osm-results');if(el&&osm===request)el.innerHTML=osmOutput();};
 update();
 try{
  const result=await fetch('https://overpass.private.coffee/api/interpreter?data='+param(query),{signal:AbortSignal.timeout(16000),credentials:'omit'});
  if(!result.ok)throw Error('osm');
  const data=await result.json(), names=new Set(destinations.map(p=>norm(p.name)));
  const types={museum:'muzeum',viewpoint:'natura',zoo:'rodzina',theme_park:'rodzina',attraction:'zabytki'};
  request.places=data.elements.flatMap(item=>{
   const name=item.tags?.name, y=item.lat??item.center?.lat, x=item.lon??item.center?.lon;
   if(!bounded(name,180)||!name||!Number.isFinite(x)||!Number.isFinite(y)||names.has(norm(name))||
   !['node','way','relation'].includes(item.type)||!Number.isInteger(item.id))return [];
   names.add(norm(name));
   return [{id:'osm-'+item.type+'-'+item.id,name,town:item.tags['addr:city']||'',region,tags:[types[item.tags.tourism]||'zabytki'],
    description:'Punkt z otwartej bazy OpenStreetMap.',mapQuery:y+','+x,live:true,website:'https://www.openstreetmap.org/'+item.type+'/'+item.id}];
  }).slice(0,18);
 }catch{request.error=true;}
 finally{request.loading=false;request.finished=true;update();}
}

function hotelDates(){return selectingHotel?getStayDates(current(),dayIndex):null;}
function hotelLinks(dates){
 const town=hotelSearch.location?.town||hotelSearch.query.trim();
 const destination=town||'Podkarpackie';
 return external(findStay(destination+', Polska',dates),'Sprawdź na Booking.com','button primary')+
 external(reviewsLink(destination+' noclegi'),'Opinie na Tripadvisor','button secondary');
}
function hotelsView(){
 const dates=hotelDates();
 return title('Noclegi','Znajdź nocleg','Wpisz miejscowość i wybierz, jak daleko szukać.')+
 (selectingHotel?`<div class="panel attachment-strip"><p>Wybierasz nocleg po dniu ${dayIndex+1}${dates.checkin?' · '+dateText(dates.checkin)+' – '+dateText(dates.checkout):''}</p>${act('Anuluj wybór','cancel-hotel','secondary')}</div>`:'')+
 `<section class="panel filters-panel">
 <form id="hotel-location-form" class="filter-grid hotel-filters">
 <label>Miejscowość<input type="search" id="hotel-search" name="location" list="hotel-towns" maxlength="100" required value="${h(hotelSearch.query)}" placeholder="np. Polańczyk, Łańcut, Wetlina"></label>
 <datalist id="hotel-towns">${options(Object.keys(lodgingTowns).map(town=>[town,town]),'')}</datalist>
 <label>Promień<select id="hotel-radius" name="radius">${options(lodgingRadii.map(n=>[String(n),n+' km']),String(hotelSearch.radius))}</select></label>
 <button type="submit" class="primary">${icon('pin')} Szukaj noclegów</button>
 </form>
 <label class="check-label"><input type="checkbox" id="hotel-saved" ${hotelSearch.saved?'checked':''}> Tylko zapisane</label>
 <div class="actions" id="hotel-links">${hotelLinks(dates)}</div>
 <p class="muted provider-note">Ceny i dostępność sprawdzisz na stronie rezerwacji. Dane o obiektach: ${external(sources.osm,'© autorzy OpenStreetMap','source-link')}.</p></section>
 <section aria-label="Wyniki noclegów" id="hotel-results">${hotelResults(dates)}</section>`;
}
function nearbyCatalog(location,radius){
 if(!location)return [];
 return stays.flatMap(stay=>{
  const point=lodgingTowns[stay.town];
  if(!point || lodgingDistance(location.point,point)>radius)return [];
  return [stay];
 });
}
function hotelResults(dates){
 const {saved,location,results,status,radius}=hotelSearch;
 let list=results, note='';
 if(saved){
  list=state.hotels.map(id=>stayById[id]||state.liveStays[id]).filter(Boolean);
  note=list.length?'Zapisane noclegi: '+list.length:'Zapisz nocleg sercem, żeby widzieć go tutaj.';
 }else if(status==='idle'){
  note='Wpisz miejscowość albo wybierz ją z podpowiedzi.';
 }else if(status==='loading'){
  note='Szukam noclegów…';
 }else if(status==='unknown'){
  note='Nie udało się rozpoznać miejscowości. Sprawdź pisownię lub wybierz podpowiedź.';
 }else if(status==='error'){
  list=nearbyCatalog(location,radius);
  note=list.length?'Mapa chwilowo niedostępna. Poniżej noclegi z katalogu w okolicy '+location.town+'.':'Nie udało się pobrać noclegów. Możesz ponowić wyszukiwanie lub sprawdzić Booking.com.';
 }else{
  note=list.length?location.town+' · '+list.length+' wyników w promieniu '+radius+' km':'Brak oznaczonych noclegów w pobliżu '+location.town+'. Zwiększ promień.';
 }
 return `<p class="result-count" role="status">${h(note)}</p>`+(list.length?`<div class="hotel-grid">${list.map(s=>hotelCard(s,dates)).join('')}</div>`:'');
}
function hotelCard(s,dates){
 const saved=state.hotels.includes(s.id), town=s.town||s.searchTown;
 const query=[s.name,town,'Polska'].filter(Boolean).join(', ');
 const meta=[town,s.type,Number.isFinite(s.distance)?(s.distance<1?Math.round(s.distance*1000)+' m':new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1}).format(s.distance)+' km')+' w linii prostej':''].filter(Boolean).join(' · ');
 return `<article class="panel hotel-card"><div class="hotel-top"><span class="card-icon">${icon('bed')}</span>
 <button type="button" aria-label="${saved?'Usuń z zapisanych':'Zapisz nocleg'}: ${h(s.name)}" aria-pressed="${saved}" class="icon-button${saved?' is-saved':''}" data-action="save-hotel" data-id="${h(s.id)}">${icon('heart')}</button></div>
 <small>${h(meta)}</small><h2>${h(s.name)}</h2>
 <div class="actions">${external(findStay(query,dates),'Booking.com','button secondary')}${external(reviewsLink(query),'Tripadvisor','button secondary')}
 ${external(map(Number.isFinite(s.lat)?s.lat+','+s.lon:query),'Mapa','button secondary')}${selectingHotel?act('Przypnij nocleg','attach-hotel','primary',s.id):''}</div></article>`;
}
function refreshHotels(){
 const results=document.querySelector('#hotel-results'), links=document.querySelector('#hotel-links');
 if(results&&links){const dates=hotelDates();results.innerHTML=hotelResults(dates);links.innerHTML=hotelLinks(dates);}
}
function resetLodgingRequest(){
 clearTimeout(lodgingTimer);
 lodgingController?.abort();
 lodgingController=null;
}
function changeHotelLocation(query, radius=hotelSearch.radius){
 resetLodgingRequest();
 Object.assign(hotelSearch,{query,radius,status:'idle',location:null,results:[],saved:false});
 const saved=document.querySelector('#hotel-saved');
 if(saved)saved.checked=false;
 refreshHotels();
}
async function searchHotels(){
 resetLodgingRequest();
 const query=hotelSearch.query.trim(), radius=hotelSearch.radius;
 if(query.length<2)return;
 const controller=new AbortController();
 lodgingController=controller;
 hotelSearch.status='loading';
 refreshHotels();
 try{
  const location=await findLodgingLocation(query,controller.signal);
  if(controller.signal.aborted)return;
  hotelSearch.location=location;
  if(!location){hotelSearch.status='unknown';return;}
  refreshHotels();
  const results=await findLodging(location,radius,controller.signal);
  if(controller.signal.aborted)return;
  hotelSearch.results=results;
  hotelSearch.status='ready';
 }catch{
  if(!controller.signal.aborted)hotelSearch.status='error';
 }finally{
  if(!controller.signal.aborted){lodgingController=null;refreshHotels();}
 }
}
function rememberLodging(id){
 if(stayById[id]||state.liveStays[id])return true;
 const stay=normalizeSavedLodging(hotelSearch.results.find(s=>s.id===id));
 if(!stay)return false;
 state.liveStays[id]=stay;
 return true;
}

function journalView(){
 const ratings=Object.entries(state.ratings).sort(([,a],[,b])=>b.stars-a.stars);
 const seen=Object.keys(state.seen);
 return title('Twoje wyjazdy','Dziennik podróży','Wróć do planu, sprawdź odwiedzone miejsca i swoje oceny.')+`
 <div class="summary-grid">${[[state.trips.length,'Wycieczki'],[seen.length,'Odwiedzone miejsca'],[ratings.length,'Twoje oceny'],[state.stars.length,'Zapisane miejsca']].map(([n,label])=>`<article class="panel"><strong class="number">${n}</strong><p>${label}</p></article>`).join('')}</div>
 <header class="section-head"><h2>Zapisane wycieczki</h2><a class="button secondary" href="#plan">Otwórz planer</a></header>
 <div class="journal-list">${state.trips.map(t=>`<article class="panel journal-trip"><div><span class="eyebrow">${t.id===state.active?'Aktywna wycieczka':h(t.origin)}</span><h3>${h(t.name)}</h3>
 <p class="muted">${daysText(t.days.length)} · ${completed(t)} z ${t.days.length} dni ukończonych${t.date?' · '+dateText(t.date,true):''}</p></div>
 <div class="actions">${act('Otwórz plan','open-trip','secondary',t.id)}${state.trips.length>1?act('Usuń','delete-trip','quiet',t.id):''}</div>
 ${t.days.some(d=>d.note)?`<details><summary>Notatki z podróży</summary>${t.days.map((d,i)=>d.note?`<p class="journal-note"><strong>Dzień ${i+1}</strong> ${h(d.note)}</p>`:'').join('')}</details>`:''}</article>`).join('')}</div>
 <header class="section-head"><h2>Moje oceny</h2></header>
 ${ratings.length?`<div class="journal-list">${ratings.map(([id,r])=>`<article class="panel rating-row"><div><h3>${h(placeById[id].name)}</h3><p class="muted">${h(r.note)}</p></div><div class="actions"><strong class="stars" aria-label="${r.stars} na 5 gwiazdek">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</strong>${act('Edytuj','rate','secondary',id)}</div></article>`).join('')}</div>`:'<p class="panel muted">Oceń miejsce, otwierając jego kartę w planie lub katalogu.</p>'}
 <header class="section-head"><h2>Odwiedzone miejsca</h2></header>
 ${seen.length?`<div class="actions">${seen.map(id=>act(h(placeById[id].name),'place','secondary',id,'check')).join('')}</div>`:'<p class="panel muted">Zaznacz odwiedzone przystanki w planie.</p>'}`;
}
function settingsView(){
 return title('Checkpoint Podkarpacie','Ustawienia')+`<div class="settings-grid">
 <section class="panel settings-card"><h2>Kopia wycieczek i ocen</h2><p class="muted">Plany, zapisane miejsca, notatki i oceny są zapisywane w tej przeglądarce. Pobierz kopię, by przenieść je na inne urządzenie.</p>
 <div class="actions">${act('Pobierz kopię','export','primary')}${act('Wczytaj kopię','import','secondary')}<input type="file" id="backup-file" accept=".json,application/json" hidden></div></section>
 <section class="panel settings-card"><h2>Źródła katalogu</h2><p class="muted">Przystanki opracowano na podstawie regionalnych materiałów i stron atrakcji.</p>
 ${external(sources.travel,'Podkarpackie Travel','source-link')}${external(sources.region,'Portal województwa','source-link')}
 ${external(sources.extract,'Wyciąg OpenStreetMap · Geofabrik','source-link')}
 ${external(natureSources.peaks,'Wykaz szczytów Bieszczadów · nawierch.pl / OSM','source-link')}
 ${external(natureSources.peakWiki,'Szczyty Bieszczadów Zachodnich · Wikipedia','source-link')}
 ${external(natureSources.crown,'Korona Bieszczadów · PTTK','source-link')}
 ${external(natureSources.pttk,'Mapa szlaków na Podkarpaciu · PTTK','source-link')}${external(sources.registry,'Centralny Wykaz Obiektów Hotelarskich','source-link')}
 ${external(sources.osm,'© autorzy OpenStreetMap · ODbL','source-link')}</section>
 <section class="panel settings-card"><h2>Zdjęcia offline</h2><div id="photo-settings">${photoDownloadControls()}</div>
 <details class="photo-credits"><summary>Autorzy zdjęć i licencje</summary>${photoCredits()}</details></section></div>`;
}
function photoCredits(){
 const credits=destinations.filter(p=>placePhotos[p.id]).map(p=>'<li>'+h(p.name)+' · '+photoAttribution(p.id)+'</li>').join('');
 return '<p class="muted">Ilustracja nagłówka inspirowana Bieszczadami. Zdjęcia kart są kadrowane.</p>'+
 '<details class="photo-credits"><summary>Autorzy i licencje zdjęć miejsc</summary><ul>'+credits+'</ul></details>';
}
function dialog(title,body){
 if(modal.open)modal.close();
 modal.innerHTML=`<div class="dialog-head"><h2 id="dialog-title">${h(title)}</h2><button type="button" aria-label="Zamknij" class="icon-button" data-action="close">${icon('close')}</button></div>${body}`;
 modal.showModal();
}
function formDialog(title,body,label,submit){
 dialog(title,`<form>${body}<button class="primary" type="submit">${label}</button></form>`);
 modal.querySelector('form').addEventListener('submit',e=>{
  e.preventDefault();
  if(submit(new FormData(e.currentTarget))===false)return;
  modal.close();
  render();
 });
}
function trailDetails(p){
 if(!p.itinerary)return '';
 return `<div class="trail-details"><strong>Przebieg</strong><p>${h(p.itinerary)}</p>
 <strong>Początek</strong><p>${h(p.trailhead)}</p></div>
 ${p.park?`<p class="muted trail-access">Sprawdź aktualne komunikaty BdPN. W parku trzymaj się udostępnionych szlaków.</p>`:''}`;
}
function peakTrailLinks(p){
 const related=summitTrailIds[p.summitKey||p.id]??[];
 if(!related.length)return '';
 return `<div class="trail-details"><strong>Szlaki w tej okolicy</strong><div class="actions">
 ${related.map(slug=>placeById['trail-'+slug]).filter(Boolean).map(t=>act(h(t.name),'place','secondary',t.id)).join('')}
 </div></div>`;
}
function placeActions(p){
 if(p.itinerary)return external(map(p.trailhead),'Mapa startu','button primary')+
  external(p.website,'Przewodnik po szlaku','button secondary')+(p.park?external(natureSources.park,'Komunikaty BdPN','button secondary'):'');
 if(p.catalogOnly)return external(map(pointQuery(p)),p.mapQuery?'Punkt szczytu na mapie':'Szukaj szczytu na mapie','button secondary')+external(p.website,'Źródło danych','button secondary');
 return external(map(p.trailhead||pointQuery(p)),p.trailhead?'Mapa startu':'Mapa','button primary')+
  external(reviewsLink(pointQuery(p)),'Tripadvisor','button secondary')+
  external(p.website||sources.travel,p.website?(p.live?'OpenStreetMap':'Strona miejsca'):'Portal turystyczny','button secondary');
}
function openPlace(id){
 const p=placeById[id]||osm.places.find(p=>p.id===id);
 if(!p)return;
 const dayOptions=current().days.map((d,i)=>[String(i),'Dzień '+(i+1)+' · '+dayTitle(d,current().mood)]);
 const rating=state.ratings[id], photo=placePhotos[id];
 dialog(p.name,`<p class="eyebrow">${h(p.town||regions[p.region].name)} · ${p.tags.map(t=>categories[t]).join(' · ')}</p>
 ${photo?`<figure class="place-preview"><img class="place-photo" src="${h(photo[0])}" alt="${h(photo[4]||p.name)}" decoding="async">
 <figcaption class="place-credit">${photo[4]?h(photo[4])+' · ':''}${photoAttribution(id)}</figcaption></figure>`:''}
 <p class="place-description">${p.elevation?'<strong>'+p.elevation+' m n.p.m.</strong> · ':''}${h(p.description)}</p>
 ${trailDetails(p)}
 ${p.catalogOnly?'<p class="muted trail-access">Położenie wierzchołka. Dostęp sprawdź na mapie szlaków i w komunikatach zarządcy terenu.</p>':''}
 ${peakTrailLinks(p)}
 <div class="actions">${placeActions(p)}</div>
 ${p.live?'':`<div class="actions dialog-actions">${act(state.stars.includes(id)?'Usuń z zapisanych':'Zapisz miejsce','star','secondary',id,'heart')}
 ${act(rating?'Twoja ocena: '+rating.stars+'/5':'Oceń miejsce','rate','secondary',id)}${act(state.seen[id]?'Cofnij odwiedzenie':'Oznacz odwiedzone','visit-place','secondary',id,'check')}</div>
 ${p.catalogOnly?'':`<form id="add-placement"><label>Dodaj do wycieczki<select name="day">${options(dayOptions,String(dayIndex))}</select></label><button type="submit">${icon('plus')} Dodaj przystanek</button></form>`}`}`);
 modal.querySelector('#add-placement')?.addEventListener('submit',e=>{
  e.preventDefault();
  if(addPoint(id,Number(new FormData(e.currentTarget).get('day')))){modal.close();render();}
 });
}
function rate(id){
 const old=state.ratings[id];
 formDialog(placeById[id].name,`<label>Twoja ocena<select name="stars">${options([5,4,3,2,1].map(n=>[String(n),n+' / 5']),String(old?.stars??5))}</select></label>
 <label>Wrażenia<textarea maxlength="500" rows="3" name="note">${h(old?.note)}</textarea></label>${old?act('Usuń ocenę','clear-rating','quiet',id):''}`,'Zapisz ocenę',v=>{
  state.ratings[id]={stars:Number(v.get('stars')),note:v.get('note').trim()};
  save('Zapisano ocenę.');
 });
}
function addPoint(id,index){
 const day=current().days[index];
 if(!known(placeById,id)||placeById[id].catalogOnly||!day||day.ids.includes(id)){notify('To miejsce jest już w wybranym dniu.');return false;}
 if(day.ids.length>=24){notify('Dzień mieści maksymalnie 24 przystanki.');return false;}
 day.ids.push(id);
 day.complete=false;
 save('Dodano przystanek do dnia '+(index+1)+'.');
 return true;
}
function toggle(list,id){
 const index=list.indexOf(id);
 if(index<0)list.push(id);
 else list.splice(index,1);
}
function openTrip(trip){
 state.active=trip.id;
 dayIndex=firstOpen(trip);
 duration=trip.days.length;
 selectingHotel=false;
 save();
 if(screen()==='plan')render();else location.hash='plan';
}
function changeDuration(value,write=true){
 duration=value;
 const form=document.querySelector('#planner');
 if(write)form.elements.duration.value=value;
 form.querySelectorAll('[data-action="duration"]').forEach(button=>{
  const active=Number(button.dataset.id)===value;
  button.setAttribute('aria-pressed',active);
  button.classList.toggle('picked',active);
 });
}
function suggest(){
 const mood=document.querySelector('#planner [name="mood"]')?.value;
 const list=screen()==='odkrywaj'?filteredPlaces():destinations.filter(p=>mood!=='natura'||naturePlace(p));
 const all=list.filter(p=>!p.catalogOnly||(screen()==='odkrywaj'&&catalog.tag==='szczyt'));
 const fresh=all.filter(p=>!state.seen[p.id]), bag=fresh.length?fresh:all;
 if(!bag.length){notify('Zmień filtry, żeby wylosować miejsce.');return;}
 openPlace(bag[Math.floor(Math.random()*bag.length)].id);
}

document.addEventListener('click',e=>{
 const button=e.target.closest('[data-action]');
 if(!button)return;
 const {id,action}=button.dataset, trip=current(), day=trip.days[dayIndex];
 switch(action){
  case 'close':modal.close();return;
  case 'download-photos':void startPhotoDownload();return;
  case 'dismiss-photos':dismissPhotoOffer();refreshPhotoDownload();return;
  case 'start':
   document.querySelector('#planner').scrollIntoView({behavior:'smooth',block:'center'});
   document.querySelector('.duration.picked, .duration-input input').focus({preventScroll:true});return;
  case 'duration':changeDuration(Number(id));return;
  case 'surprise':suggest();return;
  case 'day':dayIndex=Number(id);render();document.querySelector('.day-tab.chosen').focus({preventScroll:true});return;
  case 'place':openPlace(id);return;
  case 'star':toggle(state.stars,id);save(state.stars.includes(id)?'Zapisano miejsce.':'Usunięto z zapisanych.');render();if(modal.open)openPlace(id);return;
  case 'visit-place':
   if(state.seen[id]){
    delete state.seen[id];
    for(const t of state.trips)for(const d of t.days)if(d.done.includes(id)){toggle(d.done,id);d.complete=false;}
   }else state.seen[id]=true;
   save(state.seen[id]?'Oznaczono jako odwiedzone.':'Cofnięto odwiedzenie.');render();openPlace(id);return;
  case 'rate':rate(id);return;
  case 'clear-rating':delete state.ratings[id];save('Usunięto ocenę.');modal.close();render();return;
  case 'toggle-stop':
   toggle(day.done,id);
   if(day.done.includes(id))state.seen[id]=true;
   else{
    day.complete=false;
    if(!state.trips.some(t=>t.days.some(d=>d.done.includes(id))))delete state.seen[id];
   }
   save();render();app.querySelector('[data-action="toggle-stop"][data-id="'+id+'"]')?.focus({preventScroll:true});return;
  case 'remove-stop':
   if(day.ids.length>1){toggle(day.ids,id);if(day.done.includes(id))toggle(day.done,id);save('Usunięto przystanek z planu.');render();}return;
  case 'add-stop':
   formDialog('Dodaj przystanek',`<label>Miejsce<select name="place">${options(destinations.filter(p=>!p.catalogOnly&&!day.ids.includes(p.id)).map(p=>[p.id,p.name+' · '+p.town]),'')}</select></label>`,'Dodaj do dnia '+(dayIndex+1),v=>addPoint(v.get('place'),dayIndex));return;
  case 'finish':
   if(day.complete){day.complete=false;save('Dzień otwarty ponownie.');render();return;}
   formDialog('Zakończ dzień '+(dayIndex+1),`<p class="muted">Zaznaczone przystanki trafią do dziennika.</p><label>Notatka z dnia<textarea maxlength="2000" name="note" rows="4" placeholder="Co warto zapamiętać?">${h(day.note)}</textarea></label>${day.done.length<day.ids.length?'<label class="check-label"><input name="all" type="checkbox"> Oznacz wszystkie przystanki jako odwiedzone</label>':''}`,'Zakończ dzień',v=>{
    day.note=v.get('note').trim();day.complete=true;
    if(v.has('all'))day.done=[...day.ids];
    day.done.forEach(id=>{state.seen[id]=true;});
    if(dayIndex<trip.days.length-1)dayIndex++;
    save('Zapisano zakończony dzień.');
   });return;
  case 'note':
   formDialog('Notatka z dnia '+(dayIndex+1),`<label>Notatka<textarea name="note" maxlength="2000" rows="5">${h(day.note)}</textarea></label>`,'Zapisz notatkę',v=>{day.note=v.get('note').trim();save('Zapisano notatkę.');});return;
  case 'alternatives': {
   const next=alternatives(trip,dayIndex).slice(0,12);
   dialog('Zmień plan dnia',`<p class="muted">Nowa trasa zastąpi przystanki, notatkę i nocleg tego dnia.</p><div class="alternative-list">${next.map(r=>`<button type="button" data-action="apply-alternative" data-id="${r.id}"><strong>${h(r.name)}</strong><small>${h(regions[routeRegion(r)].name)} · ${r.ids.length} przyst.</small></button>`).join('')||'<p>Brak wolnych tras.</p>'}</div>`);return;
  }
  case 'apply-alternative': {
   const route=alternatives(trip,dayIndex).find(option=>option.id===id);
   if(!route)return;
   trip.days[dayIndex]=dayFrom(route);save('Zmieniono plan dnia.');modal.close();render();return;
  }
  case 'edit-trip':
   formDialog('Edytuj wycieczkę',`<label>Nazwa<input name="name" maxlength="90" required value="${h(trip.name)}"></label><label>Data startu<input type="date" name="date" value="${h(trip.date)}"></label>`,'Zapisz',v=>{
    const name=v.get('name').trim();
    if(!name){notify('Wpisz nazwę wycieczki.');return false;}
    trip.name=name;trip.date=isoDay(v.get('date'));save('Zapisano wycieczkę.');
   });return;
  case 'show-hotels':case 'choose-hotel':
   selectingHotel=action==='choose-hotel';
   changeHotelLocation(routeById[day.route].base,10);
   location.hash='noclegi';
   searchHotels();return;
  case 'cancel-hotel':selectingHotel=false;location.hash='plan';return;
  case 'remove-hotel':day.stay=null;save('Usunięto nocleg z planu.');render();return;
  case 'save-hotel':
   if(!rememberLodging(id))return;
   toggle(state.hotels,id);save(state.hotels.includes(id)?'Zapisano nocleg.':'Usunięto z zapisanych.');refreshHotels();return;
  case 'attach-hotel':
   if(selectingHotel&&dayIndex<trip.days.length-1&&rememberLodging(id)){day.stay=id;selectingHotel=false;save('Przypięto nocleg do wycieczki.');location.hash='plan';}
   return;
  case 'open-trip':openTrip(state.trips.find(t=>t.id===id));return;
  case 'delete-trip': {
   const item=state.trips.find(t=>t.id===id);
   formDialog('Usunąć wycieczkę?',`<p>${h(item.name)} wraz z planem i notatkami.</p>`,'Usuń wycieczkę',()=>{
    state.trips=state.trips.filter(t=>t.id!==id);
    if(state.active===id){state.active=state.trips[0].id;dayIndex=firstOpen(current());duration=current().days.length;}
    save('Usunięto wycieczkę.');
   });return;
  }
  case 'catalog-type':
   catalog.tag=id;catalog.limit=24;
   if(id==='szczyt')catalog.region='all';
   render();app.querySelector('[data-action="catalog-type"][data-id="'+id+'"]')?.focus({preventScroll:true});return;
  case 'catalog-more':{
   const previous=catalog.limit;catalog.limit+=24;
   document.querySelector('#place-results').innerHTML=placeResults();
   app.querySelectorAll('#place-results .place-body')[previous]?.focus();return;
  }
  case 'reset':catalog={query:'',region:'all',tag:'all',status:'all',limit:24};osm={loading:false,error:false,places:[]};render();return;
  case 'osm':loadOsm();return;
  case 'export':download();return;
  case 'import':document.querySelector('#backup-file').click();return;
 }
});
document.addEventListener('submit',e=>{
 if(e.target.id==='hotel-location-form'){
  e.preventDefault();
  const values=new FormData(e.target);
  changeHotelLocation(String(values.get('location')??''),Number(values.get('radius')));
  searchHotels();return;
 }
 if(e.target.id!=='planner')return;
 e.preventDefault();
 const v=new FormData(e.target);
 const config={origin:v.get('origin'),area:v.get('area'),mood:v.get('mood'),date:isoDay(v.get('date')),duration:Number(v.get('duration'))};
 if(!Number.isInteger(config.duration)||config.duration<1||config.duration>14)return;
 if(state.trips.length>=500){notify('Masz 500 wycieczek. Usuń jedną w dzienniku, aby dodać następną.');return;}
 const previous=state.trips.find(t=>t.origin===config.origin&&t.area===config.area&&t.mood===config.mood&&t.days.length===config.duration);
 const trip=buildTrip(config,state.seen,previous);
 state.trips.unshift(trip);openTrip(trip);
 notify('Ułożono wycieczkę na '+daysText(config.duration)+'.');
 document.querySelector('#itinerary-heading').scrollIntoView({block:'start',behavior:'smooth'});
});
document.addEventListener('input',e=>{
 const el=e.target;
 if(el.name==='duration'&&el.validity.valid)changeDuration(Number(el.value),false);
 if(el.id==='place-search'){catalog.query=el.value;catalog.limit=24;document.querySelector('#place-results').innerHTML=placeResults();}
 if(el.id==='hotel-search'){
  changeHotelLocation(el.value);
  if(knownLocation(el.value))lodgingTimer=setTimeout(searchHotels,550);
 }
});
document.addEventListener('change',e=>{
 const el=e.target, placeKeys={'place-region':'region','place-tag':'tag','place-status':'status'};
 if(Object.hasOwn(placeKeys,el.id)){
  catalog[placeKeys[el.id]]=el.value;catalog.limit=24;
  if(el.id==='place-tag'){
   document.querySelector('.catalog-shortcuts').innerHTML=catalogShortcuts();
   document.querySelector('.filters-panel [data-action="surprise"]').innerHTML=icon('dice')+(catalog.tag==='szczyt'?'Wylosuj szczyt':'Poleć mi miejsce');
  }
  document.querySelector('#place-results').innerHTML=placeResults();
  if(el.id==='place-region'){osm={loading:false,error:false,places:[]};document.querySelector('#osm-results').innerHTML='';}
 }
 if(el.id==='hotel-radius'){
  changeHotelLocation(hotelSearch.query,Number(el.value));searchHotels();
 }
 if(el.id==='hotel-saved'){hotelSearch.saved=el.checked;refreshHotels();}
 if(el.id==='backup-file'&&el.files[0]){loadBackup(el.files[0]);el.value='';}
});
function download(){
 const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='checkpoint-podkarpacie-kopia.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function loadBackup(file){
 try{
  if(file.size>20*1024*1024)throw Error('backup');
  const incoming=validate(JSON.parse(await file.text())), common=new Set(state.trips.map(t=>t.id));
  const newTrips=incoming.trips.filter(t=>!common.has(t.id));
  if(state.trips.length+newTrips.length>500)throw Error('backup');
  state.trips.push(...newTrips);
  state.stars=[...new Set([...state.stars,...incoming.stars])];state.hotels=[...new Set([...state.hotels,...incoming.hotels])];
  state.liveStays={...incoming.liveStays,...state.liveStays};
  state.seen={...incoming.seen,...state.seen};state.ratings={...incoming.ratings,...state.ratings};
  save('Dodano dane z kopii. Wycieczki o tej samej tożsamości zachowały dane z urządzenia.');render();
 }catch{notify('Ten plik nie jest poprawną kopią Checkpoint Podkarpacie.');}
}
document.addEventListener('error',e=>{
 if(e.target.matches?.('img.place-photo'))e.target.hidden=true;
},true);
window.addEventListener('hashchange',()=>{if(screen()!=='noclegi')selectingHotel=false;render();if(location.hash!=='#app')window.scrollTo(0,0);});
render();
save();
void restorePhotoDownload();
if(location.protocol!=='file:'&&'serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
