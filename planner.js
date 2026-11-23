/* Reguły planera są niezależne od interfejsu i zapisu. */
const placeById = Object.fromEntries(destinations.map(place => [place.id, place]));
const stayById = Object.fromEntries(stays.map(stay => [stay.id, stay]));
const routeById = Object.fromEntries(routes.map(route => [route.id, route]));
const routeRegion = route => placeById[route.ids[0]].region;
const uid = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2,10);
const tagsForMood = {natura:['natura','szlak'],zabytki:['zabytki','muzeum'],rodzina:['rodzina'],relaks:['relaks']};
const startRoutes = {'Łańcut':'zamek','Rzeszów':'rzcentrum','Przemyśl':'przemysl','Sanok':'sanok','Krosno':'kro','Tarnobrzeg':'tarn','Ustrzyki Dolne':'sol','Horyniec-Zdrój':'rad'};

// Warianty prowadzące na ten sam grzbiet lub przez tę samą dolinę
// mają wspólny rejon, także w starszych propozycjach dnia.
const bieszczadyDays = [
  ['zachod', 'cisna', 'dolina', 'cis'],
  ['zachod', 'cisna', 'grzbiet', 'trail-jaslo-cisna'],
  ['zachod', 'sine-wiry', 'dolina', 'trail-sine-wiry'],
  ['zachod', 'chryszczata', 'dolina', 'trail-chryszczata-duszatyn'],
  ['poloniny', 'wetlinska', 'grzbiet', 'wet trail-wetlinska-wyzna trail-wetlinska-gran trail-smerek-wetlina'],
  ['poloniny', 'wetlinska', 'dolina', 'wetslow'],
  ['poloniny', 'carynska', 'grzbiet', 'car trail-carynska-wyznianska'],
  ['poloniny', 'rawki', 'grzbiet', 'trail-rawki-wyznianska'],
  ['poloniny', 'rabia-skala', 'grzbiet', 'trail-rabia-wetlina'],
  ['gorny-san', 'dwernik', 'grzbiet', 'trail-dwernik-nasiczne'],
  ['gorny-san', 'hylaty', 'dolina', 'trail-hylaty-wodospad'],
  ['wschod', 'tarnica-halicz', 'grzbiet', 'tar trail-tarnica-wolosate trail-tarnica-szeroki trail-halicz-petla'],
  ['wschod', 'muczne', 'grzbiet', 'trail-bukowe-muczne'],
  ['wschod', 'muczne', 'dolina', 'muc'],
  ['wschod', 'tarnawa', 'dolina', 'trail-torfowiska-tarnawa'],
];
const bieszczadyByRoute = Object.fromEntries(bieszczadyDays.flatMap(([zone,area,terrain,ids]) =>
  ids.split(' ').map(id => [id,{zone,area,terrain}])));

function routeRepetition(route, selected) {
  const location = bieszczadyByRoute[route.id];
  if (!location) return 0;
  let cost = 0;
  for (const id of selected) {
    const earlier = bieszczadyByRoute[id];
    if (!earlier) continue;
    if (earlier.area === location.area) cost += 12;
    if (earlier.zone === location.zone) cost += 3;
    if (earlier.terrain === location.terrain) cost += 0.5;
  }
  return cost;
}

const naturePlace = place => place.tags.includes('natura') ||
  (place.tags.includes('szlak') && !place.tags.some(tag => tag === 'zabytki' || tag === 'muzeum'));

function routeForMood(route, mood) {
  if (mood !== 'natura') return route;
  const ids = route.ids.filter(id => naturePlace(placeById[id]));
  return ids.length ? {...route, ids, name:natureTitle(route, ids)} : null;
}

function natureTitle(route, ids) {
  return ids.length === route.ids.length ? route.name : ids.map(id => placeById[id].name).join(' i ');
}

function dayTitle(day, mood) {
  const route = routeById[day.route];
  return mood === 'natura' ? routeForMood(route, mood)?.name ?? route.name : route.name;
}

function dayFrom(route) {
  return {route:route.id, ids:[...route.ids], done:[], complete:false, note:'', stay:null};
}

function pickRoute(candidates, score, recent, random) {
  const ranked = candidates.map(route => ({route,score:score(route)}));
  const best = Math.max(...ranked.map(candidate => candidate.score));
  // Losowanie obejmuje tylko trasy o podobnej ocenie.
  const comparable = ranked.filter(candidate => candidate.score >= best - 1.75);
  const different = comparable.filter(({route}) => !recent.routes.has(route.id));
  const options = different.length ? different : comparable;
  const differentAreas = options.filter(({route}) => !recent.areas.has(bieszczadyByRoute[route.id]?.area));
  const pool = differentAreas.length ? differentAreas : options;
  const weights = pool.map(candidate => 2 ** (candidate.score - best));
  let ticket = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (const [index, candidate] of pool.entries()) {
    ticket -= weights[index];
    if (ticket < 0) return candidate.route;
  }
  return pool.at(-1).route;
}

function buildTrip(config, history = {}, previous = null, random = Math.random) {
  const {duration, mood, origin, area, date} = config;
  const firstRegion = area === 'all' ? originRegions[origin] : area;
  const order = regionLoops[firstRegion];
  const desiredBlock = duration > 8 ? 3 : 2;
  const available = routes.map(route => routeForMood(route, mood)).filter(Boolean);
  const byRegion = Object.fromEntries(order.map(region => [region, available.filter(route => routeRegion(route) === region)]));
  const claimed = new Set();
  const days = [];
  const previousRoutes = previous?.days.map(day => day.route) ?? [];
  const recent = {
    routes:new Set(previousRoutes),
    areas:new Set(previousRoutes.map(id => bieszczadyByRoute[id]?.area).filter(Boolean)),
  };
  function takeDay(candidates) {
    const route = pickRoute(candidates, r => rank(r) - routeRepetition(r,claimed), recent, random);
    candidates.splice(candidates.indexOf(route),1);
    claimed.add(route.id);
    days.push(dayFrom(route));
  }
  for (const region of order) {
    const candidates = [...byRegion[region]];
    const block = region === firstRegion && area !== 'all' ? duration : (region === firstRegion && duration === 1 ? 1 : desiredBlock);
    for (let i = 0; i < block && days.length < duration && candidates.length; i++) {
      takeDay(candidates);
    }
    if (days.length === duration) break;
  }
  const remaining = available.filter(route => !claimed.has(route.id));
  while (days.length < duration && remaining.length) takeDay(remaining);
  const theme = area === 'all' ? regions[firstRegion].short : regions[area].short;
  const name = duration === 1 ? dayTitle(days[0], mood) : duration > 5 && (area === 'all' || days.some(day => routeRegion(routeById[day.route]) !== area)) ? 'Objazd Podkarpacia' : theme;
  return {id:uid(),name,origin,mood,area,date,days,created:Date.now()};

  function rank(route) {
    const points = route.ids.map(id => placeById[id]);
    const preferred = tagsForMood[mood] ?? [];
    const affinity = points.filter(place => place.tags.some(tag => preferred.includes(tag))).length / points.length;
    const fresh = points.filter(place => !history[place.id]).length / points.length;
    const localStart = route.id === startRoutes[origin] && routeRegion(route) === firstRegion;
    const known = regions[routeRegion(route)].town === route.base;
    const trailBonus = mood === 'natura' && points.some(place => place.itinerary) ? 2 : 0;
    return affinity * 7 + fresh * 1.5 + (localStart ? 1.1 : 0) + (known ? 0.2 : 0) + trailBonus;
  }
}

function alternatives(trip,index) {
  const current = trip.days[index];
  const usedRoutes = new Set(trip.days.map(day => day.route));
  const otherRoutes = trip.days.filter((_,dayIndex) => dayIndex !== index).map(day => day.route);
  const usedPlaces = new Set(trip.days.flatMap(day => day.ids));
  const region = routeRegion(routeById[current.route]);
  const preferred = tagsForMood[trip.mood] ?? [];
  const score = route => (routeRegion(route) === region ? 10 : 0) +
    route.ids.filter(id => placeById[id].tags.some(tag => preferred.includes(tag))).length +
    (trip.mood === 'natura' && route.ids.some(id => placeById[id].itinerary) ? 2 : 0) - routeRepetition(route,otherRoutes);
  return routes.map(route => routeForMood(route, trip.mood)).filter(route => route && !usedRoutes.has(route.id) && !route.ids.some(id => usedPlaces.has(id))).sort((a,b)=>score(b)-score(a));
}

function isoDay(start,add=0) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? '')) return '';
  const date = new Date(start+'T12:00:00Z');
  if (Number.isNaN(+date) || date.toISOString().slice(0,10) !== start) return '';
  date.setUTCDate(date.getUTCDate()+add);
  return date.toISOString().slice(0,10);
}

function getStayDates(trip, index) {
  let end = index + 1;
  const day = trip.days[index];
  const base = routeById[day.route].base;
  while (end < trip.days.length - 1 && (day.stay ? trip.days[end].stay === day.stay : !trip.days[end].stay && routeById[trip.days[end].route].base === base)) end++;
  return {checkin:isoDay(trip.date,index), checkout:isoDay(trip.date,end)};
}
