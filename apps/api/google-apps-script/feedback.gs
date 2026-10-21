/**
 * dvote customer feedback → Google Sheet.
 *
 * The dvote API (POST /api/app/feedback) calls this web app; it appends one row per
 * feedback to the "Feedback" tab: Date (Cairo) | User ID | Category | Feedback.
 *
 * Setup (once):
 * 1. Open the Google Sheet → Extensions → Apps Script, replace the code with this file.
 * 2. Project Settings (gear) → Script properties → add FEEDBACK_SECRET = a long random
 *    string. Put the same value in apps/api/.env as FEEDBACK_SHEET_SECRET.
 * 3. Deploy → New deployment → type "Web app": Execute as "Me", Who has access "Anyone".
 *    Authorize, then copy the Web app URL (…/exec) into apps/api/.env as FEEDBACK_SHEET_URL.
 * After editing this code: Deploy → Manage deployments → edit → Version "New version",
 * so the same URL keeps working.
 */

const SHEET_NAME = 'Feedback';
const HEADERS = ['Date (Cairo)', 'User ID', 'Category', 'Feedback'];
/** Dates are written in Cairo time (summer time included), e.g. 2026-10-08 18:19:42. */
const TIME_ZONE = 'Africa/Cairo';
const DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const secret = PropertiesService.getScriptProperties().getProperty('FEEDBACK_SECRET');
    if (!secret || data.secret !== secret) return reply({ ok: false, error: 'unauthorized' });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000); // two feedbacks at once must not overwrite each other's row
    try {
      sheet().appendRow([
        Utilities.formatDate(new Date(data.createdAt), TIME_ZONE, DATE_FORMAT),
        asText(data.userId),
        asText(data.category),
        asText(data.message),
      ]);
    } finally {
      lock.releaseLock();
    }
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

/** The "Feedback" tab, created with a header row the first time; the header is kept current. */
function sheet() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let tab = book.getSheetByName(SHEET_NAME);
  if (!tab) {
    tab = book.insertSheet(SHEET_NAME);
    tab.appendRow(HEADERS);
    tab.setFrozenRows(1);
  } else if (tab.getRange(1, 1).getValue() !== HEADERS[0]) {
    tab.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]); // e.g. old "Date (UTC)"
  }
  return tab;
}

/**
 * Users type the feedback, so never let Sheets read it as a formula (text starting with
 * = + - or @ would run as one). The leading ' only shows in the edit bar.
 */
function asText(value) {
  const text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
