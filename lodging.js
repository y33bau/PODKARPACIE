
/* Wyszukiwanie noclegów według punktu i promienia. */
const lodgingTowns = {
  'Łańcut':[50.069,22.229], 'Rzeszów':[50.038,22.004], 'Przemyśl':[49.783,22.768],
  'Sanok':[49.560,22.205], 'Krosno':[49.693,21.766], 'Tarnobrzeg':[50.574,21.680],
  'Jarosław':[50.018,22.680], 'Krasiczyn':[49.776,22.652], 'Arłamów':[49.658,22.668],
  'Wetlina':[49.153,22.468], 'Smerek':[49.166,22.437], 'Cisna':[49.212,22.327],
  'Ustrzyki Górne':[49.107,22.650], 'Ustrzyki Dolne':[49.430,22.589], 'Muczne':[49.134,22.749],
  'Polańczyk':[49.369,22.421], 'Solina':[49.400,22.453], 'Myczkowce':[49.435,22.415],
  'Lesko':[49.473,22.331], 'Kombornia':[49.708,21.897], 'Polany':[49.479,21.562],
  'Iwonicz-Zdrój':[49.563,21.791], 'Rymanów-Zdrój':[49.550,21.849], 'Klimkówka':[49.577,21.831],
  'Krempna':[49.511,21.502], 'Horyniec-Zdrój':[50.191,23.362], 'Radawa':[50.151,22.780],
  'Ruda Różaniecka':[50.303,23.186], 'Lubaczów':[50.158,23.122], 'Sieniawa':[50.177,22.610],
  'Przeworsk':[50.057,22.496], 'Kolbuszowa':[50.245,21.772], 'Jasło':[49.746,21.473],
  'Dębica':[50.052,21.412], 'Mielec':[50.288,21.425], 'Baranów Sandomierski':[50.498,21.544],
};
const propertyTypes = {hotel:'Hotel', guest_house:'Pensjonat / gościniec', apartment:'Apartament',
  hostel:'Hostel', motel:'Motel', chalet:'Domek', alpine_hut:'Schronisko', camp_site:'Camping'};
const lodgingRadii = [5,10,20,40];
const lodgingCache = new Map();
const locationKey = value => value.trim().toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const knownLocation = text => Object.keys(lodgingTowns).find(town => locationKey(town) === locationKey(text));

function lodgingDistance(from,to) {
  const radians = Math.PI/180;
  const a = Math.sin((from[0]-to[0])*radians/2)**2 +
    Math.cos(from[0]*radians)*Math.cos(to[0]*radians)*Math.sin((from[1]-to[1])*radians/2)**2;
  return 12742*Math.asin(Math.sqrt(Math.min(a,1)));
}

async function findLodgingLocation(text, signal) {
  const known = knownLocation(text);
  if (known) return {town:known, point:lodgingTowns[known]};
  const params = new URLSearchParams({q:text,limit:'8',bbox:'21.05,48.95,23.60,50.86',layer:'city'});
  const result = await fetch('https://photon.komoot.io/api/?'+params,{signal:AbortSignal.any([signal,AbortSignal.timeout(5000)]),credentials:'omit'});
  if (!result.ok) throw Error('location');
  const data = await result.json();
  const features = (data.features ?? []).filter(feature => feature.properties?.countrycode?.toUpperCase() === 'PL' &&
    Number.isFinite(feature.geometry?.coordinates?.[0]) && Number.isFinite(feature.geometry?.coordinates?.[1]));
  const match = features.find(feature => /podkarpack/i.test(feature.properties.state ?? '')) ?? features[0];
  if (!match) return null;
  const [lon,lat] = match.geometry.coordinates;
  return {town:match.properties.name||text, point:[lat,lon]};
}

function parseLodgingResults(data, location, radius) {
  if (!Array.isArray(data.elements) || /(?:runtime error|timed out)/i.test(data.remark ?? '')) throw Error('lodging');
  const unique = new Set();
  return data.elements.flatMap(item => {
    const tags = item.tags ?? {};
    const type = propertyTypes[tags.tourism], name = typeof tags.name === 'string' ? tags.name.trim().slice(0,180) : '';
    const lat = item.lat ?? item.center?.lat, lon = item.lon ?? item.center?.lon;
    if (!name || !Object.hasOwn(propertyTypes,tags.tourism) || !Number.isFinite(lat) || !Number.isFinite(lon) ||
      !['node','way','relation'].includes(item.type) || !Number.isSafeInteger(item.id) || item.id<=0) return [];
    const distance = lodgingDistance(location.point,[lat,lon]);
    if (distance > radius) return [];
    const town = String(tags['addr:city'] || tags['addr:place'] || '').slice(0,120);
    return [{id:'osm-'+item.type+'-'+item.id,name,town,searchTown:location.town,type,lat,lon,distance}];
  }).sort((a,b)=>a.distance-b.distance).filter(stay=>{
    const key=locationKey(stay.name)+'|'+stay.lat.toFixed(3)+'|'+stay.lon.toFixed(3);
    if(unique.has(key))return false;
    unique.add(key);
    return true;
  }).slice(0,45);
}

async function findLodging(location, radius, signal) {
  if (!lodgingRadii.includes(radius)) throw Error('radius');
  const [lat,lon] = location.point.map(value=>value.toFixed(4));
  const key = lat+','+lon+':'+radius;
  const cached=lodgingCache.get(key);
  if(cached && cached.expires>Date.now())return cached.results;
  const query = '[out:json][timeout:6];(nwr(around:'+radius*1000+','+lat+','+lon+')[tourism~"^('+Object.keys(propertyTypes).join('|')+')$"][name];);out center 600;';
  const endpoints = ['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter'];
  for (const endpoint of endpoints) {
    signal.throwIfAborted();
    try {
      const response = await fetch(endpoint+'?'+new URLSearchParams({data:query}),{
        signal:AbortSignal.any([signal,AbortSignal.timeout(8000)]),credentials:'omit'
      });
      if (!response.ok) throw Error('lodging');
      const results=parseLodgingResults(await response.json(),location,radius);
      if(lodgingCache.size>=24)lodgingCache.delete(lodgingCache.keys().next().value);
      lodgingCache.set(key,{expires:Date.now()+5*60*1000,results});
      return results;
    } catch (error) {
      if (signal.aborted || endpoint === endpoints.at(-1)) throw error;
    }
  }
}

function normalizeSavedLodging(value) {
  if (!value || typeof value!=='object' || !/^osm-(node|way|relation)-[1-9]\d{0,15}$/.test(value.id)) return null;
  const {id,name,town='',searchTown='',type,lat,lon} = value;
  if (typeof name!=='string'||!name||name.length>180||typeof town!=='string'||town.length>120||
    typeof searchTown!=='string'||searchTown.length>120||!Object.values(propertyTypes).includes(type)||
    !Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180) return null;
  return {id,name,town,searchTown,type,lat,lon};
}
