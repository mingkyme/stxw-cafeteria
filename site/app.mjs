import { todayKST, parseDate, shiftDate, weekDates } from './lib.mjs';
import { fetchMeals } from './api.mjs';

const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
let selected = todayKST(), mode = 'today', request;
try { if (params.has('date')) { parseDate(params.get('date')); selected = params.get('date'); mode = 'date'; } } catch { /* invalid URL date: use today */ }
if (params.get('view') === 'week') mode = 'week';
else if (params.get('view') === 'today' && selected === todayKST()) mode = 'today';
const dateInput = $('#date'), status = $('#status'), container = $('#meals');
if (selected < dateInput.min || selected > dateInput.max) selected = todayKST();
const fmt = date => new Intl.DateTimeFormat('ko-KR',{timeZone:'UTC',month:'long',day:'numeric',weekday:'short'}).format(parseDate(date));
const compact = date => `${date.slice(0,4)}.${date.slice(5,7)}.${date.slice(8,10)}`;
function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
function drawDay(date, rows) {
  const card = node('article','day-card');
  const title = node('h4','day-title',fmt(date));
  if (date === todayKST()) title.append(node('span','today-chip','TODAY'));
  card.append(title);
  if ([0,6].includes(parseDate(date).getUTCDay())) {
    const closed = node('div','empty closed');
    closed.append(node('p','','주말 휴무'),node('small','','토요일·일요일은 운영하지 않습니다.'));
    card.append(closed);
  } else if (!rows.length) {
    const empty = node('div','empty');
    const icon = node('span','empty-icon','◌'); icon.setAttribute('aria-hidden','true');
    empty.append(icon,node('p','','등록된 식단이 없습니다.'),node('small','','식단이 확인되면 이곳에 안내됩니다.'));
    card.append(empty);
  } else {
    for (const row of rows) {
      const section = node('section','corner'), list = node('ul');
      section.append(node('h4','', row.corner));
      for (const menu of row.menus) list.append(node('li','',menu));
      section.append(list); card.append(section);
    }
    const timestamps = rows.map(x => new Date(x.updated_at)).filter(x => Number.isFinite(x.getTime()));
    if (timestamps.length) {
      const latest = new Date(Math.max(...timestamps.map(x=>x.getTime())));
      card.append(node('p','updated',`업데이트 ${new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(latest)} KST`));
    }
  }
  return card;
}
function drawWeek(dates, rows) {
  const wrapper = node('div','week-scroll');
  wrapper.tabIndex = 0;
  wrapper.setAttribute('role','region');
  wrapper.setAttribute('aria-label','주간 식단 표 · 가로로 스크롤');
  const table = node('table','week-table');
  table.append(node('caption','sr-only',`${compact(dates[0])} — ${compact(dates.at(-1))} 주간 점심 식단`));
  const head = node('thead'), headings = node('tr');
  const columns = dates.map(date => rows.filter(row=>row.meal_date === date).flatMap(row=>row.menus));
  dates.forEach(date=>{
    const th = node('th',date === todayKST() ? 'today' : '',fmt(date));
    th.scope = 'col'; th.id = `day-${date}`;
    if (date === todayKST()) th.append(node('span','today-chip','TODAY'));
    headings.append(th);
  });
  head.append(headings); table.append(head);
  const body = node('tbody');
  const height = Math.max(2,...columns.map(menus=>menus.length));
  for (let index=0; index<height; index++) {
    const tr = node('tr');
    tr.setAttribute('aria-label',index === 0 ? '밥' : index === 1 ? '국/찌개' : `반찬${index-1}`);
    dates.forEach((date,column)=>{
      const menus = columns[column];
      const closed = menus.length === 1 && menus[0] === '휴무';
      const missing = menus.length === 0;
      if ((closed || missing) && index > 0) return;
      const cell = node('td',date === todayKST() ? 'today' : '',closed ? '휴무' : missing ? '미등록' : menus[index] ?? '');
      cell.setAttribute('headers',`day-${date}`);
      if (closed || missing) {
        cell.rowSpan = height;
        cell.classList.add(closed ? 'closed' : 'unregistered');
        cell.setAttribute('aria-label',`${fmt(date)} ${closed ? '휴무' : '등록된 식단이 없습니다.'}`);
      }
      tr.append(cell);
    });
    body.append(tr);
  }
  table.append(body); wrapper.append(table); return wrapper;
}
async function load() {
  request?.abort(); request = new AbortController(); const current = request;
  const dates = mode === 'week' ? weekDates(selected) : [selected];
  dateInput.value = selected;
  for (const [id, value] of [['today','today'],['date-view','date'],['week','week']]) $(`#${id}`).setAttribute('aria-pressed',String(mode === value));
  $('#prev').setAttribute('aria-label',mode === 'week' ? '이전 주' : '이전 날짜');
  $('#next').setAttribute('aria-label',mode === 'week' ? '다음 주' : '다음 날짜');
  $('#period').textContent = mode === 'week' ? `${compact(dates[0])} — ${compact(dates.at(-1))}` : `${compact(selected)} · ${fmt(selected)}`;
  const search = new URLSearchParams({date:selected,view:mode}); history.replaceState(null,'',`?${search}`);
  container.replaceChildren(); container.classList.toggle('week',mode === 'week'); container.setAttribute('aria-busy','true');
  status.setAttribute('role','status'); status.textContent = '식단을 불러오는 중입니다…';
  try {
    // A weekend is a known closure, independent of stored menus or DB availability.
    const weekend = dates.length === 1 && [0,6].includes(parseDate(selected).getUTCDay());
    const rows = weekend ? [] : await fetchMeals(dates[0], dates.at(-1), {signal:current.signal});
    if (current.signal.aborted) return;
    for (const row of rows) {
      if (!dates.includes(row.meal_date) || row.meal_type !== 'lunch' || typeof row.corner !== 'string' || !Array.isArray(row.menus) || !row.menus.every(x => typeof x === 'string')) throw new Error('식단 데이터 형식을 확인할 수 없습니다. 운영자에게 문의해 주세요.');
    }
    container.replaceChildren(...(mode === 'week' ? [drawWeek(dates,rows)] : dates.map(date => drawDay(date, rows.filter(row=>row.meal_date === date)))));
    status.textContent = '';
  } catch (error) {
    if (current.signal.aborted) return;
    status.setAttribute('role','alert'); status.textContent = error.message;
  } finally { if (!current.signal.aborted) container.setAttribute('aria-busy','false'); }
}
$('#today').addEventListener('click',()=>{ selected = todayKST(); mode='today'; load(); });
$('#date-view').addEventListener('click',()=>{ mode='date'; load(); });
$('#week').addEventListener('click',()=>{ mode='week'; load(); });
dateInput.addEventListener('change',()=>{
  try { parseDate(dateInput.value); if (!dateInput.checkValidity()) throw new Error('조회 가능한 날짜 범위를 확인해 주세요.'); selected=dateInput.value; if(mode==='today') mode='date'; load(); }
  catch(error) { status.setAttribute('role','alert'); status.textContent=error.message; }
});
for (const [id,step] of [['prev',-1],['next',1]]) $(`#${id}`).addEventListener('click',()=>{
  try { const next=shiftDate(selected,step*(mode==='week'?7:1)); parseDate(next); if(next<dateInput.min || next>dateInput.max) return; selected=next; if(mode==='today')mode='date'; load(); }
  catch(error) { status.setAttribute('role','alert'); status.textContent=error.message; }
});
$('#refresh').addEventListener('click',load);
load();
