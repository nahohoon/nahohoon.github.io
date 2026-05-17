(function () {
  var diagnosisRows = [];
  var policyRows = [];
  var selectedIndex = -1;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cell(row, key) {
    return MatchingEngine.cell(row, key);
  }

  function formatDateKST(value) {
    return MatchingEngine.formatDateKST(value);
  }

  function formatLoanAmount(value) {
    var v = String(value || '').trim();
    if (!v) return '';
    if (/백만|억|원/.test(v)) return v;
    return v + ' (백만원)';
  }

  function setStatus(text, isError) {
    var el = document.getElementById('load-status');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-error', !!isError);
  }

  function gasUrl(action) {
    var base = (CONFIG.GAS_URL || '').trim();
    if (!base) throw new Error('CONFIG.GAS_URL이 설정되지 않았습니다.');
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'action=' + encodeURIComponent(action) + '&ts=' + Date.now();
  }

  async function fetchGas(action) {
    var res = await fetch(gasUrl(action));
    var text = await res.text();
    var result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error('API 응답 파싱 실패');
    }
    if (!res.ok || result.success !== true) {
      throw new Error((result && result.error) || '데이터 조회 실패');
    }
    return result;
  }

  function fieldRow(label, value) {
    var raw = value === undefined || value === null ? '' : value;
    if (raw instanceof Date) {
      raw = formatDateKST(raw);
    }
    var text = String(raw).trim();
    var v = text ? escapeHtml(text) : '<span class="muted">-</span>';
    return '<div class="detail-field"><dt>' + escapeHtml(label) + '</dt><dd>' + v + '</dd></div>';
  }

  function sectionHead(title) {
    return (
      '<' + 'div class="detail-section-head" style="grid-column:1/-1;margin-top:.75rem;padding-top:.55rem;border-top:1px solid #dde4ef;font-size:.78rem;font-weight:700;color:#0f2448">' +
        escapeHtml(title) +
      '</' + 'di' + 'v' + '>'
    );
  }

  function renderCompanyList() {
    var list = document.getElementById('company-list');
    var countEl = document.getElementById('company-count');
    if (!list) return;

    countEl.textContent = diagnosisRows.length + '건';

    if (!diagnosisRows.length) {
      list.innerHTML = '<p class="panel-empty">CONSULT_PIPELINE에 표시할 업체가 없습니다.</p>';
      return;
    }

    list.innerHTML = diagnosisRows.map(function (row, idx) {
      var active = idx === selectedIndex ? ' is-active' : '';
      var status = cell(row, '상태');
      var statusHtml = status
        ? '<span class="list-badge">' + escapeHtml(status) + '</span>'
        : '';
      return (
        '<button type="button" class="company-item' + active + '" data-index="' + idx + '">' +
          '<span class="company-item-name">' + escapeHtml(cell(row, '업체명')) + '</span>' +
          '<span class="company-item-meta">' +
            escapeHtml(cell(row, '업종') || '-') + ' · ' +
            escapeHtml(formatDateKST(cell(row, '접수일'))) +
          '</span>' +
          statusHtml +
        '</button>'
      );
    }).join('');

    list.querySelectorAll('.company-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectCompany(parseInt(btn.getAttribute('data-index'), 10));
      });
    });
  }

  function renderCompanyDetail() {
    var panel = document.getElementById('company-detail');
    if (!panel) return;

    if (selectedIndex < 0 || !diagnosisRows[selectedIndex]) {
      panel.innerHTML = '<p class="panel-empty">좌측에서 업체를 선택하세요.</p>';
      return;
    }

    var row = diagnosisRows[selectedIndex];
    var receivedLabel = formatDateKST(cell(row, '접수일'));
    var status = cell(row, '상태');

    panel.innerHTML =
      '<div class="detail-header">' +
        '<h2>' + escapeHtml(cell(row, '업체명')) + '</h2>' +
        '<p class="detail-sub">' +
          escapeHtml(cell(row, '접수번호')) +
          (status ? ' · ' + escapeHtml(status) : '') +
          (receivedLabel ? ' · ' + escapeHtml(receivedLabel) : '') +
        '</p>' +
      '</div>' +
      '<dl class="detail-grid">' +
        fieldRow('접수번호', cell(row, '접수번호')) +
        fieldRow('접수일', receivedLabel) +
        fieldRow('상태', status) +
        sectionHead('기본정보') +
        fieldRow('업체명', cell(row, '업체명')) +
        fieldRow('담당자', cell(row, '담당자')) +
        fieldRow('연락처', cell(row, '연락처')) +
        fieldRow('이메일', cell(row, '이메일')) +
        fieldRow('지역', cell(row, '지역')) +
        fieldRow('업종', cell(row, '업종')) +
        fieldRow('사업자유형', cell(row, '사업자유형')) +
        fieldRow('사업자형태', cell(row, '사업자형태')) +
        sectionHead('진단정보') +
        fieldRow('연매출규모', cell(row, '연매출규모') || cell(row, '연매출')) +
        fieldRow('종업원수', cell(row, '종업원수')) +
        fieldRow('자금유형', cell(row, '자금유형')) +
        fieldRow('현재애로사항', cell(row, '현재애로사항')) +
        fieldRow('세금체납여부', cell(row, '세금체납여부')) +
        fieldRow('신용상태', cell(row, '신용상태')) +
        sectionHead('정책자금 판단정보') +
        fieldRow('기존대출여부', MatchingEngine.displayExistingLoanFlag(row)) +
        fieldRow('기존대출금액', formatLoanAmount(cell(row, '기존대출금액'))) +
        fieldRow('희망대출금액', formatLoanAmount(cell(row, '희망대출금액'))) +
        fieldRow('인증보유여부', cell(row, '인증보유여부')) +
        fieldRow('기타인증', cell(row, '기타인증')) +
        fieldRow('신용점수', cell(row, '신용점수')) +
        fieldRow('부채비율', cell(row, '부채비율')) +
        fieldRow('업력', cell(row, '업력')) +
        fieldRow('정책자금신청경험', cell(row, '정책자금신청경험')) +
        fieldRow('재무자료보유여부', cell(row, '재무자료보유여부')) +
      '</dl>';

    renderRecommendations();
  }

  function renderRecommendations() {
    var panel = document.getElementById('match-results');
    var countEl = document.getElementById('match-count');
    if (!panel) return;

    if (selectedIndex < 0 || !diagnosisRows[selectedIndex]) {
      panel.innerHTML = '<p class="panel-empty">업체 선택 후 추천 정책이 표시됩니다.</p>';
      if (countEl) countEl.textContent = '';
      return;
    }

    if (!policyRows.length) {
      panel.innerHTML = '<p class="panel-empty">정책 DB가 비어 있습니다. 구글시트 「정책자금매칭」 탭을 확인하세요.</p>';
      if (countEl) countEl.textContent = '0건';
      return;
    }

    var out = MatchingEngine.recommend(
      diagnosisRows[selectedIndex],
      policyRows,
      CONFIG.MATCH.MIN_SCORE
    );

    if (countEl) countEl.textContent = out.results.length + '건';

    if (!out.results.length) {
      panel.innerHTML =
        '<p class="panel-empty">조건에 맞는 추천 정책이 없습니다.<br>룰 조건을 완화하거나 정책 DB·고객 정보를 확인하세요.</p>';
      return;
    }

    panel.innerHTML = out.results.map(function (r, i) {
      var p = r.policy;
      var tags = r.reasons.slice(0, 5).map(function (t) {
        return '<span class="match-tag">' + escapeHtml(t) + '</span>';
      }).join('');

      var link = (p.applyLink || '').trim();
      var linkBtn = '';
      if (link) {
        var href = /^https?:\/\//i.test(link) ? link : 'https://' + link;
        linkBtn =
          '<a class="match-apply-btn" href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">신청 바로가기</a>';
      }

      function detailRow(label, value) {
        if (!value) return '';
        return (
          '<div class="match-detail-row">' +
            '<span class="match-detail-label">' + escapeHtml(label) + '</span>' +
            '<span class="match-detail-value">' + escapeHtml(value) + '</span>' +
          '</div>'
        );
      }

      return (
        '<article class="match-card">' +
          '<div class="match-card-head">' +
            '<span class="match-rank">#' + (i + 1) + '</span>' +
            '<span class="match-score">' + r.score + '점</span>' +
          '</div>' +
          '<h3 class="match-name">' + escapeHtml(p.name) + '</h3>' +
          '<p class="match-org">' + escapeHtml(p.org || '-') + '</p>' +
          '<div class="match-details">' +
            detailRow('지원내용', p.supportContent) +
            detailRow('신청기간', p.applyPeriod) +
            detailRow('필요서류', p.requiredDocs) +
          '</div>' +
          '<div class="match-tags">' + tags + '</div>' +
          (p.memo ? '<p class="match-memo">' + escapeHtml(p.memo) + '</p>' : '') +
          (linkBtn ? '<div class="match-actions">' + linkBtn + '</div>' : '') +
        '</article>'
      );
    }).join('');
  }

  function selectCompany(index) {
    selectedIndex = index;
    renderCompanyList();
    renderCompanyDetail();
  }

  async function loadAll() {
    var btn = document.getElementById('btn-refresh');
    btn.disabled = true;
    setStatus('불러오는 중…');

    try {
      var pipeline = await fetchGas(CONFIG.API.PIPELINE);
      var policies = await fetchGas(CONFIG.API.POLICIES);

      var rawRows = Array.isArray(pipeline.rows) ? pipeline.rows : [];
      diagnosisRows = MatchingEngine.preparePipelineRows(rawRows);
      policyRows = Array.isArray(policies.rows) ? policies.rows : [];

      if (selectedIndex >= diagnosisRows.length) {
        selectedIndex = diagnosisRows.length ? 0 : -1;
      }
      if (selectedIndex < 0 && diagnosisRows.length) {
        selectedIndex = 0;
      }

      renderCompanyList();
      renderCompanyDetail();

      setStatus(
        '진단 ' + diagnosisRows.length + '건 · 정책 ' + policyRows.length + '건 · ' + formatNow()
      );
    } catch (err) {
      console.error(err);
      setStatus(err.message || '오류', true);
      diagnosisRows = [];
      policyRows = [];
      selectedIndex = -1;
      renderCompanyList();
      renderCompanyDetail();
    } finally {
      btn.disabled = false;
    }
  }

  function formatNow() {
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : n; };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ' 갱신';
  }

  function filterCompanies() {
    var q = (document.getElementById('company-search').value || '').trim().toLowerCase();
    if (!q) {
      renderCompanyList();
      return;
    }

    var filtered = diagnosisRows.filter(function (row) {
      var blob = [
        cell(row, '업체명'),
        cell(row, '업종'),
        cell(row, '지역'),
        cell(row, '접수번호')
      ].join(' ').toLowerCase();
      return blob.indexOf(q) >= 0;
    });

    filtered = MatchingEngine.sortByReceivedAtDesc(filtered);

    var list = document.getElementById('company-list');
    document.getElementById('company-count').textContent = filtered.length + '건';

    if (!filtered.length) {
      list.innerHTML = '<p class="panel-empty">검색 결과가 없습니다.</p>';
      return;
    }

    list.innerHTML = filtered.map(function (row) {
      var idx = diagnosisRows.indexOf(row);
      var active = idx === selectedIndex ? ' is-active' : '';
      return (
        '<button type="button" class="company-item' + active + '" data-index="' + idx + '">' +
          '<span class="company-item-name">' + escapeHtml(cell(row, '업체명')) + '</span>' +
          '<span class="company-item-meta">' + escapeHtml(cell(row, '업종') || '-') + '</span>' +
        '</button>'
      );
    }).join('');

    list.querySelectorAll('.company-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectCompany(parseInt(btn.getAttribute('data-index'), 10));
      });
    });
  }

  document.getElementById('btn-refresh').addEventListener('click', loadAll);
  document.getElementById('company-search').addEventListener('input', filterCompanies);

  loadAll();
})();
