/**
 * ==============================================================================
 * UNG DUNG QUAN LY CONG VIEC (TASK MANAGEMENT WEB APP)
 * Backend Google Apps Script & Google Sheets API
 * Spreadsheet ID: 13ggsO-iGlpspavwuBk8g6ZmAqcRsOmE8dZZZl8t_oLE
 * ==============================================================================
 */

const SPREADSHEET_ID = '13ggsO-iGlpspavwuBk8g6ZmAqcRsOmE8dZZZl8t_oLE';
const CACHE_KEY = 'TASK_MGMT_DATA_CACHE_V3';
const CACHE_TTL_SECONDS = 600;

function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest(e.parameter.action, e.parameter);
  }
  
  const template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('TTHT Tasks - Hệ Thống Quản Lý Công Việc & Hồ Sơ')
    .setFaviconUrl('https://ssl.gstatic.com/docs/doclist/images/infinite_drives_24dp.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const payload = postData.payload || {};
    
    let result = {};
    switch (action) {
      case 'saveTask':
        result = saveTask(payload);
        break;
      case 'deleteTask':
        result = deleteTask(payload.id);
        break;
      case 'updateTaskStatus':
        result = updateTaskStatus(payload.id, payload.status);
        break;
      case 'updateTaskInline':
        result = updateTaskInline(payload);
        break;
      case 'saveCvLuuY':
        result = saveCvLuuY(payload);
        break;
      case 'deleteCvLuuY':
        result = deleteCvLuuY(payload.id);
        break;
      case 'saveDocument':
        result = saveDocument(payload);
        break;
      case 'deleteDocument':
        result = deleteDocument(payload.id);
        break;
      case 'saveUser':
        result = saveUser(payload);
        break;
      case 'deleteUser':
        result = deleteUser(payload.id);
        break;
      case 'getInitialData':
        result = getInitialData(true);
        break;
      default:
        result = { success: false, message: 'Hành động không hợp lệ: ' + action };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleApiRequest(action, params) {
  let data = {};
  if (action === 'getInitialData') {
    data = getInitialData(false);
  } else if (action === 'autoCheckOverdue') {
    data = autoCheckOverdue();
  } else {
    data = { success: false, message: 'Action not supported via GET' };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID') {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Ensure all Sheets exist with updated headers including List view fields
 */
function setupSheetsAndSampleData() {
  const ss = getSpreadsheet();
  
  const expectedTaskHeaders = [
    'ID', 'Tiêu đề', 'Mô tả', 'Trạng thái', 'Mức độ ưu tiên',
    'Ngày bắt đầu', 'Ngày kết thúc', 'Tiến độ (%)', 'Người thực hiện',
    'Danh sách công việc con', 'Tệp đính kèm', 'Ngày làm xong', 'Kế hoạch', 'Thực hiện', 'Tỷ lệ', 'Ghi chú'
  ];

  // 1. Sheet congviec
  let cvSheet = ss.getSheetByName('congviec');
  if (!cvSheet) {
    cvSheet = ss.insertSheet('congviec');
  }
  
  if (cvSheet.getLastRow() === 0) {
    cvSheet.appendRow(expectedTaskHeaders);
    cvSheet.getRange(1, 1, 1, expectedTaskHeaders.length).setFontWeight('bold').setBackground('#141b2d').setFontColor('#ffffff');
    
    cvSheet.appendRow([
      'TASK-001',
      'Lắp điện 3 pha tủ đổi Pin',
      'Tổ Hạ tầng Hòa Bình_Trụ sở chính VNPT Hòa Bình_điện lực Điện lực Hòa Bình',
      'Quá hạn',
      'Trung bình',
      '2026-07-20',
      '2026-07-24',
      0,
      'Đỗ Chu Đẳng',
      JSON.stringify([]),
      '',
      '',
      1,
      0,
      '0%',
      'Nhập ghi chú...'
    ]);
  } else {
    // Auto update row 1 headers if sheet already exists but missing new columns
    const currentLastCol = Math.max(cvSheet.getLastColumn(), expectedTaskHeaders.length);
    const currentHeaders = cvSheet.getRange(1, 1, 1, currentLastCol).getValues()[0];
    let needUpdate = false;
    for (let h = 0; h < expectedTaskHeaders.length; h++) {
      if (String(currentHeaders[h] || '').trim() !== expectedTaskHeaders[h]) {
        needUpdate = true;
        break;
      }
    }
    if (needUpdate) {
      cvSheet.getRange(1, 1, 1, expectedTaskHeaders.length).setValues([expectedTaskHeaders])
        .setFontWeight('bold').setBackground('#141b2d').setFontColor('#ffffff');
    }
  }

  // 2. Sheet Users
  let usersSheet = ss.getSheetByName('Users');
  if (!usersSheet) {
    usersSheet = ss.insertSheet('Users');
  }
  if (usersSheet.getLastRow() === 0) {
    usersSheet.appendRow(['ID', 'Tên', 'Tổ']);
    usersSheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#141b2d').setFontColor('#ffffff');
    usersSheet.appendRow(['USR-01', 'Đỗ Chu Đẳng', 'Tổ Hạ tầng Hòa Bình']);
    usersSheet.appendRow(['USR-02', 'Vũ Mạnh Khương', 'Tổ Hạ tầng Lương Sơn']);
    usersSheet.appendRow(['USR-03', 'Ngô Tiến Mạnh', 'Tổ Hạ tầng Phúc Yên']);
  }

  // 3. Sheet cvluuy
  let cvLuuYSheet = ss.getSheetByName('cvluuy');
  if (!cvLuuYSheet) {
    cvLuuYSheet = ss.insertSheet('cvluuy');
  }
  if (cvLuuYSheet.getLastRow() === 0) {
    cvLuuYSheet.appendRow([
      'ID', 'Công việc', 'Mô tả', 'Tổ', 'Ngày bắt đầu', 'Ngày kết thúc', 'Ngày làm xong', 'Trạng thái', 'Ghi chú'
    ]);
    cvLuuYSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#141b2d').setFontColor('#ffffff');
  }

  // 4. Sheet Documents
  let docsSheet = ss.getSheetByName('Documents');
  if (!docsSheet) {
    docsSheet = ss.insertSheet('Documents');
  }
  if (docsSheet.getLastRow() === 0) {
    docsSheet.appendRow([
      'ID', 'Số hồ sơ', 'Tên hồ sơ', 'Danh mục', 'Phòng ban', 'Ngày ban hành',
      'Ngày kết thúc', 'Dự án', 'Nhà cung cấp', 'Tình trạng', 'Giá trị HĐ',
      'Giá trị thực hiện', 'Chênh lệch', 'File Name', 'File URL', 'Mô tả', 'Ngày tạo'
    ]);
    docsSheet.getRange(1, 1, 1, 17).setFontWeight('bold').setBackground('#141b2d').setFontColor('#ffffff');
  }
}

function readSheetData(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return [];
  
  const range = sheet.getRange(1, 1, lastRow, lastCol);
  const values = range.getValues();
  const headers = values[0];
  
  const data = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.join('').trim() === '') continue;
    
    const item = { _rowIndex: i + 1 };
    for (let j = 0; j < headers.length; j++) {
      let val = row[j];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      item[headers[j]] = val;
    }
    data.push(item);
  }
  return data;
}

function autoCheckOverdue() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('congviec');
  if (!sheet || sheet.getLastRow() <= 1) return { updatedCount: 0 };
  
  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let updatedCount = 0;
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const status = row[3];
    const endDateRaw = row[6];
    
    if (endDateRaw && status !== 'Hoàn thành' && status !== 'Đã hủy' && status !== 'Quá hạn') {
      let endDate = null;
      if (endDateRaw instanceof Date) endDate = endDateRaw;
      else if (typeof endDateRaw === 'string' && endDateRaw.trim() !== '') endDate = new Date(endDateRaw);
      
      if (endDate && !isNaN(endDate.getTime())) {
        endDate.setHours(23, 59, 59, 999);
        if (endDate < today) {
          sheet.getRange(i + 2, 4).setValue('Quá hạn');
          updatedCount++;
        }
      }
    }
  }
  
  if (updatedCount > 0) clearCache();
  return { success: true, updatedCount: updatedCount };
}

function getInitialData(forceRefresh) {
  setupSheetsAndSampleData();
  autoCheckOverdue();
  
  const cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
  }
  
  const result = {
    success: true,
    tasks: readSheetData('congviec'),
    users: readSheetData('Users'),
    cvluuy: readSheetData('cvluuy'),
    documents: readSheetData('Documents'),
    timestamp: new Date().getTime()
  };
  
  try { cache.put(CACHE_KEY, JSON.stringify(result), CACHE_TTL_SECONDS); } catch (e) {}
  return result;
}

function clearCache() {
  try { CacheService.getScriptCache().remove(CACHE_KEY); } catch (e) {}
}

function saveTask(taskData) {
  setupSheetsAndSampleData();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('congviec');
  
  const subtasksJson = typeof taskData.subtasks === 'string' 
    ? taskData.subtasks 
    : JSON.stringify(taskData.subtasks || []);
    
  let isNew = false;
  if (!taskData.id && !taskData.ID) {
    isNew = true;
    taskData.id = 'TASK-' + Math.floor(1000 + Math.random() * 9000);
  }
  const idToUse = taskData.ID || taskData.id;

  const keHoach = taskData['Kế hoạch'] !== undefined ? Number(taskData['Kế hoạch']) : 1;
  const thucHien = taskData['Thực hiện'] !== undefined ? Number(taskData['Thực hiện']) : 0;
  const tyLe = keHoach > 0 ? Math.round((thucHien / keHoach) * 100) + '%' : '0%';

  const rowValues = [
    idToUse,
    taskData['Tiêu đề'] || taskData.title || '',
    taskData['Mô tả'] || taskData.description || '',
    taskData['Trạng thái'] || taskData.status || 'Đang thực hiện',
    taskData['Mức độ ưu tiên'] || taskData.priority || 'Trung bình',
    taskData['Ngày bắt đầu'] || taskData.startDate || '',
    taskData['Ngày kết thúc'] || taskData.endDate || '',
    Number(taskData['Tiến độ (%)'] || taskData.progress || 0),
    taskData['Người thực hiện'] || taskData.assignee || '',
    subtasksJson,
    taskData['Tệp đính kèm'] || taskData.attachment || '',
    taskData['Ngày làm xong'] || '',
    keHoach,
    thucHien,
    tyLe,
    taskData['Ghi chú'] || ''
  ];
  
  if (isNew) {
    sheet.appendRow(rowValues);
  } else {
    const lastRow = sheet.getLastRow();
    const ids = sheet.getRange(1, 1, lastRow, 1).getValues();
    let rowIndex = -1;
    for (let i = 1; i < ids.length; i++) {
      if (String(ids[i][0]) === String(idToUse)) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
  }
  
  clearCache();
  return { success: true, task: taskData, message: 'Đã lưu công việc thành công!' };
}

function updateTaskInline(payload) {
  setupSheetsAndSampleData();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('congviec');
  if (!sheet) return { success: false };

  const lastRow = sheet.getLastRow();
  const ids = sheet.getRange(1, 1, lastRow, 1).getValues();
  let rowIndex = -1;
  for (let i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === String(payload.id)) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex > 0) {
    if (payload.ngayLamXong !== undefined) sheet.getRange(rowIndex, 12).setValue(payload.ngayLamXong);
    if (payload.thucHien !== undefined) {
      const th = Number(payload.thucHien);
      sheet.getRange(rowIndex, 14).setValue(th);
      const keHoachVal = Number(sheet.getRange(rowIndex, 13).getValue()) || 1;
      const pct = (keHoachVal > 0 ? Math.round((th / keHoachVal) * 100) : 0) + '%';
      sheet.getRange(rowIndex, 15).setValue(pct);
    }
    if (payload.ghiChu !== undefined) sheet.getRange(rowIndex, 16).setValue(payload.ghiChu);
    clearCache();
    return { success: true };
  }
  return { success: false, message: 'ID không tồn tại' };
}

function deleteTask(taskId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('congviec');
  if (!sheet) return { success: false };
  
  const lastRow = sheet.getLastRow();
  const ids = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (let i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === String(taskId)) {
      sheet.deleteRow(i + 1);
      clearCache();
      return { success: true, message: 'Đã xóa công việc!' };
    }
  }
  return { success: false };
}

function updateTaskStatus(taskId, newStatus) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('congviec');
  if (!sheet) return { success: false };
  
  const lastRow = sheet.getLastRow();
  const ids = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (let i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === String(taskId)) {
      sheet.getRange(i + 1, 4).setValue(newStatus);
      if (newStatus === 'Hoàn thành') {
        sheet.getRange(i + 1, 8).setValue(100);
      }
      clearCache();
      return { success: true, taskId: taskId, newStatus: newStatus };
    }
  }
  return { success: false };
}

function saveCvLuuY(data) {
  setupSheetsAndSampleData();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('cvluuy');
  
  let isNew = false;
  if (!data.id) {
    isNew = true;
    data.id = 'LY-' + Math.floor(1000 + Math.random() * 9000);
  }
  
  const rowValues = [
    data.id,
    data['Công việc'] || data.task || '',
    data['Mô tả'] || data.description || '',
    data['Tổ'] || data.group || '',
    data['Ngày bắt đầu'] || data.startDate || '',
    data['Ngày kết thúc'] || data.endDate || '',
    data['Ngày làm xong'] || data.completedDate || '',
    data['Trạng thái'] || data.status || 'Cần lưu ý',
    data['Ghi chú'] || data.note || ''
  ];
  
  if (isNew) {
    sheet.appendRow(rowValues);
  } else {
    const lastRow = sheet.getLastRow();
    const ids = sheet.getRange(1, 1, lastRow, 1).getValues();
    let rowIndex = -1;
    for (let i = 1; i < ids.length; i++) {
      if (String(ids[i][0]) === String(data.id)) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
  }
  
  clearCache();
  return { success: true, message: 'Đã lưu mục công việc lưu ý thành công!' };
}

function deleteCvLuuY(id) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('cvluuy');
  if (!sheet) return { success: false };
  
  const lastRow = sheet.getLastRow();
  const ids = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (let i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      clearCache();
      return { success: true };
    }
  }
  return { success: false };
}

function saveDocument(doc) {
  setupSheetsAndSampleData();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Documents');
  
  let isNew = false;
  if (!doc.id) {
    isNew = true;
    doc.id = 'DOC-' + Math.floor(1000 + Math.random() * 9000);
  }
  
  const formatDate = (d) => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const nowStr = formatDate(new Date());
  
  const valHD = Number(doc['Giá trị HĐ'] || doc.contractVal || 0);
  const valTH = Number(doc['Giá trị thực hiện'] || doc.actualVal || 0);
  const diffVal = valHD - valTH;
  
  const rowValues = [
    doc.id,
    doc['Số hồ sơ'] || doc.code || '',
    doc['Tên hồ sơ'] || doc.title || '',
    doc['Danh mục'] || doc.category || '',
    doc['Phòng ban'] || doc.department || '',
    doc['Ngày ban hành'] || doc.issueDate || '',
    doc['Ngày kết thúc'] || doc.endDate || '',
    doc['Dự án'] || doc.project || '',
    doc['Nhà cung cấp'] || doc.vendor || '',
    doc['Tình trạng'] || doc.status || 'Đang hiệu lực',
    valHD,
    valTH,
    diffVal,
    doc['File Name'] || doc.fileName || '',
    doc['File URL'] || doc.fileUrl || '',
    doc['Mô tả'] || doc.description || '',
    doc['Ngày tạo'] || doc.createdDate || nowStr
  ];
  
  if (isNew) {
    sheet.appendRow(rowValues);
  } else {
    const lastRow = sheet.getLastRow();
    const ids = sheet.getRange(1, 1, lastRow, 1).getValues();
    let rowIndex = -1;
    for (let i = 1; i < ids.length; i++) {
      if (String(ids[i][0]) === String(doc.id)) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
  }
  
  clearCache();
  return { success: true, message: 'Đã lưu hồ sơ thành công!' };
}

function deleteDocument(docId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Documents');
  if (!sheet) return { success: false };
  
  const lastRow = sheet.getLastRow();
  const ids = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (let i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === String(docId)) {
      sheet.deleteRow(i + 1);
      clearCache();
      return { success: true };
    }
  }
  return { success: false };
}

function saveUser(usr) {
  setupSheetsAndSampleData();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  
  let isNew = false;
  if (!usr.id) {
    isNew = true;
    usr.id = 'USR-' + Math.floor(10 + Math.random() * 90);
  }
  
  const rowValues = [usr.id, usr['Tên'] || usr.name || '', usr['Tổ'] || usr.group || ''];
  if (isNew) {
    sheet.appendRow(rowValues);
  } else {
    const lastRow = sheet.getLastRow();
    const ids = sheet.getRange(1, 1, lastRow, 1).getValues();
    let rowIndex = -1;
    for (let i = 1; i < ids.length; i++) {
      if (String(ids[i][0]) === String(usr.id)) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
  }
  
  clearCache();
  return { success: true };
}

function deleteUser(usrId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return { success: false };
  
  const lastRow = sheet.getLastRow();
  const ids = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (let i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === String(usrId)) {
      sheet.deleteRow(i + 1);
      clearCache();
      return { success: true };
    }
  }
  return { success: false };
}
