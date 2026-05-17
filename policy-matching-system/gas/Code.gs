/**
 * Google Apps Script — 정책자금 매칭 API 확장 샘플
 * 기존 Web App 프로젝트(doPost / doGet)에 아래 핸들러를 병합하세요.
 *
 * 시트:
 * - 정책자금_무료진단_DB (기존 무료진단 접수)
 * - 정책자금매칭 (1행 헤더: 사업명, 주관기관, 지원대상, 지역, 업종,
 *   창업연수최소, 창업연수최대, 매출최소, 매출최대, 종업원최소, 종업원최대,
 *   자금목적, 지원내용, 신청기간, 신청링크, 필요서류, 비고)
 *   매출·매출최소/최대 단위: 만원
 */

var SHEET_DIAGNOSIS = '정책자금_무료진단_DB';
var SHEET_POLICIES = '정책자금매칭';

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  try {
    if (action === 'pipeline') {
      return jsonResponse({ success: true, rows: getSheetRows_(SHEET_DIAGNOSIS) });
    }
    if (action === 'policies') {
      return jsonResponse({ success: true, rows: getSheetRows_(SHEET_POLICIES) });
    }
    if (action === 'getNotices') {
      // 기존 공지 API가 있다면 유지
      return handleGetNotices_(e);
    }
    return jsonResponse({ success: false, error: 'unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) });
  }
}

function getSheetRows_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + sheetName);

  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  var headers = values[0].map(function (h) {
    return String(h).replace(/^\uFEFF/, '').trim();
  });

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.every(function (cell) { return cell === '' || cell === null; })) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      obj[headers[c]] = row[c];
    }
    rows.push(obj);
  }
  return rows;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// 기존 doPost, updateStatus, updateMemoAction, 진단 접수 로직은 그대로 유지하세요.
