/**
 * 정책자금 매칭 시스템 설정
 */
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbzR3AtUMSmYhx4vEjnuB8-kM07ziaaDRstZRIhrGCvparuzAllKDGK16Vd8aJfYP0Ov/exec',

  SHEETS: {
    PIPELINE: 'CONSULT_PIPELINE',
    DIAGNOSIS: '정책자금_무료진단_DB',
    POLICIES: '정책자금매칭'
  },

  API: {
    PIPELINE: 'pipeline',
    POLICIES: 'policies'
  },

  ADMIN: {
    SESSION_KEY: 'nahohoon_policy_admin_token',
    TOKEN_PARAM: 'adminToken',
    PIN_LENGTH: 6,
    API: {
      VERIFY: 'verifyAdmin'
    }
  },

  MATCH: {
    MIN_SCORE: 60,
    REVENUE_UNIT: 'manwon'
  },

  /** CONSULT_PIPELINE 1행 헤더 (시트와 동일 순서·명칭) */
  CONSULT_PIPELINE_HEADERS: [
    '접수번호',
    '접수일',
    '상태',
    '업체명',
    '담당자',
    '연락처',
    '이메일',
    '지역',
    '업종',
    '사업자유형',
    '사업자형태',
    '연매출규모',
    '종업원수',
    '자금유형',
    '세금체납여부',
    '신용상태',
    '기존대출여부',
    '기존대출금액',
    '희망대출금액',
    '인증보유여부',
    '기타인증',
    '신용점수',
    '부채비율',
    '업력',
    '정책자금신청경험',
    '재무자료보유여부',
    '현재애로사항',
    '개인정보동의',
    '예상가능성',
    '추천사업',
    '다음액션',
    '상담메모'
  ]
};

/** 관리자 PIN 세션 (PIN 값은 Script Properties ADMIN_PIN에서만 관리) */
const AdminAuth = (function () {
  function sessionKey() {
    return CONFIG.ADMIN.SESSION_KEY;
  }

  function getToken() {
    try {
      return sessionStorage.getItem(sessionKey()) || '';
    } catch (e) {
      return '';
    }
  }

  function setToken(token) {
    sessionStorage.setItem(sessionKey(), String(token || '').trim());
  }

  function clearToken() {
    sessionStorage.removeItem(sessionKey());
  }

  function hasToken() {
    return !!getToken();
  }

  function buildGasUrl(action, extraParams) {
    var base = (CONFIG.GAS_URL || '').trim();
    if (!base) {
      throw new Error('CONFIG.GAS_URL이 설정되지 않았습니다.');
    }
    var url = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'action=' + encodeURIComponent(action);
    url += '&ts=' + Date.now();
    if (extraParams) {
      Object.keys(extraParams).forEach(function (key) {
        var val = extraParams[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(String(val).trim());
        }
      });
    }
    return url;
  }

  function validatePinFormat(pin) {
    return new RegExp('^\\d{' + CONFIG.ADMIN.PIN_LENGTH + '}$').test(String(pin || '').trim());
  }

  async function verifyPin(pin) {
    var trimmed = String(pin || '').trim();
    if (!validatePinFormat(trimmed)) {
      return { ok: false, error: 'PIN은 6자리 숫자로 입력해 주세요.' };
    }
    var extra = {};
    extra[CONFIG.ADMIN.TOKEN_PARAM] = trimmed;
    var res = await fetch(buildGasUrl(CONFIG.ADMIN.API.VERIFY, extra));
    var text = await res.text();
    var result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: '인증 응답을 해석할 수 없습니다.' };
    }
    if (result.success === true) {
      setToken(trimmed);
      return { ok: true };
    }
    return { ok: false, error: 'PIN이 올바르지 않습니다.' };
  }

  function appendTokenToBody(body) {
    var out = Object.assign({}, body || {});
    out[CONFIG.ADMIN.TOKEN_PARAM] = getToken();
    return out;
  }

  function authParams() {
    var params = {};
    params[CONFIG.ADMIN.TOKEN_PARAM] = getToken();
    return params;
  }

  return {
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    hasToken: hasToken,
    buildGasUrl: buildGasUrl,
    verifyPin: verifyPin,
    appendTokenToBody: appendTokenToBody,
    authParams: authParams,
    validatePinFormat: validatePinFormat
  };
})();
