const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const SPREADSHEET_ID = '17b_Ra_EffLrpJLvH_LhoxQ2AZcmBC3kA_wEGaLRRhQQ';
const SHEET_GID = 193652624;
const TOKEN_PATH = path.join(__dirname, 'token.json');
const IS_PROD = !!process.env.GOOGLE_CREDENTIALS;
const REDIRECT_URI = IS_PROD
  ? `${process.env.APP_URL}/oauth2callback`
  : `http://localhost:${PORT}/oauth2callback`;

// 토큰 읽기 (배포: 환경변수 / 로컬: 파일)
function readToken() {
  if (IS_PROD) {
    const t = process.env.GOOGLE_TOKEN;
    return t ? JSON.parse(t) : null;
  }
  if (fs.existsSync(TOKEN_PATH)) return JSON.parse(fs.readFileSync(TOKEN_PATH));
  return null;
}

// 토큰 존재 여부
function hasToken() {
  if (IS_PROD) return !!process.env.GOOGLE_TOKEN;
  return fs.existsSync(TOKEN_PATH);
}

// 토큰 저장 (로컬만 저장, 배포 환경은 콘솔에 출력)
function saveToken(tokens) {
  if (IS_PROD) {
    // Vercel 환경에서는 직접 저장 불가 → 콘솔에 출력해서 환경변수로 수동 등록
    console.log('=== GOOGLE_TOKEN 환경변수에 아래 값을 등록하세요 ===');
    console.log(JSON.stringify(tokens));
    console.log('=====================================================');
  } else {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  }
}
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
];

app.use(express.static(path.join(__dirname, 'public')));

// OAuth2 클라이언트 생성 (로컬: credentials.json / 배포: 환경변수)
function getOAuth2Client() {
  let credentials;
  if (IS_PROD) {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  } else {
    const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  }
  const { client_secret, client_id } = credentials.installed || credentials.web;
  return new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);
}

// 스프레드시트 시트명 조회 (gid → 시트명)
async function getSheetName(auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.sheetId === SHEET_GID);
  if (!sheet) throw new Error(`시트 ID ${SHEET_GID}를 찾을 수 없습니다.`);
  return sheet.properties.title;
}

// 스프레드시트 데이터 가져오기
async function fetchSheetData(auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetName = await getSheetName(auth);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });
  return response.data.values || [];
}

// 구글 드라이브 공유 링크 → 프록시 URL 변환
function toDriveImageUrl(url) {
  if (!url) return '';
  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match) return `/api/image?id=${match[1]}`;
  return url;
}

// 대시보드에서 제외할 공정 키워드 (컨펌일 기준)
const EXCLUDED_PROCESSES = ['원단 Quality', '품평샘플', '부속B/T', '부자재', '메인원단'];
// 완료일 컬럼 중 포함할 공정 키워드
const INCLUDED_WANRYO = ['PP샘플', '입고샘플'];

// 데이터 파싱 및 공정별 현황 계산
function processData(rows) {
  const norm = c => (c || '').replace(/[\n\r]/g, '').trim();

  // 헤더 행 탐색 (NO. 또는 NO 와 제품명이 함께 있는 행)
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = (rows[i] || []).map(norm);
    const hasNO   = r.some(c => c === 'NO' || c === 'NO.');
    const hasName = r.some(c => c === '제품명');
    if (hasNO && hasName) { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) return { processStats: [], products: [] };

  const headerRow = (rows[headerRowIdx] || []).map(norm);

  // 공정명 행(0번째 행)에서 공정명 추출 (병합 셀: 첫 셀에만 값)
  const processNameRow = (rows[0] || []).map(norm);
  const propagated = [];
  let lastName = '';
  for (let i = 0; i < headerRow.length; i++) {
    if (processNameRow[i]) lastName = processNameRow[i];
    propagated[i] = lastName;
  }

  // 헤더 행에서 '컨펌일'/'완료일' 컬럼 인덱스 및 공정명 매핑
  const confirmCols = [];
  headerRow.forEach((cell, idx) => {
    const procName = propagated[idx] || `공정${confirmCols.length + 1}`;
    if (cell === '컨펌일') {
      const isExcluded = EXCLUDED_PROCESSES.some(ex => procName.includes(ex));
      if (!isExcluded) confirmCols.push({ idx, processName: procName });
    } else if (cell === '완료일') {
      const isIncluded = INCLUDED_WANRYO.some(kw => procName.includes(kw));
      if (isIncluded) confirmCols.push({ idx, processName: procName });
    }
  });

  // 주요 컬럼 인덱스
  const noIdx       = headerRow.findIndex(c => c === 'NO' || c === 'NO.');
  const nameIdx     = headerRow.findIndex(c => c === '제품명');
  const itemNoIdx   = headerRow.findIndex(c => c === '품번');
  const imageIdx      = headerRow.findIndex(c => c === 'url');
  const vendorIdx     = headerRow.findIndex(c => c === '업체');
  const categoryIdx   = headerRow.findIndex(c => c === '복종');
  const designerIdx   = headerRow.findIndex(c => c.includes('디자이너'));
  const qtyIdx        = headerRow.findIndex(c => c === '수량');
  const deliveryIdx   = headerRow.findIndex(c => c === '입고일') !== -1
    ? headerRow.findIndex(c => c === '입고일')
    : headerRow.findIndex(c => c === '입고예정일');

  // 데이터 행 파싱 (제품명이 있는 행만)
  const dataRows = rows
    .slice(headerRowIdx + 1)
    .filter(row => {
      const v = norm((row || [])[nameIdx] || '');
      return v !== '';
    });

  const products = dataRows.map(row => {
    const processStatus = {};
    confirmCols.forEach(col => {
      const val = norm((row || [])[col.idx] || '');
      // 빈 셀 = 미진행, 값 있음(N/A 포함) = 진행
      processStatus[col.processName] = val === '' ? '미진행' : '진행';
    });

    return {
      no: norm((row || [])[noIdx] || ''),
      name: norm((row || [])[nameIdx] || ''),
      itemNo: norm((row || [])[itemNoIdx] || ''),
      image: toDriveImageUrl(norm((row || [])[imageIdx] || '')),
      vendor: norm((row || [])[vendorIdx] || ''),
      category: norm((row || [])[categoryIdx] || ''),
      designer: norm((row || [])[designerIdx] || ''),
      quantity: norm((row || [])[qtyIdx] || ''),
      deliveryDate: norm((row || [])[deliveryIdx] || ''),
      processes: processStatus,
    };
  });

  // 공정별 통계 계산
  const processStats = confirmCols.map(col => {
    const total = products.length;
    const notStartedProducts = products.filter(
      p => p.processes[col.processName] === '미진행'
    );
    const inProgress = total - notStartedProducts.length;

    return {
      name: col.processName,
      total,
      inProgress,
      notStarted: notStartedProducts.length,
      progressPercent: total > 0 ? Math.round((inProgress / total) * 100) : 0,
      notStartedProducts: notStartedProducts.map(p => ({
        name: p.name,
        itemNo: p.itemNo,
        image: p.image,
        vendor: p.vendor,
        category: p.category,
        designer: p.designer,
        quantity: p.quantity,
      })),
    };
  });

  return { processStats, products, totalProducts: products.length };
}

// ─── 라우트 ───────────────────────────────────────────────

// 이미지 프록시: 구글 드라이브 파일을 서버에서 인증 후 전달
app.get('/api/image', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).send('id 파라미터 필요');

  try {
    const oAuth2Client = getOAuth2Client();
    oAuth2Client.setCredentials(readToken());

    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    const fileRes = await drive.files.get(
      { fileId: id, alt: 'media' },
      { responseType: 'stream' }
    );

    res.setHeader('Content-Type', fileRes.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fileRes.data.pipe(res);
  } catch (err) {
    console.error('이미지 프록시 오류:', err.message);
    res.status(500).send('이미지를 가져올 수 없습니다.');
  }
});

// 디버그: 헤더 구조를 행/열 인덱스와 함께 보기 쉽게 출력
app.get('/api/debug', async (req, res) => {
  try {
    const oAuth2Client = getOAuth2Client();
    oAuth2Client.setCredentials(readToken());
    const rows = await fetchSheetData(oAuth2Client);

    // 첫 6행을 인덱스와 함께 정리
    const formatted = rows.slice(0, 6).map((row, rowIdx) => {
      const cells = {};
      (row || []).forEach((cell, colIdx) => {
        if (cell && cell.toString().trim()) {
          cells[colIdx] = cell.toString().replace(/\n/g, '↵');
        }
      });
      return { row: rowIdx, cells };
    });

    // '컨펌일' 위치 찾기
    const confirmPositions = [];
    rows.slice(0, 6).forEach((row, rowIdx) => {
      (row || []).forEach((cell, colIdx) => {
        if ((cell || '').toString().replace(/\n/g, '').trim() === '컨펌일') {
          confirmPositions.push({ row: rowIdx, col: colIdx });
        }
      });
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({ totalRows: rows.length, confirmPositions, headerRows: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Google 인증 시작
app.get('/auth', (req, res) => {
  const oAuth2Client = getOAuth2Client();
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
  res.redirect(authUrl);
});

// OAuth 콜백 (구글이 code와 함께 리다이렉트)
app.get('/oauth2callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send(`인증 거부: ${error}`);
  if (!code) return res.status(400).send('인증 코드가 없습니다.');

  try {
    const oAuth2Client = getOAuth2Client();
    const { tokens } = await oAuth2Client.getToken(code);
    saveToken(tokens);
    console.log('✅ 인증 완료.');
    res.redirect('/');
  } catch (err) {
    console.error('토큰 교환 오류:', err.message);
    res.status(500).send(`인증 오류: ${err.message}`);
  }
});

// 대시보드 데이터 API
app.get('/api/data', async (req, res) => {
  try {
    if (!hasToken()) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const oAuth2Client = getOAuth2Client();
    oAuth2Client.setCredentials(readToken());

    // 토큰 갱신 시 자동 저장
    oAuth2Client.on('tokens', (newTokens) => {
      saveToken({ ...readToken(), ...newTokens });
    });

    const rows = await fetchSheetData(oAuth2Client);
    const data = processData(rows);
    data.updatedAt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    res.json(data);

  } catch (err) {
    console.error('API 오류:', err.message);
    if (err.message?.includes('invalid_grant') || err.code === 401) {
      if (!IS_PROD && fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
      return res.status(401).json({ error: 'token_expired' });
    }
    res.status(500).json({ error: err.message });
  }
});

// 캘린더용 입고 일정 API
app.get('/api/calendar', async (req, res) => {
  try {
    if (!hasToken()) return res.status(401).json({ error: 'unauthorized' });

    const oAuth2Client = getOAuth2Client();
    oAuth2Client.setCredentials(readToken());

    const rows = await fetchSheetData(oAuth2Client);
    const { products } = processData(rows);

    // 입고일이 있는 제품만 추출, 날짜별로 그룹핑
    const calendar = {};
    const thisYear = new Date().getFullYear();
    products.forEach(p => {
      if (!p.deliveryDate) return;
      // 요일 등 불필요한 문자 제거 후 파싱
      const raw = p.deliveryDate.replace(/\(.*?\)/g, '').trim();
      let dateKey = null;

      // "M/D" 또는 "MM/DD" 형태
      const md = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
      if (md) {
        dateKey = `${thisYear}-${String(md[1]).padStart(2,'0')}-${String(md[2]).padStart(2,'0')}`;
      }
      // "YYYY-MM-DD" 형태
      const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (iso) dateKey = raw;

      // "M월 D일" 형태
      const ko = raw.match(/^(\d{1,2})월\s*(\d{1,2})일$/);
      if (ko) {
        dateKey = `${thisYear}-${String(ko[1]).padStart(2,'0')}-${String(ko[2]).padStart(2,'0')}`;
      }

      if (!dateKey) return;
      if (!calendar[dateKey]) calendar[dateKey] = [];
      calendar[dateKey].push({
        name: p.name,
        itemNo: p.itemNo,
        category: p.category,
        vendor: p.vendor,
        quantity: p.quantity,
        image: p.image,
      });
    });

    res.json(calendar);
  } catch (err) {
    console.error('캘린더 API 오류:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 인증 상태 확인
app.get('/api/auth-status', (req, res) => {
  res.json({ authenticated: hasToken() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 서버 실행 중: http://localhost:${PORT}`);
  if (!hasToken()) {
    console.log(`⚠️  구글 인증 필요 → http://localhost:${PORT}/auth 접속\n`);
  } else {
    console.log('✅ 인증 완료. 대시보드 사용 가능\n');
  }
});
