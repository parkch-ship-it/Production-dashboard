let allProducts = [];
let sortCol = '';
let sortDir = 1; // 1 = 오름차순, -1 = 내림차순

function el(id) { return document.getElementById(id); }
function show(id) { el(id).classList.remove('hidden'); }
function hide(id) { el(id).classList.add('hidden'); }

// ── 정렬 ─────────────────────────────────────
function sortBy(col) {
  if (sortCol === col) {
    sortDir *= -1;
  } else {
    sortCol = col;
    sortDir = 1;
  }

  // 헤더 아이콘 업데이트
  document.querySelectorAll('.sortable-th').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (th.dataset.col === col) {
      icon.textContent = sortDir === 1 ? '↑' : '↓';
      th.classList.add('sorted');
    } else {
      icon.textContent = '↕';
      th.classList.remove('sorted');
    }
  });

  const sorted = [...allProducts].sort((a, b) => {
    let va = a[col] || '';
    let vb = b[col] || '';
    // 수량은 숫자 정렬
    if (col === 'quantity') {
      va = Number(String(va).replace(/,/g, '')) || 0;
      vb = Number(String(vb).replace(/,/g, '')) || 0;
      return (va - vb) * sortDir;
    }
    return va.localeCompare(vb, 'ko') * sortDir;
  });

  renderTable(sorted);
}

// ── 테이블 렌더 ───────────────────────────────
function renderTable(products) {
  const tbody = el('products-tbody');
  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:#9ca3af;">데이터가 없습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => {
    const qty = Number(String(p.quantity || '0').replace(/,/g, ''));
    return `
      <tr class="clickable-row" onclick="openDetail(${JSON.stringify(p).replace(/"/g, '&quot;')})">
        <td>${p.category || '-'}</td>
        <td><span class="product-name-link">${p.name || '-'}</span></td>
        <td class="mono">${p.itemNo || '-'}</td>
        <td class="img-cell">
          ${p.image
            ? `<img src="${p.image}" alt="도식화" class="product-thumb" onerror="this.style.display='none'">`
            : '<div class="thumb-placeholder">👕</div>'}
        </td>
        <td>${p.vendor || '-'}</td>
        <td>${p.designer || '-'}</td>
        <td class="qty-cell">${qty > 0 ? qty.toLocaleString() + '개' : '-'}</td>
      </tr>
    `;
  }).join('');
}

// ── 상세 팝업 ─────────────────────────────────
function openDetail(p) {
  const img = el('detail-img');
  const placeholder = el('detail-img-placeholder');

  if (p.image) {
    img.src = p.image;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'flex';
  }

  el('detail-name').textContent = p.name || '-';
  el('d-category').textContent  = p.category || '-';
  el('d-itemNo').textContent    = p.itemNo || '-';
  el('d-color').textContent     = p.color || '-';
  el('d-quantity').textContent  = (() => {
    const q = Number(String(p.quantity || '0').replace(/,/g, ''));
    return q > 0 ? q.toLocaleString() + '개' : '-';
  })();
  el('d-designer').textContent  = p.designer || '-';
  el('d-vendor').textContent    = p.vendor || '-';
  el('d-material').textContent  = p.material || '-';
  el('d-weight').textContent    = p.weight || '-';
  el('d-fiber').textContent     = p.fiber || '-';
  el('d-kcno').textContent      = p.kcno || '-';
  el('d-mfgDate').textContent   = p.mfgDate || '-';
  el('d-origin').textContent    = p.origin || '-';

  show('detail-overlay');
}

function closeDetail() { hide('detail-overlay'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });

// ── 정렬 헤더 이벤트 ──────────────────────────
document.querySelectorAll('.sortable-th').forEach(th => {
  th.addEventListener('click', () => sortBy(th.dataset.col));
});

// ── 데이터 로드 ──────────────────────────────
async function loadProducts() {
  hide('products-wrap');
  hide('error-screen');
  show('loading');

  try {
    const res = await fetch('/api/products');
    if (res.status === 401) { location.href = '/auth'; return; }
    if (!res.ok) throw new Error((await res.json()).error || '서버 오류');

    allProducts = await res.json();
    el('product-count').textContent = `총 ${allProducts.length}개 제품`;
    el('updated-at').textContent = `최근 업데이트: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;

    hide('loading');
    show('products-wrap');
    renderTable(allProducts);
  } catch (err) {
    hide('loading');
    el('error-msg').textContent = `오류: ${err.message}`;
    show('error-screen');
  }
}

loadProducts();
