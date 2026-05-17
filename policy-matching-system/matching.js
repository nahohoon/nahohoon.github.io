/**
 * 룰 기반 정책자금 매칭 엔진
 * 정책 DB 시트 헤더: 사업명, 주관기관, 지원대상, 지역, 업종,
 * 창업연수최소, 창업연수최대, 매출최소, 매출최대, 종업원최소, 종업원최대,
 * 자금목적, 지원내용, 신청기간, 신청링크, 필요서류, 비고
 * 매출 단위: 만원 (예: 8억 = 80000, 상한 10억 = 100000)
 */
const MatchingEngine = (function () {
  /** 진단 폼 연매출 구간 → 만원 */
  const CUSTOMER_REVENUE_MANWON = {
    '1억 미만': { min: 0, max: 10000 },
    '1~5억': { min: 10000, max: 50000 },
    '5~10억': { min: 50000, max: 100000 },
    '10~30억': { min: 100000, max: 300000 },
    '30억 이상': { min: 300000, max: 999999999 }
  };

  /** 진단 폼 업력 → 연수 */
  const CUSTOMER_YEARS = {
    '1년 미만': { min: 0, max: 1 },
    '1~3년': { min: 1, max: 3 },
    '3~7년': { min: 3, max: 7 },
    '7년 이상': { min: 7, max: 99 }
  };

  /** 진단 폼 종업원 → 명 */
  const CUSTOMER_EMPLOYEES = {
    '1인': { min: 1, max: 1 },
    '2~4명': { min: 2, max: 4 },
    '5~9명': { min: 5, max: 9 },
    '10~49명': { min: 10, max: 49 },
    '50명 이상': { min: 50, max: 99999 }
  };

  function normalizeRow(row) {
    if (!row || typeof row !== 'object') return {};
    var out = {};
    Object.keys(row).forEach(function (key) {
      var nk = String(key).replace(/^\uFEFF/, '').trim();
      out[nk] = row[key];
    });
    return out;
  }

  /** CONSULT_PIPELINE 한글 헤더 단일 키 조회 */
  function cell(row, key) {
    var r = normalizeRow(row);
    var v = r[key];
    if (v === undefined || v === null) return '';
    if (v instanceof Date) return v;
    return String(v).trim();
  }

  function pick(row, keys) {
    if (!row) return '';
    for (var i = 0; i < keys.length; i++) {
      var v = cell(row, keys[i]);
      if (v !== '') return typeof v === 'string' ? v : String(v);
    }
    return '';
  }

  function parseDateValue(v) {
    if (v === '' || v === null || v === undefined) return 0;
    if (v instanceof Date && !isNaN(v.getTime())) return v.getTime();
    var d = new Date(v);
    if (!isNaN(d.getTime())) return d.getTime();
    var normalized = String(v).replace(' ', 'T');
    var d2 = new Date(normalized);
    if (!isNaN(d2.getTime())) return d2.getTime();
    return 0;
  }

  function formatDateKST(value) {
    if (value === '' || value === null || value === undefined) return '';
    if (value instanceof Date && !isNaN(value.getTime())) {
      return formatDateKSTFromDate(value);
    }
    var s = String(value).trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) {
      return s.slice(0, 16);
    }
    var d = new Date(s);
    if (isNaN(d.getTime())) {
      d = new Date(s.replace(' ', 'T'));
    }
    if (isNaN(d.getTime())) return s;
    return formatDateKSTFromDate(d);
  }

  function formatDateKSTFromDate(d) {
    try {
      var parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).formatToParts(d);
      var map = {};
      parts.forEach(function (p) {
        if (p.type !== 'literal') map[p.type] = p.value;
      });
      return map.year + '-' + map.month + '-' + map.day + ' ' + map.hour + ':' + map.minute;
    } catch (e) {
      return String(d);
    }
  }

  function normalizeText(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[·・]/g, '');
  }

  function parseSheetNumber(val) {
    if (val === '' || val === null || val === undefined) return null;
    if (typeof val === 'number' && !isNaN(val)) return val;
    var s = String(val).replace(/,/g, '').trim();
    if (!s || s === '-') return null;
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  function rangesOverlap(a, b) {
    if (!a || !b) return true;
    return a.min <= b.max && b.min <= a.max;
  }

  function policyNumericRange(minVal, maxVal) {
    var min = parseSheetNumber(minVal);
    var max = parseSheetNumber(maxVal);
    if (min === null && max === null) return null;
    return {
      min: min !== null ? min : 0,
      max: max !== null ? max : 999999999
    };
  }

  function customerYearsRange(label) {
    var key = String(label || '').trim();
    if (!key || key === '잘 모름') return null;
    if (CUSTOMER_YEARS[key]) return CUSTOMER_YEARS[key];
    var nums = key.match(/[\d.]+/g);
    if (!nums || !nums.length) return null;
    if (nums.length >= 2) {
      return { min: parseFloat(nums[0]), max: parseFloat(nums[1]) };
    }
    var y = parseFloat(nums[0]);
    if (key.indexOf('이상') >= 0) return { min: y, max: 99 };
    if (key.indexOf('미만') >= 0) return { min: 0, max: y };
    return { min: y, max: y };
  }

  function customerRevenueRangeManwon(label) {
    var key = String(label || '').trim();
    if (!key || key === '잘 모름') return null;
    if (CUSTOMER_REVENUE_MANWON[key]) return CUSTOMER_REVENUE_MANWON[key];

    var s = normalizeText(key);
    var nums = key.match(/[\d.]+/g);
    if (!nums || !nums.length) return null;

    function toManwon(eok) {
      return eok * 10000;
    }

    if (s.indexOf('억') >= 0) {
      var values = nums.map(function (n) { return toManwon(parseFloat(n)); });
      if (values.length >= 2 || s.indexOf('~') >= 0) {
        return { min: values[0], max: values[1] || values[0] };
      }
      if (s.indexOf('이상') >= 0) return { min: values[0], max: 999999999 };
      if (s.indexOf('미만') >= 0 || s.indexOf('이하') >= 0) {
        return { min: 0, max: values[0] };
      }
      return { min: values[0], max: values[0] };
    }

    var n = parseFloat(nums[0]);
    return { min: n, max: n };
  }

  function customerEmployeesRange(label) {
    var key = String(label || '').trim();
    if (!key || key === '잘 모름') return null;
    if (CUSTOMER_EMPLOYEES[key]) return CUSTOMER_EMPLOYEES[key];
    var nums = key.match(/[\d.]+/g);
    if (!nums || !nums.length) return null;
    if (nums.length >= 2) {
      return { min: parseFloat(nums[0]), max: parseFloat(nums[1]) };
    }
    var n = parseFloat(nums[0]);
    if (key.indexOf('이상') >= 0) return { min: n, max: 99999 };
    return { min: n, max: n };
  }

  function matchIndustry(customerIndustry, policyIndustry) {
    var c = normalizeText(customerIndustry);
    var p = normalizeText(policyIndustry);
    if (!p) return { pass: true, score: 12, note: '업종 조건 없음' };
    if (p === '전업종' || p.indexOf('전업종') >= 0) {
      return { pass: true, score: 18, note: '전업종' };
    }
    if (!c) return { pass: true, score: 6, note: '업종 미입력' };

    var keywords = p.split(/[,/|·]/).map(function (k) { return normalizeText(k); }).filter(Boolean);
    if (!keywords.length) keywords = [p];

    var hit = keywords.some(function (k) {
      return c.indexOf(k) >= 0 || k.indexOf(c) >= 0;
    });
    return hit
      ? { pass: true, score: 20, note: '업종 일치' }
      : { pass: false, score: 0, note: '업종 불일치' };
  }

  function matchStartupYears(customerYears, yearsMin, yearsMax) {
    var c = customerYearsRange(customerYears);
    var p = policyNumericRange(yearsMin, yearsMax);
    if (!p) return { pass: true, score: 15, note: '창업연수 무관' };
    if (!c) return { pass: true, score: 8, note: '업력 미입력' };
    var pass = rangesOverlap(c, p);
    return {
      pass: pass,
      score: pass ? 15 : 0,
      note: pass
        ? '창업연수 ' + p.min + '~' + (p.max >= 999999999 ? '∞' : p.max) + '년 충족'
        : '창업연수 미충족'
    };
  }

  function matchRevenueManwon(customerRevenue, revenueMin, revenueMax) {
    var c = customerRevenueRangeManwon(customerRevenue);
    var p = policyNumericRange(revenueMin, revenueMax);
    if (!p) return { pass: true, score: 15, note: '매출 무관' };
    if (!c) return { pass: true, score: 8, note: '매출 미입력' };
    var pass = rangesOverlap(c, p);
    return {
      pass: pass,
      score: pass ? 15 : 0,
      note: pass ? '매출 구간 충족' : '매출 구간 미충족'
    };
  }

  function matchEmployees(customerEmployees, empMin, empMax) {
    var c = customerEmployeesRange(customerEmployees);
    var p = policyNumericRange(empMin, empMax);
    if (!p) return { pass: true, score: 12, note: '종업원 무관' };
    if (!c) return { pass: true, score: 6, note: '종업원 미입력' };
    var pass = rangesOverlap(c, p);
    return {
      pass: pass,
      score: pass ? 12 : 0,
      note: pass ? '종업원 수 충족' : '종업원 수 미충족'
    };
  }

  function matchFundPurpose(customerFund, policyPurpose) {
    var c = normalizeText(customerFund);
    var p = normalizeText(policyPurpose);
    if (!p) return { pass: true, score: 12, note: '자금목적 무관' };
    if (!c || c.indexOf('모름') >= 0) return { pass: true, score: 6, note: '자금목적 미확정' };

    if (p.indexOf(c) >= 0 || c.indexOf(p) >= 0) {
      return { pass: true, score: 15, note: '자금목적 일치' };
    }

    var tokens = ['운전', '시설', '창업', '긴급', '운영', '설비', '보증'];
    var matched = tokens.filter(function (t) {
      return c.indexOf(t) >= 0 && p.indexOf(t) >= 0;
    });
    if (matched.length) {
      return { pass: true, score: 12, note: '자금목적 부분일치' };
    }

    return { pass: false, score: 0, note: '자금목적 불일치' };
  }

  function deriveExistingLoanFlag(amountStr, flagStr) {
    if (flagStr === '있음' || flagStr === '없음') return flagStr;
    var n = parseFloat(String(amountStr || '').replace(/,/g, '').trim());
    if (!isNaN(n) && n > 0) return '있음';
    return flagStr || '없음';
  }

  function displayExistingLoanFlag(row) {
    var flag = cell(row, '기존대출여부');
    if (flag === '있음' || flag === '없음') return flag;
    return deriveExistingLoanFlag(cell(row, '기존대출금액'), flag);
  }

  /** 매칭 엔진용 (정책 비교) */
  function extractCustomer(row) {
    var existingLoan = cell(row, '기존대출금액');
    return {
      industry: cell(row, '업종'),
      years: cell(row, '업력'),
      revenue: pick(row, ['연매출규모', '연매출']),
      employees: cell(row, '종업원수'),
      fundType: cell(row, '자금유형')
    };
  }

  function hasCompanyName(row) {
    return !!cell(row, '업체명');
  }

  function sortByReceivedAtDesc(rows) {
    return (rows || []).slice().sort(function (a, b) {
      return parseDateValue(cell(b, '접수일')) - parseDateValue(cell(a, '접수일'));
    });
  }

  function preparePipelineRows(rows) {
    return sortByReceivedAtDesc(
      (rows || []).filter(hasCompanyName)
    );
  }

  function extractPolicy(row) {
    return {
      name: pick(row, ['사업명']),
      org: pick(row, ['주관기관']),
      target: pick(row, ['지원대상']),
      region: pick(row, ['지역']),
      industry: pick(row, ['업종']),
      yearsMin: pick(row, ['창업연수최소']),
      yearsMax: pick(row, ['창업연수최대']),
      revenueMin: pick(row, ['매출최소']),
      revenueMax: pick(row, ['매출최대']),
      employeesMin: pick(row, ['종업원최소']),
      employeesMax: pick(row, ['종업원최대']),
      fundPurpose: pick(row, ['자금목적']),
      supportContent: pick(row, ['지원내용']),
      applyPeriod: pick(row, ['신청기간']),
      applyLink: pick(row, ['신청링크']),
      requiredDocs: pick(row, ['필요서류']),
      memo: pick(row, ['비고']),
      raw: row
    };
  }

  function matchPolicy(customer, policy) {
    var checks = [
      matchIndustry(customer.industry, policy.industry),
      matchStartupYears(customer.years, policy.yearsMin, policy.yearsMax),
      matchRevenueManwon(customer.revenue, policy.revenueMin, policy.revenueMax),
      matchEmployees(customer.employees, policy.employeesMin, policy.employeesMax),
      matchFundPurpose(customer.fundType, policy.fundPurpose)
    ];

    var failed = checks.filter(function (c) { return !c.pass; });
    var score = checks.reduce(function (sum, c) { return sum + (c.score || 0); }, 0);
    var maxScore = 74;
    var percent = Math.min(100, Math.round((score / maxScore) * 100));

    return {
      policy: policy,
      score: percent,
      passed: failed.length === 0,
      checks: checks,
      reasons: checks.map(function (c) { return c.note; }).filter(Boolean)
    };
  }

  function recommend(customerRow, policyRows, minScore) {
    var customer = extractCustomer(customerRow);
    var threshold = typeof minScore === 'number' ? minScore : 60;

    var results = (policyRows || [])
      .map(function (row) {
        var policy = extractPolicy(row);
        if (!policy.name) return null;
        return matchPolicy(customer, policy);
      })
      .filter(Boolean)
      .filter(function (r) { return r.passed && r.score >= threshold; })
      .sort(function (a, b) { return b.score - a.score; });

    return { customer: customer, results: results };
  }

  return {
    cell: cell,
    normalizeRow: normalizeRow,
    parseDateValue: parseDateValue,
    formatDateKST: formatDateKST,
    pick: pick,
    hasCompanyName: hasCompanyName,
    sortByReceivedAtDesc: sortByReceivedAtDesc,
    preparePipelineRows: preparePipelineRows,
    displayExistingLoanFlag: displayExistingLoanFlag,
    extractCustomer: extractCustomer,
    extractPolicy: extractPolicy,
    recommend: recommend
  };
})();
