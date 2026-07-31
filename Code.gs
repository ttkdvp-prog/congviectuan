/**
 * ==============================================================================
 * TTHT Tasks - Google Apps Script Backend (Code.gs)
 * Database: Google Sheets (Spreadsheet ID: 13ggsO-iGlpspavwuBk8g6ZmAqcRsOmE8dZZZl8t_oLE)
 * ==============================================================================
 */

const SPREADSHEET_ID = '13ggsO-iGlpspavwuBk8g6ZmAqcRsOmE8dZZZl8t_oLE';

const SHEETS = {
  TASKS: 'congviec',
  USERS: 'Nguoidung',
  CVLUUY: 'cvluuy',
  DOCUMENTS: 'hoso'
};

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : null;
  if (action === 'getInitialData') {
    return createJsonResponse(getInitialData(true));
  }
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('TTHT Tasks - Quản Lý Công Việc & Hồ Sơ')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  try {
    let requestData = {};
    if (e && e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    }
    const action = requestData.action;
    const payload = requestData.payload;

    let result = { success: false, message: 'Invalid action' };
    if (action === 'getInitialData') result = getInitialData(true);
    else if (action === 'saveTask') result = saveTask(payload);
    else if (action === 'deleteTask') result = deleteTask(payload);
    else if (action === 'updateTaskStatus') result = updateTaskStatus(payload);
    else if (action === 'updateTaskInline') result = updateTaskInline(payload);
    else if (action === 'saveUser') result = saveUser(payload);
    else if (action === 'deleteUser') result = deleteUser(payload);
    else if (action === 'saveCvLuuY') result = saveCvLuuY(payload);
    else if (action === 'deleteCvLuuY') result = deleteCvLuuY(payload);
    else if (action === 'saveDocument') result = saveDocument(payload);
    else if (action === 'deleteDocument') result = deleteDocument(payload);

    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureTaskHeaders(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length === 0 || !data[0][0]) {
    const headers = [
      'ID', 'Tiêu đề', 'Mô tả', 'Trạng thái', 'Mức độ ưu tiên',
      'Ngày bắt đầu', 'Ngày kết thúc', 'Tiến độ (%)', 'Người thực hiện',
      'Danh sách công việc con', 'Tệp đính kèm', 'Ngày làm xong',
      'Kế hoạch', 'Thực hiện', 'Tỷ lệ', 'Ghi chú'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const currentHeaders = data[0].map(h => String(h).trim());
    const required = [
      'Ngày làm xong', 'Kế hoạch', 'Thực hiện', 'Tỷ lệ', 'Ghi chú'
    ];
    let updated = false;
    required.forEach(req => {
      if (currentHeaders.indexOf(req) === -1) {
        currentHeaders.push(req);
        updated = true;
      }
    });
    if (updated) {
      sheet.getRange(1, 1, 1, currentHeaders.length).setValues([currentHeaders]);
    }
  }
}

function getInitialData(forceRefresh) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
    
    let taskSheet = ss.getSheetByName(SHEETS.TASKS);
    if (taskSheet) ensureTaskHeaders(taskSheet);

    const tasks = getSheetDataAsObjects(SHEETS.TASKS);
    const users = getSheetDataAsObjects(SHEETS.USERS);
    const cvluuy = getSheetDataAsObjects(SHEETS.CVLUUY);
    const documents = getSheetDataAsObjects(SHEETS.DOCUMENTS);

    return {
      success: true,
      tasks: tasks,
      users: users,
      cvluuy: cvluuy,
      documents: documents
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function getSheetDataAsObjects(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const headers = data[0].map(h => String(h).trim());
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === "" || row[0] === null || row[0] === undefined) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      let val = row[idx];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
      }
      obj[h] = val;
    });
    result.push(obj);
  }
  return result;
}

function saveTask(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEETS.TASKS);
    if (!sheet) sheet = ss.insertSheet(SHEETS.TASKS);
    
    ensureTaskHeaders(sheet);

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    
    const idColIdx = headers.indexOf('ID');
    const isEdit = payload.id !== undefined && payload.id !== null && payload.id !== '';
    let targetRow = -1;

    if (isEdit) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idColIdx]) === String(payload.id)) {
          targetRow = i + 1;
          break;
        }
      }
    }

    if (targetRow === -1) {
      targetRow = data.length + 1;
      payload.id = 'TSK-' + Math.floor(1000 + Math.random() * 9000);
    }

    const subtasksJson = Array.isArray(payload.subtasks) ? JSON.stringify(payload.subtasks) : (payload['Danh sách công việc con'] || '[]');
    const keHoach = payload['Kế hoạch'] !== undefined ? Number(payload['Kế hoạch']) : 1;
    const thucHien = payload['Thực hiện'] !== undefined ? Number(payload['Thực hiện']) : 0;
    const tyLe = keHoach > 0 ? Math.round((thucHien / keHoach) * 100) + '%' : '0%';
    const assignee = payload['Người thực hiện'] || payload['Người phụ trách'] || '';

    const rowValues = headers.map(h => {
      if (h === 'ID') return payload.id;
      if (h === 'Tiêu đề') return payload['Tiêu đề'] || '';
      if (h === 'Mô tả') return payload['Mô tả'] || '';
      if (h === 'Trạng thái') return payload['Trạng thái'] || 'Đang thực hiện';
      if (h === 'Mức độ ưu tiên') return payload['Mức độ ưu tiên'] || 'Trung bình';
      if (h === 'Ngày bắt đầu') return payload['Ngày bắt đầu'] || '';
      if (h === 'Ngày kết thúc') return payload['Ngày kết thúc'] || '';
      if (h === 'Tiến độ (%)') return payload['Tiến độ (%)'] || 0;
      if (h === 'Người thực hiện' || h === 'Người phụ trách') return assignee;
      if (h === 'Danh sách công việc con') return subtasksJson;
      if (h === 'Tệp đính kèm') return payload['Tệp đính kèm'] || '';
      if (h === 'Ngày làm xong') return payload['Ngày làm xong'] || '';
      if (h === 'Kế hoạch') return keHoach;
      if (h === 'Thực hiện') return thucHien;
      if (h === 'Tỷ lệ') return tyLe;
      if (h === 'Ghi chú') return payload['Ghi chú'] || '';
      return payload[h] || '';
    });

    sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);
    return { success: true, id: payload.id };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function updateTaskInline(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEETS.TASKS);
    if (!sheet) return { success: false, message: 'Sheet congviec not found' };
    
    ensureTaskHeaders(sheet);

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idColIdx = headers.indexOf('ID');
    
    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idColIdx]) === String(payload.id)) {
        targetRow = i + 1;
        break;
      }
    }
    
    if (targetRow === -1) return { success: false, message: 'Task ID not found' };
    
    if (payload.ngayLamXong !== undefined) {
      let colIdx = headers.indexOf('Ngày làm xong');
      if (colIdx !== -1) sheet.getRange(targetRow, colIdx + 1).setValue(payload.ngayLamXong);
    }
    if (payload.thucHien !== undefined) {
      let colIdx = headers.indexOf('Thực hiện');
      if (colIdx !== -1) sheet.getRange(targetRow, colIdx + 1).setValue(payload.thucHien);
      
      let khCol = headers.indexOf('Kế hoạch');
      let tyLeCol = headers.indexOf('Tỷ lệ');
      if (khCol !== -1 && tyLeCol !== -1) {
        let kh = Number(sheet.getRange(targetRow, khCol + 1).getValue() || 1);
        let pct = kh > 0 ? Math.round((Number(payload.thucHien) / kh) * 100) : 0;
        sheet.getRange(targetRow, tyLeCol + 1).setValue(pct + '%');
      }
    }
    if (payload.progress !== undefined) {
      let colIdx = headers.indexOf('Tiến độ (%)');
      if (colIdx !== -1) sheet.getRange(targetRow, colIdx + 1).setValue(payload.progress);
    }
    if (payload.status !== undefined) {
      let colIdx = headers.indexOf('Trạng thái');
      if (colIdx !== -1) sheet.getRange(targetRow, colIdx + 1).setValue(payload.status);
    }
    if (payload.ghiChu !== undefined) {
      let colIdx = headers.indexOf('Ghi chú');
      if (colIdx !== -1) sheet.getRange(targetRow, colIdx + 1).setValue(payload.ghiChu);
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function updateTaskStatus(payload) {
  return updateTaskInline({
    id: payload.id,
    status: payload.status,
    progress: payload.status === 'Hoàn thành' ? 100 : undefined
  });
}

function deleteTask(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEETS.TASKS);
    if (!sheet) return { success: false, message: 'Sheet not found' };
    
    const data = sheet.getDataRange().getValues();
    const idColIdx = data[0].indexOf('ID');
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idColIdx]) === String(payload.id)) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, message: 'ID not found' };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function saveUser(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEETS.USERS);
    if (!sheet) sheet = ss.insertSheet(SHEETS.USERS);

    const data = sheet.getDataRange().getValues();
    let headers = ['ID', 'Tên', 'Tổ'];
    if (data.length > 0 && data[0][0]) headers = data[0].map(h => String(h).trim());
    else sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    const isEdit = payload.id !== undefined && payload.id !== null && payload.id !== '';
    let targetRow = -1;
    if (isEdit) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(payload.id)) {
          targetRow = i + 1;
          break;
        }
      }
    }
    if (targetRow === -1) {
      targetRow = data.length + 1;
      payload.id = 'USR-' + Math.floor(100 + Math.random() * 900);
    }

    const rowValues = [payload.id, payload['Tên'] || '', payload['Tổ'] || ''];
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
    return { success: true, id: payload.id };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function deleteUser(payload) {
  return deleteRowById(SHEETS.USERS, payload.id);
}

function saveCvLuuY(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEETS.CVLUUY);
    if (!sheet) sheet = ss.insertSheet(SHEETS.CVLUUY);

    const data = sheet.getDataRange().getValues();
    let headers = ['ID', 'Công việc', 'Mô tả', 'Tổ', 'Trạng thái', 'Ngày bắt đầu', 'Ngày kết thúc', 'Ngày làm xong', 'Ghi chú'];
    if (data.length > 0 && data[0][0]) headers = data[0].map(h => String(h).trim());
    else sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    const isEdit = payload.id !== undefined && payload.id !== null && payload.id !== '';
    let targetRow = -1;
    if (isEdit) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(payload.id)) {
          targetRow = i + 1;
          break;
        }
      }
    }
    if (targetRow === -1) {
      targetRow = data.length + 1;
      payload.id = 'LY-' + Math.floor(1000 + Math.random() * 9000);
    }

    const rowValues = headers.map(h => {
      if (h === 'ID') return payload.id;
      return payload[h] || '';
    });

    sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);
    return { success: true, id: payload.id };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function deleteCvLuuY(payload) {
  return deleteRowById(SHEETS.CVLUUY, payload.id);
}

function saveDocument(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEETS.DOCUMENTS);
    if (!sheet) sheet = ss.insertSheet(SHEETS.DOCUMENTS);

    const data = sheet.getDataRange().getValues();
    let headers = ['ID', 'Số hồ sơ', 'Tên hồ sơ', 'Danh mục', 'Phòng ban', 'Nhà cung cấp', 'Tình trạng', 'Giá trị HĐ', 'Giá trị thực hiện', 'File URL'];
    if (data.length > 0 && data[0][0]) headers = data[0].map(h => String(h).trim());
    else sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    const isEdit = payload.id !== undefined && payload.id !== null && payload.id !== '';
    let targetRow = -1;
    if (isEdit) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(payload.id)) {
          targetRow = i + 1;
          break;
        }
      }
    }
    if (targetRow === -1) {
      targetRow = data.length + 1;
      payload.id = 'DOC-' + Math.floor(1000 + Math.random() * 9000);
    }

    const rowValues = headers.map(h => {
      if (h === 'ID') return payload.id;
      return payload[h] || '';
    });

    sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);
    return { success: true, id: payload.id };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function deleteDocument(payload) {
  return deleteRowById(SHEETS.DOCUMENTS, payload.id);
}

function deleteRowById(sheetName, id) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, message: 'Sheet not found' };

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, message: 'ID not found' };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}
