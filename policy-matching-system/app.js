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

  function renderCompanyList() {
    var list = document.getElementById('company-list');
    var countEl = document.getElementById('company-count');
    if (!list) return;

    countEl.textContent = diagnosisRows.length + '건';

    if (!diagnosisRows.length) {
      list.innerHTML = '<p class="panel-empty">진단 DB에 업체가 없습니다.</p>';
      return;
    }

    list.innerHTML = diagnosisRows.map(function (row, idx) {
      var c = MatchingEngine.extractCustomer(row);
      var active = idx === selectedIndex ? ' is-active' : '';
      var status = c.status ? '<span class="list-badge">' + escapeHtml(c.status) + '</span>' : '';
      return (
        '<button type="button" class="company-item' + active + '" data-index="' + idx + '">' +
          '<span class="company-item-name">' + escapeHtml(c.company || '(업체명 없음)') + '</span>' +
          '<span class="company-item-meta">' + escapeHtml(c.industry || '-') + ' · ' + escapeHtml(c.receivedAt || '') + '</span>' +
          status +
        '</button>'
      );
    }).join('');

    list.querySelectorAll('.company-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectCompany(parseInt(btn.getAttribute('data-index'), 10));
      });
    });
  }

  function fieldRow(label, value) {
    var v = value ? escapeHtml(value) : '<span class="muted">-</span>';
    return '<div class="detail-field"><dt>' + escapeHtml(label) + '</dt><dd>' + v + '</dd></div>';
  }

  function renderCompanyDetail() {
    var panel = document.getElementById('company-detail');
    if (!panel) return;

    if (selectedIndex < 0 || !diagnosisRows[selectedIndex]) {
      panel.innerHTML = '<p class="panel-empty">좌측에서 업체를 선택하세요.</p>';
      return;
    }

    var row = diagnosisRows[selectedIndex];
    var c = MatchingEngine.extractCustomer(row);

    panel.innerHTML =
      '<div class="detail-header">' +
        '<h2>' + escapeHtml(c.company || '(업체명 없음)') + '</h2>' +
        '<p class="detail-sub">' + escapeHtml(c.receiptNo || '') + (c.status ? ' · ' + escapeHtml(c.status) : '') + '</p>' +
      '</div>' +
      '<dl class="detail-grid">' +
        fieldRow('접수일', c.receivedAt) +
        fieldRow('업종', c.industry) +
        fieldRow('지역', c.region) +
        fieldRow('사업자 유형', c.bizType) +
        fieldRow('업력', c.years) +
        fieldRow('연매출', c.revenue) +
        fieldRow('종업원 수', c.employees) +
        fieldRow('자금 유형', c.fundType) +
        fieldRow('희망 자금', c.desiredLoan ? c.desiredLoan + ' (백만원)' : '') +
        fieldRow('기존 대출', c.existingLoan ? c.existingLoan + ' (백만원)' : '') +
        fieldRow('보유 인증', c.certifications) +
        fieldRow('신용 상태', c.credit) +
        fieldRow('애로사항', c.concerns) +
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

      diagnosisRows = Array.isArray(pipeline.rows) ? pipeline.rows : [];
      policyRows = Array.isArray(policies.rows) ? policies.rows : [];

      if (selectedIndex >= diagnosisRows.length) selectedIndex = diagnosisRows.length ? 0 : -1;
      if (selectedIndex < 0 && diagnosisRows.length) selectedIndex = 0;

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
      var c = MatchingEngine.extractCustomer(row);
      var blob = [c.company, c.industry, c.region, c.receiptNo].join(' ').toLowerCase();
      return blob.indexOf(q) >= 0;
    });

    var list = document.getElementById('company-list');
    document.getElementById('company-count').textContent = filtered.length + '건';

    if (!filtered.length) {
      list.innerHTML = '<p class="panel-empty">검색 결과가 없습니다.</p>';
      return;
    }

    list.innerHTML = filtered.map(function (row) {
      var idx = diagnosisRows.indexOf(row);
      var c = MatchingEngine.extractCustomer(row);
      var active = idx === selectedIndex ? ' is-active' : '';
      return (
        '<button type="button" class="company-item' + active + '" data-index="' + idx + '">' +
          '<span class="company-item-name">' + escapeHtml(c.company || '(업체명 없음)') + '</span>' +
          '<span class="company-item-meta">' + escapeHtml(c.industry || '-') + '</span>' +
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
