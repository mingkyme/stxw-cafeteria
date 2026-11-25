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
  if (!rows.length) {
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
    const rows = await fetchMeals(dates[0], dates.at(-1), {signal:current.signal});
    if (current.signal.aborted) return;
    for (const row of rows) {
      if (!dates.includes(row.meal_date) || row.meal_type !== 'lunch' || typeof row.corner !== 'string' || !Array.isArray(row.menus) || !row.menus.every(x => typeof x === 'string')) throw new Error('식단 데이터 형식을 확인할 수 없습니다. 운영자에게 문의해 주세요.');
    }
    container.replaceChildren(...dates.map(date => drawDay(date, rows.filter(row=>row.meal_date === date))));
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
