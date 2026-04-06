// ── 헬퍼 ─────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }
function show(id) { el(id).classList.remove('hidden'); }
function hide(id) { el(id).classList.add('hidden'); }

// 진행률에 따른 색상 분류
function progressColor(pct) {
  if (pct >= 80) return { cls: 'color-green',  fill: '#10b981', text: '#10b981' };
  if (pct >= 40) return { cls: 'color-yellow', fill: '#f59e0b', text: '#f59e0b' };
  return          { cls: 'color-red',    fill: '#ef4444', text: '#ef4444' };
}

// ── 공정 카드 렌더 ────────────────────────────────────────────
function renderProcessCards(processStats) {
  const grid = el('process-grid');
  grid.innerHTML = '';

  processStats.forEach(proc => {
    const color = progressColor(proc.progressPercent);
    const card = document.createElement('div');
    card.className = `process-card ${color.cls}`;

    card.innerHTML = `
      <div class="process-name">${proc.name}</div>
      <div class="progress-wrap">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill"
               style="width:0%; background:${color.fill}"
               data-target="${proc.progressPercent}"></div>
        </div>
        <span class="progress-pct" style="color:${color.text}">${proc.progressPercent}%</span>
      </div>
      <div class="stat-row">
        <span class="stat-tag tag-total">전체 ${proc.total}건</span>
        <span class="stat-tag tag-done">진행 ${proc.inProgress}건</span>
        <span class="stat-tag tag-pending">미진행 ${proc.notStarted}건</span>
      </div>
    `;
    grid.appendChild(card);
  });

  // 진행 바 애니메이션
  requestAnimationFrame(() => {
    document.querySelectorAll('.progress-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.target + '%';
    });
  });
}

// ── 컬럼 정의 ────────────────────────────────────────────────
const COLUMNS = [
  { key: 'category', label: '복종',        sortable: true,  filterable: true  },
  { key: 'name',     label: '제품명',      sortable: true,  filterable: true  },
  { key: 'itemNo',   label: '품번',        sortable: true,  filterable: true  },
  { key: 'image',    label: '이미지',      sortable: false, filterable: false },
  { key: 'vendor',   label: '업체',        sortable: true,  filterable: true  },
  { key: 'designer', label: '담당 디자이너', sortable: true,  filterable: true  },
  { key: 'quantity', label: '수량',        sortable: true,  filterable: false },
];

// ── 테이블 상태 저장소 ─────────────────────────────────────────
const tableStates = {};

function getState(id) {
  if (!tableStates[id]) tableStates[id] = { sortKey: null, sortDir: 'asc', filters: {} };
  return tableStates[id];
}

// ── 테이블 tbody 렌더 (정렬/필터 적용) ──────────────────────────
function renderTbody(tbodyEl, products, state) {
  let data = [...products];

  // 필터 적용
  Object.entries(state.filters).forEach(([key, val]) => {
    if (!val) return;
    data = data.filter(p => (p[key] || '').toLowerCase().includes(val.toLowerCase()));
  });

  // 정렬 적용
  if (state.sortKey) {
    data.sort((a, b) => {
      const va = (a[state.sortKey] || '').toString();
      const vb = (b[state.sortKey] || '').toString();
      const num = !isNaN(va) && !isNaN(vb);
      const cmp = num ? Number(va) - Number(vb) : va.localeCompare(vb, 'ko');
      return state.sortDir === 'asc' ? cmp : -cmp;
    });
  }

  if (data.length === 0) {
    tbodyEl.innerHTML = `<tr class="empty-row"><td colspan="${COLUMNS.length}">필터 결과 없음</td></tr>`;
    return;
  }

  tbodyEl.innerHTML = data.map(p => `
    <tr class="ns-clickable-row" onclick="openDetailPopup(${JSON.stringify(p).replace(/"/g, '&quot;')})">
      <td>${p.category || '-'}</td>
      <td>${p.name || '-'}</td>
      <td>${p.itemNo || '-'}</td>
      <td>${p.image ? `<img src="${p.image}" alt="도식화" style="height:40px;object-fit:contain;">` : '-'}</td>
      <td>${p.vendor || '-'}</td>
      <td>${p.designer || '-'}</td>
      <td>${p.quantity || '-'}</td>
    </tr>`).join('');
}

// ── 미진행 제품 목록 렌더 ────────────────────────────────────
function renderNotStartedTables(processStats) {
  const container = el('not-started-tables');
  container.innerHTML = '';

  processStats.forEach((proc, i) => {
    const stateId = `proc-${i}`;
    const state   = getState(stateId);
    const hasItems = proc.notStarted > 0;
    const headerId = `ns-header-${i}`;
    const tableId  = `ns-table-${i}`;
    const tbodyId  = `ns-tbody-${i}`;

    const block = document.createElement('div');
    block.className = 'ns-block';

    // 정렬 헤더 HTML 생성
    const thHtml = COLUMNS.map(col => {
      if (!col.sortable) return `<th>${col.label}</th>`;
      return `<th class="sortable-th" data-key="${col.key}" data-idx="${i}">
        ${col.label}
        <span class="sort-icon" id="sort-icon-${i}-${col.key}">⇅</span>
      </th>`;
    }).join('');

    block.innerHTML = `
      <div class="ns-block-header" id="${headerId}">
        <span class="ns-block-title">${proc.name}</span>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="ns-badge ${hasItems ? '' : 'zero'}">
            ${hasItems ? `미진행 ${proc.notStarted}건` : '✔ 전체 진행 중'}
          </span>
          <span class="ns-chevron" id="chevron-${i}">▼</span>
        </div>
      </div>
      <div class="ns-table-wrap" id="${tableId}">
        <table class="ns-table">
          <thead>
            <tr>${thHtml}</tr>
          </thead>
          <tbody id="${tbodyId}">
            ${hasItems ? '' : '<tr class="empty-row"><td colspan="7">미진행 제품 없음</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    container.appendChild(block);

    const tbodyEl  = el(tbodyId);
    const header   = el(headerId);
    const tableWrap = el(tableId);
    const chevron  = el(`chevron-${i}`);

    // 초기 데이터 렌더
    if (hasItems) renderTbody(tbodyEl, proc.notStartedProducts, state);

    // 아코디언 토글 (필터 행 클릭이 전파되지 않도록)
    header.addEventListener('click', () => {
      const isOpen = tableWrap.classList.toggle('open');
      header.classList.toggle('open', isOpen);
      chevron.classList.toggle('open', isOpen);
    });

    // 미진행 있는 공정은 기본으로 펼침
    if (hasItems) {
      header.classList.add('open');
      tableWrap.classList.add('open');
      chevron.classList.add('open');
    }

    // 정렬 클릭 이벤트
    block.querySelectorAll('.sortable-th').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = key;
          state.sortDir = 'asc';
        }
        // 아이콘 업데이트
        block.querySelectorAll('.sort-icon').forEach(icon => icon.textContent = '⇅');
        el(`sort-icon-${i}-${key}`).textContent = state.sortDir === 'asc' ? '↑' : '↓';
        renderTbody(tbodyEl, proc.notStartedProducts, state);
      });
    });

  });
}

// ── 요약 통계 렌더 ────────────────────────────────────────────
function renderSummary(data) {
  const { processStats, totalProducts } = data;

  el('total-products').textContent = totalProducts + '개';
  el('total-processes').textContent = processStats.length + '개';

  const avgProgress = processStats.length > 0
    ? Math.round(processStats.reduce((s, p) => s + p.progressPercent, 0) / processStats.length)
    : 0;
  el('avg-progress').textContent = avgProgress + '%';

  const mostDelayed = processStats.reduce(
    (max, p) => p.notStarted > max.notStarted ? p : max,
    { notStarted: -1, name: '-' }
  );
  el('most-delayed').textContent = mostDelayed.notStarted > 0
    ? `${mostDelayed.name.substring(0, 8)}... (${mostDelayed.notStarted}건)`
    : '없음';
}

// ── 데이터 로드 메인 함수 ─────────────────────────────────────
async function loadData() {
  hide('auth-screen');
  hide('dashboard');
  hide('error-screen');
  show('loading');

  try {
    // 인증 상태 먼저 확인
    const authRes = await fetch('/api/auth-status');
    const authData = await authRes.json();

    if (!authData.authenticated) {
      hide('loading');
      show('auth-screen');
      return;
    }

    // 데이터 요청
    const res = await fetch('/api/data');

    if (res.status === 401) {
      hide('loading');
      show('auth-screen');
      return;
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '서버 오류가 발생했습니다.');
    }

    const data = await res.json();

    if (!data.processStats || data.processStats.length === 0) {
      throw new Error('스프레드시트에서 공정 데이터를 찾을 수 없습니다. 헤더 구조를 확인해주세요.');
    }

    // 렌더링
    renderSummary(data);
    renderProcessCards(data.processStats);
    renderNotStartedTables(data.processStats);

    if (data.updatedAt) {
      el('updated-at').textContent = `최근 업데이트: ${data.updatedAt}`;
    }

    hide('loading');
    show('dashboard');

  } catch (err) {
    console.error(err);
    hide('loading');
    el('error-msg').textContent = `오류: ${err.message}`;
    show('error-screen');
  }
}

// 페이지 로드 시 자동 실행
loadData();
