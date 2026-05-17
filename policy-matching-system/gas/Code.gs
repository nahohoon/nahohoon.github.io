/**
 * 정책자금 상담·매칭 — Google Apps Script
 * CONSULT_PIPELINE 헤더명과 pipelineData 키를 1:1로 일치시킵니다.
 */

var SHEET_PIPELINE = 'CONSULT_PIPELINE';
var SHEET_POLICIES = '정책자금매칭';
var SHEET_DIAGNOSIS = '정책자금_무료진단_DB';
var TZ = 'Asia/Seoul';

/** CONSULT_PIPELINE 1행 헤더 (시트와 동일) */
var CONSULT_PIPELINE_HEADERS = [
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
];

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  try {
    if (action === 'pipeline') {
      return jsonResponse_({ success: true, rows: getSheetRows_(SHEET_PIPELINE) });
    }
    if (action === 'policies') {
      return jsonResponse_({ success: true, rows: getSheetRows_(SHEET_POLICIES) });
    }
    if (action === 'getNotices' && typeof handleGetNotices_ === 'function') {
      return handleGetNotices_(e);
    }
    return jsonResponse_({ success: false, error: 'unknown action: ' + action });
  } catch (err) {
    return jsonResponse_({ success: false, error: String(err) });
  }
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ success: false, error: 'invalid json' });
  }

  try {
    var action = body.action || '';

    if (action === 'updateStatus') {
      return jsonResponse_(updateStatus_(body.receiptNo, body.status));
    }
    if (action === 'updateMemoAction') {
      return jsonResponse_(updateMemoAction_(body.receiptNo, body.nextAction, body.memo));
    }

    return jsonResponse_(saveDiagnosis_(body));
  } catch (err) {
    return jsonResponse_({ success: false, error: String(err) });
  }
}

/**
 * 무료상담 신청 저장
 * - DIAGNOSIS(정책자금_무료진단_DB): 기존대출금액·희망대출금액 원값 저장
 * - CONSULT_PIPELINE: 기존대출여부(있음/없음) + 금액 컬럼 분리 저장
 */
function saveDiagnosis_(payload) {
  var company = String(payload.companyName || '').trim();
  if (!company) {
    return { success: false, error: '업체명은 필수입니다.' };
  }

  var now = new Date();
  var receiptNo = generateReceiptNo_(SHEET_PIPELINE);
  var receivedAt = Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm:ss');

  var existingLoanAmount = String(payload.existingLoanAmount || '').trim();
  var desiredLoanAmount = String(payload.desiredLoanAmount || '').trim();
  var existingLoanFlag = toExistingLoanFlag_(existingLoanAmount);

  var commonFields = {
    '접수번호': receiptNo,
    '접수일': receivedAt,
    '상태': '신규',
    '업체명': company,
    '담당자': String(payload.contactName || '').trim(),
    '연락처': String(payload.phone || '').trim(),
    '이메일': String(payload.email || '').trim(),
    '지역': String(payload.region || '').trim(),
    '업종': String(payload.industry || '').trim(),
    '사업자유형': String(payload.bizType || '').trim(),
    '사업자형태': String(payload.businessForm || '').trim(),
    '연매출': String(payload.revenue || '').trim(),
    '종업원수': String(payload.employees || '').trim(),
    '자금유형': String(payload.fundType || '').trim(),
    '세금체납여부': String(payload.taxDelinq || '').trim(),
    '신용상태': String(payload.creditStatus || '').trim(),
    '기존대출금액': existingLoanAmount,
    '희망대출금액': desiredLoanAmount,
    '인증보유여부': String(payload.certifications || '').trim(),
    '기타인증': String(payload.otherCertification || '').trim(),
    '신용점수': String(payload.creditScore || '').trim(),
    '부채비율': String(payload.debtRatio || '').trim(),
    '업력': String(payload.businessYears || '').trim(),
    '정책자금신청경험': String(payload.policyFundExperience || '').trim(),
    '재무자료보유여부': String(payload.financialDocs || '').trim(),
    '현재애로사항': String(payload.concerns || '').trim(),
    '개인정보동의': String(payload.privacyAgree || '').trim()
  };

  var diagnosisData = {};
  Object.keys(commonFields).forEach(function (key) {
    diagnosisData[key] = commonFields[key];
  });

  var pipelineData = {};
  Object.keys(commonFields).forEach(function (key) {
    pipelineData[key] = commonFields[key];
  });
  pipelineData['기존대출여부'] = existingLoanFlag;
  pipelineData['예상가능성'] = '';
  pipelineData['추천사업'] = '';
  pipelineData['다음액션'] = '';
  pipelineData['상담메모'] = '';

  appendByHeader_(SHEET_DIAGNOSIS, diagnosisData);
  ensurePipelineHeaders_(SHEET_PIPELINE);
  appendByHeader_(SHEET_PIPELINE, pipelineData);

  return {
    success: true,
    receiptNo: receiptNo,
    receivedAt: receivedAt
  };
}

/** 기존대출금액 > 0 이면 있음, 아니면 없음 */
function toExistingLoanFlag_(amountStr) {
  var n = parseFloat(String(amountStr || '').replace(/,/g, '').trim());
  if (isNaN(n) || n <= 0) {
    return '없음';
  }
  return '있음';
}

/** CONSULT_PIPELINE 1행에 누락 헤더(기존대출금액·희망대출금액 등) 추가 */
function ensurePipelineHeaders_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headers = headerRow.map(function (h) {
    return String(h).replace(/^\uFEFF/, '').trim();
  }).filter(Boolean);

  if (!headers.length) {
    sheet.getRange(1, 1, 1, CONSULT_PIPELINE_HEADERS.length).setValues([CONSULT_PIPELINE_HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }

  var changed = false;
  CONSULT_PIPELINE_HEADERS.forEach(function (name) {
    if (headers.indexOf(name) < 0) {
      headers.push(name);
      changed = true;
    }
  });

  if (changed) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

/** 헤더명 기준 행 추가 */
function appendByHeader_(sheetName, dataObj) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('시트를 찾을 수 없습니다: ' + sheetName);
  }

  if (sheetName === SHEET_PIPELINE) {
    ensurePipelineHeaders_(sheetName);
  }

  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headers = headerRow.map(function (h) {
    return String(h).replace(/^\uFEFF/, '').trim();
  });

  if (!headers[0] || headers.every(function (h) { return !h; })) {
    var defaultHeaders = sheetName === SHEET_PIPELINE
      ? CONSULT_PIPELINE_HEADERS
      : CONSULT_PIPELINE_HEADERS.filter(function (h) { return h !== '기존대출여부'; });
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    headers = defaultHeaders.slice();
  }

  var row = headers.map(function (header) {
    if (!header) return '';
    if (dataObj.hasOwnProperty(header)) {
      return dataObj[header];
    }
    return '';
  });

  sheet.appendRow(row);
}

function getSheetRows_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('시트를 찾을 수 없습니다: ' + sheetName);
  }

  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) {
    return [];
  }

  var headers = values[0].map(function (h) {
    return String(h).replace(/^\uFEFF/, '').trim();
  });

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.every(function (cell) {
      return cell === '' || cell === null || cell === undefined;
    })) {
      continue;
    }
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      obj[headers[c]] = row[c];
    }
    rows.push(obj);
  }
  return rows;
}

function generateReceiptNo_(sheetName) {
  var datePart = Utilities.formatDate(new Date(), TZ, 'yyyyMMdd');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var seq = sheet ? Math.max(0, sheet.getLastRow() - 1) + 1 : 1;
  return 'PD-' + datePart + '-' + String(seq).padStart(4, '0');
}

function updateStatus_(receiptNo, status) {
  if (!receiptNo || !status) {
    return { success: false, message: '접수번호와 상태가 필요합니다.' };
  }
  var updated = updateCellByReceipt_(SHEET_PIPELINE, receiptNo, '상태', status);
  return updated
    ? { success: true }
    : { success: false, message: '해당 접수번호를 찾을 수 없습니다.' };
}

function updateMemoAction_(receiptNo, nextAction, memo) {
  if (!receiptNo) {
    return { success: false, message: '접수번호가 필요합니다.' };
  }
  var ok1 = updateCellByReceipt_(SHEET_PIPELINE, receiptNo, '다음액션', nextAction || '');
  var ok2 = updateCellByReceipt_(SHEET_PIPELINE, receiptNo, '상담메모', memo || '');
  return ok1
    ? { success: true }
    : { success: false, message: '해당 접수번호를 찾을 수 없습니다.' };
}

function updateCellByReceipt_(sheetName, receiptNo, headerName, value) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return false;

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return false;

  var headers = data[0].map(function (h) {
    return String(h).replace(/^\uFEFF/, '').trim();
  });
  var receiptCol = headers.indexOf('접수번호');
  var targetCol = headers.indexOf(headerName);
  if (receiptCol < 0 || targetCol < 0) return false;

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][receiptCol]).trim() === String(receiptNo).trim()) {
      sheet.getRange(r + 1, targetCol + 1).setValue(value);
      return true;
    }
  }
  return false;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 시트 헤더 일괄 정렬 (수동 1회 실행) */
function setupConsultPipelineHeaders() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PIPELINE);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_PIPELINE);
  }
  ensurePipelineHeaders_(SHEET_PIPELINE);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#0F2448')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}
