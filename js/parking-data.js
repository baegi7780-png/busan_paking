export const STALE_MS = 15 * 60 * 1000;
export function timestamp(value) {
  const s = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(s)) return Date.parse(s.replace(' ', 'T') + '+09:00');
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s)) return Date.parse(s);
  return NaN;
}
export function statusOf(item, data, now = Date.now()) {
  if (!item.valid) return 'unknown';
  const time = timestamp(item.lastupdatetime);
  if (data?.degraded || !Number.isFinite(time) || now-time > STALE_MS || time-now > 300000) return 'stale';
  return item.curravacnt === 0 ? 'full' : item.curravacnt / item.maxcnt < 0.15 ? 'busy' : 'available';
}
export function usable(item, data, now = Date.now()) { return ['full','busy','available'].includes(statusOf(item,data,now)); }
export function selectItems(data, {query = '', district = 'all', filter = 'all', sort = 'name'}, now = Date.now()) {
  const q = query.trim().toLocaleLowerCase('ko-KR').replace(/\s/g, '');
  const items = (data?.items || []).filter(p => {
    const text = [p.parknm,p.parkgcd,p.address,p.district,p.basic?.pkNam].join(' ').toLocaleLowerCase('ko-KR').replace(/\s/g, '');
    const status = statusOf(p,data,now);
    return text.includes(q) && (district === 'all' || district === 'unknown' && !p.district || p.district === district) &&
      (filter === 'all' || filter === 'available' && ['available','busy'].includes(status) || filter === status);
  });
  return items.sort((a,b) => sort === 'spaces' ? ((usable(b,data,now)?b.curravacnt:-1)-(usable(a,data,now)?a.curravacnt:-1)) || a.parknm.localeCompare(b.parknm,'ko') : sort === 'code' ? a.parkgcd.localeCompare(b.parkgcd,undefined,{numeric:true}) : a.parknm.localeCompare(b.parknm,'ko'));
}
export function summary(items, data, now=Date.now()) {
  const current = items.filter(p=>usable(p,data,now));
  return {count:items.length,spaces:current.reduce((sum,p)=>sum+p.curravacnt,0),full:current.filter(p=>p.curravacnt===0).length,uncertain:items.length-current.length};
}
export function hasLocation(p) { const l=p.location;return Boolean(l && Number.isFinite(l.lat) && Number.isFinite(l.lng) && l.lat>=34.8 && l.lat<=35.6 && l.lng>=128.7 && l.lng<=129.4); }
export function links(p) {
  const text=encodeURIComponent(p.address || '부산 '+p.parknm+' 주차장');
  const search='https://map.kakao.com/link/search/'+text;
  return hasLocation(p) ? {map:'https://map.kakao.com/link/map/'+encodeURIComponent(p.parknm)+','+p.location.lat+','+p.location.lng,route:'https://map.kakao.com/link/to/'+encodeURIComponent(p.parknm)+','+p.location.lat+','+p.location.lng} : {map:search,route:null};
}
