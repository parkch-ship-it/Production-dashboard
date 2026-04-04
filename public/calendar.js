let calendarData = {};
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let currentWeekStart = getWeekStart(new Date()); // 이번 주 일요일
let viewMode = 'month'; // 'month' | 'week'

const DOWS = ['일', '월', '화', '수', '목', '금', '토'];

function el(id) { return document.getElementById(id); }
function show(id) { el(id).classList.remove('hidden'); }
function hide(id) { el(id).classList.add('hidden'); }

// 주어진 날짜가 속한 주의 일요일 반환
function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function dateToKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

// ── 뷰 전환 ──────────────────────────────────
function setView(mode) {
  viewMode = mode;
  el('btn-month').classList.toggle('active', mode === 'month');
  el('btn-week').classList.toggle('active', mode === 'week');

  // 주 뷰로 전환 시 현재 월의 첫째 날 기준 주로 이동
  if (mode === 'week') {
    currentWeekStart = getWeekStart(new Date(currentYear, currentMonth, 1));
  }
  render();
}

// ── 통합 렌더 ─────────────────────────────────
function render() {
  if (viewMode === 'month') renderMonth();
  else renderWeek();
}

// ── 날짜 셀 공통 생성 ─────────────────────────
function buildCell(dateKey, dateNum, dow, isToday, isOtherMonth) {
  const items = calendarData[dateKey] || [];
  const cell  = document.createElement('div');
  cell.className = `cal-cell${isToday ? ' today' : ''}${isOtherMonth ? ' other-month' : ''}`;

  const dateEl = document.createElement('div');
  dateEl.className = `cal-date${dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''}`;
  dateEl.textContent = dateNum;
  cell.appendChild(dateEl);

  const MAX_SHOW = viewMode === 'week' ? 8 : 3;
  items.slice(0, MAX_SHOW).forEach(item => {
    const tag = document.createElement('div');
    tag.className = 'cal-item';
    tag.textContent = item.vendor ? `${item.name}(${item.vendor})` : item.name;
    tag.title = `${item.name}(${item.vendor || '-'}) ${item.quantity}개`;
    tag.addEventListener('click', e => { e.stopPropagation(); openModal(dateKey, items); });
    cell.appendChild(tag);
  });

  if (items.length > MAX_SHOW) {
    const more = document.createElement('div');
    more.className = 'cal-more';
    more.textContent = `+${items.length - MAX_SHOW}개 더보기`;
    more.addEventListener('click', e => { e.stopPropagation(); openModal(dateKey, items); });
    cell.appendChild(more);
  }

  if (items.length > 0) {
    cell.addEventListener('click', () => openModal(dateKey, items));
  }

  return cell;
}

// ── 월 뷰 렌더 ───────────────────────────────
function renderMonth() {
  const grid  = el('calendar-grid');
  grid.className = 'calendar-grid';
  grid.innerHTML = '';

  el('period-label').textContent = `${currentYear}년 ${currentMonth + 1}월`;

  const today       = new Date();
  const firstDay    = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // 요일 헤더
  DOWS.forEach((d, i) => {
    const th = document.createElement('div');
    th.className = `cal-dow${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`;
    th.textContent = d;
    grid.appendChild(th);
  });

  // 앞 빈 셀
  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(Object.assign(document.createElement('div'), { className: 'cal-cell empty' }));
  }

  // 날짜 셀
  for (let d = 1; d <= daysInMonth; d++) {
    const dow     = (firstDay + d - 1) % 7;
    const isToday = today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === d;
    const dateKey = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    grid.appendChild(buildCell(dateKey, d, dow, isToday, false));
  }

  // 뒤 빈 셀
  const remainder = (firstDay + daysInMonth) % 7;
  if (remainder !== 0) {
    for (let i = remainder; i < 7; i++) {
      grid.appendChild(Object.assign(document.createElement('div'), { className: 'cal-cell empty' }));
    }
  }
}

// ── 주 뷰 렌더 ───────────────────────────────
function renderWeek() {
  const grid = el('calendar-grid');
  grid.className = 'calendar-grid week-grid';
  grid.innerHTML = '';

  const today    = new Date();
  const weekEnd  = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const m1 = currentWeekStart.getMonth() + 1;
  const d1 = currentWeekStart.getDate();
  const m2 = weekEnd.getMonth() + 1;
  const d2 = weekEnd.getDate();
  el('period-label').textContent =
    m1 === m2
      ? `${currentWeekStart.getFullYear()}년 ${m1}월 ${d1}~${d2}일`
      : `${m1}/${d1} ~ ${m2}/${d2}`;

  // 요일 헤더
  DOWS.forEach((d, i) => {
    const th = document.createElement('div');
    th.className = `cal-dow${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`;
    th.textContent = d;
    grid.appendChild(th);
  });

  // 7개 날짜 셀
  for (let i = 0; i < 7; i++) {
    const date    = new Date(currentWeekStart);
    date.setDate(date.getDate() + i);
    const dow     = date.getDay();
    const isToday = dateToKey(today) === dateToKey(date);
    grid.appendChild(buildCell(dateToKey(date), date.getDate(), dow, isToday, false));
  }
}

// ── 이전/다음 이동 ────────────────────────────
el('prev-btn').addEventListener('click', () => {
  if (viewMode === 'month') {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  } else {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  }
  render();
});

el('next-btn').addEventListener('click', () => {
  if (viewMode === 'month') {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  } else {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }
  render();
});

// ── 모달 ─────────────────────────────────────
function openModal(dateKey, items) {
  const [y, m, d] = dateKey.split('-');
  el('modal-date').textContent = `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 — 입고 ${items.length}건`;

  el('modal-body').innerHTML = items.map(p => `
    <div class="modal-item">
      ${p.image
        ? `<img class="modal-img" src="${p.image}" alt="도식화" onerror="this.style.display='none'">`
        : `<div class="modal-img-placeholder">👕</div>`}
      <div class="modal-info">
        <div class="modal-name">${p.name || '-'}</div>
        <div class="modal-meta">${p.itemNo || '-'} · ${p.category || '-'} · ${p.vendor || '-'}</div>
      </div>
      <div class="modal-qty">${Number(String(p.quantity || '0').replace(/,/g, '')).toLocaleString()}개</div>
    </div>
  `).join('');

  show('modal-overlay');
}

function closeModal() { hide('modal-overlay'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── 데이터 로드 ──────────────────────────────
async function loadCalendar() {
  hide('calendar-wrap');
  hide('error-screen');
  show('loading');

  try {
    const res = await fetch('/api/calendar');
    if (res.status === 401) { location.href = '/auth'; return; }
    if (!res.ok) throw new Error((await res.json()).error || '서버 오류');

    calendarData = await res.json();
    el('updated-at').textContent = `최근 업데이트: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;

    hide('loading');
    show('calendar-wrap');
    render();
  } catch (err) {
    hide('loading');
    el('error-msg').textContent = `오류: ${err.message}`;
    show('error-screen');
  }
}

loadCalendar();
