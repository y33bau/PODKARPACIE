/* Reguły planera są niezależne od interfejsu i zapisu. */
const placeById = Object.fromEntries(destinations.map(place => [place.id, place]));
const stayById = Object.fromEntries(stays.map(stay => [stay.id, stay]));
const routeById = Object.fromEntries(routes.map(route => [route.id, route]));
const routeRegion = route => placeById[route.ids[0]].region;
const uid = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2,10);
const tagsForMood = {natura:['natura','szlak'],zabytki:['zabytki','muzeum'],rodzina:['rodzina'],relaks:['relaks']};
const startRoutes = {'Łańcut':'zamek','Rzeszów':'rzcentrum','Przemyśl':'przemysl','Sanok':'sanok','Krosno':'kro','Tarnobrzeg':'tarn','Ustrzyki Dolne':'sol','Horyniec-Zdrój':'rad'};

function dayFrom(route) {
  return {route:route.id, ids:[...route.ids], done:[], complete:false, note:'', stay:null};
}

function buildTrip(config, history = {}) {
  const {duration, mood, origin, area, date} = config;
  const firstRegion = area === 'all' ? originRegions[origin] : area;
  const order = regionLoops[firstRegion];
  const desiredBlock = duration > 8 ? 3 : 2;
  const byRegion = Object.fromEntries(order.map(region => [region, routes.filter(route => routeRegion(route) === region)]));
  const claimed = new Set();
  const days = [];
  for (const region of order) {
    const candidates = [...byRegion[region]].sort((a,b) => rank(b)-rank(a));
    const block = region === firstRegion && area !== 'all' ? duration : (region === firstRegion && duration === 1 ? 1 : desiredBlock);
    while (days.length < duration && candidates.length && candidates.length > byRegion[region].length - block) {
      const route = candidates.shift();
      claimed.add(route.id);
      days.push(dayFrom(route));
    }
    if (days.length === duration) break;
  }
  for (const route of routes) {
    if (days.length === duration) break;
    if (!claimed.has(route.id)) days.push(dayFrom(route));
  }
  const theme = area === 'all' ? regions[firstRegion].short : regions[area].short;
  const name = duration === 1 ? routeById[days[0].route].name : duration > 5 && (area === 'all' || days.some(day => routeRegion(routeById[day.route]) !== area)) ? 'Objazd Podkarpacia' : theme;
  return {id:uid(),name,origin,mood,area,date,days,created:Date.now()};

  function rank(route) {
    const points = route.ids.map(id => placeById[id]);
    const preferred = tagsForMood[mood] ?? [];
    const affinity = points.filter(place => place.tags.some(tag => preferred.includes(tag))).length / points.length;
    const fresh = points.filter(place => !history[place.id]).length / points.length;
    const localStart = route.id === startRoutes[origin] && routeRegion(route) === firstRegion;
    const known = regions[routeRegion(route)].town === route.base;
    return affinity * 7 + fresh * 1.5 + (localStart ? (mood === 'mix' ? 10 : 3) : 0) + (known ? 0.2 : 0);
  }
}

function alternatives(trip,index) {
  const current = trip.days[index];
  const usedRoutes = new Set(trip.days.map(day => day.route));
  const usedPlaces = new Set(trip.days.flatMap(day => day.ids));
  const region = routeRegion(routeById[current.route]);
  const preferred = tagsForMood[trip.mood] ?? [];
  const score = route => (routeRegion(route) === region ? 10 : 0) + route.ids.filter(id => placeById[id].tags.some(tag => preferred.includes(tag))).length;
  return routes.filter(route => !usedRoutes.has(route.id) && !route.ids.some(id => usedPlaces.has(id))).sort((a,b)=>score(b)-score(a));
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
