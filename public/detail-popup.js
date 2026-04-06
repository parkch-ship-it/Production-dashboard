// ── 공유 상세 팝업 ────────────────────────────
function openDetailPopup(p) {
  const overlay = document.getElementById('detail-overlay');
  const img = document.getElementById('detail-img');
  const placeholder = document.getElementById('detail-img-placeholder');

  if (p.image) {
    img.src = p.image;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'flex';
  }

  document.getElementById('detail-name').textContent    = p.name || '-';
  document.getElementById('d-category').textContent     = p.category || '-';
  document.getElementById('d-itemNo').textContent       = p.itemNo || '-';
  document.getElementById('d-color').textContent        = p.color || '-';
  document.getElementById('d-quantity').textContent     = (() => {
    const q = Number(String(p.quantity || '0').replace(/,/g, ''));
    return q > 0 ? q.toLocaleString() + '개' : '-';
  })();
  document.getElementById('d-designer').textContent    = p.designer || '-';
  document.getElementById('d-vendor').textContent      = p.vendor || '-';
  document.getElementById('d-material').textContent    = p.material || '-';
  document.getElementById('d-weight').textContent      = p.weight || '-';
  document.getElementById('d-fiber').textContent       = p.fiber || '-';
  document.getElementById('d-kcno').textContent        = p.kcno || '-';
  document.getElementById('d-mfgDate').textContent     = p.mfgDate || '-';
  document.getElementById('d-origin').textContent      = p.origin || '-';

  overlay.classList.remove('hidden');
}

function closeDetailPopup() {
  document.getElementById('detail-overlay').classList.add('hidden');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDetailPopup();
});
