/**
 * 정책자금 매칭 시스템 설정
 * Google Apps Script Web App URL (policy-diagnosis / policy-admin과 동일 프로젝트)
 */
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbzR3AtUMSmYhx4vEjnuB8-kM07ziaaDRstZRIhrGCvparuzAllKDGK16Vd8aJfYP0Ov/exec',

  SHEETS: {
    DIAGNOSIS: '정책자금_무료진단_DB',
    POLICIES: '정책자금매칭'
  },

  API: {
    PIPELINE: 'pipeline',
    POLICIES: 'policies'
  },

  MATCH: {
    MIN_SCORE: 60,
    /** 정책 시트 매출최소·매출최대 단위: 만원 (8억 = 80000) */
    REVENUE_UNIT: 'manwon'
  }
};
