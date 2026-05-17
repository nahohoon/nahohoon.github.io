/**
 * 정책자금 매칭 시스템 설정
 */
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbzR3AtUMSmYhx4vEjnuB8-kM07ziaaDRstZRIhrGCvparuzAllKDGK16Vd8aJfYP0Ov/exec',

  SHEETS: {
    PIPELINE: 'CONSULT_PIPELINE',
    POLICIES: '정책자금매칭'
  },

  API: {
    PIPELINE: 'pipeline',
    POLICIES: 'policies'
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
    '연매출',
    '종업원수',
    '자금유형',
    '세금체납여부',
    '신용상태',
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
