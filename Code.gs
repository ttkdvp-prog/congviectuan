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
  DOCUMENTS: 'hoso',
  TOVIEN: 'tovien'
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

function findHeaderIndex(headers, targetName) {
  const cleanTarget = String(targetName).toLowerCase().replace(/[^a-z0-9àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệđìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/g, '');
  for (let i = 0; i < headers.length; i++) {
    const cleanH = String(headers[i]).toLowerCase().replace(/[^a-z0-9àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệđìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/g, '');
    if (cleanH === cleanTarget) return i;
  }
  return -1;
}

function ensureTaskHeaders(sheet) {
  const data = sheet.getDataRange().getValues();
  const standardHeaders = [
    'ID', 'Mã nhân viên', 'Tiêu đề', 'Mô tả', 'Người chủ trì', 'Tổ chủ trì',
    'Người phối hợp', 'Trạng thái', 'Mức độ ưu tiên',
    'Ngày bắt đầu', 'Ngày kết thúc', 'Tiến độ (%)', 'Tệp đính kèm', 'Ngày làm xong',
    'Kế hoạch', 'Thực hiện', 'Tỷ lệ', 'Ghi chú', 'Danh sách công việc con'
  ];

  if (data.length === 0 || !data[0][0]) {
    sheet.getRange(1, 1, 1, standardHeaders.length).setValues([standardHeaders]);
  } else {
    const currentHeaders = data[0].map(h => String(h).trim());
    let updated = false;
    standardHeaders.forEach(req => {
      if (findHeaderIndex(currentHeaders, req) === -1) {
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
    const tovien = getSheetDataAsObjects(SHEETS.TOVIEN);

    return {
      success: true,
      tasks: tasks,
      users: users,
      cvluuy: cvluuy,
      documents: documents,
      tovien: tovien
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
    
    const isEdit = payload.id !== undefined && payload.id !== null && payload.id !== '';
    let targetRow = -1;
    if (isEdit) {
      const idIdx = findHeaderIndex(headers, 'ID');
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx]) === String(payload.id)) {
          targetRow = i + 1;
          break;
        }
      }
    }

    if (targetRow === -1) {
      targetRow = data.length + 1;
      payload.id = 'TSK-' + Math.floor(1000 + Math.random() * 9000);
    }

    const subtasksJson = payload.subtasks ? JSON.stringify(payload.subtasks) : '';
    const chuTri = payload['Người chủ trì'] || payload['Người thực hiện'] || payload['Người phụ trách'] || '';
    const toChuTri = payload['Tổ chủ trì'] || payload['Tổ'] || '';
    const phoiHop = payload['Người phối hợp'] || '';
    const toPhoiHop = payload['Tổ phối hợp'] || '';

    const keHoach = payload['Kế hoạch'] !== undefined ? Number(payload['Kế hoạch']) : 1;
    const thucHien = payload['Thực hiện'] !== undefined ? Number(payload['Thực hiện']) : 0;
    const tyLe = keHoach > 0 ? Math.round((thucHien / keHoach) * 100) + '%' : '0%';
    const doneDate = payload['Ngày làm xong'] || '';
    const endDate = payload['Ngày kết thúc'] || payload['Hạn hoàn thành'] || '';

    let status = payload['Trạng thái'] || 'Đang thực hiện';
    if (doneDate && endDate && doneDate > endDate) {
      status = 'Hoàn thành quá hạn';
    }

    const rowValues = headers.map(h => {
      const cleanH = String(h).trim().toLowerCase();
      if (cleanH === 'id') return payload.id;
      if (cleanH === 'tiêu đề') return payload['Tiêu đề'] || '';
      if (cleanH === 'mô tả') return payload['Mô tả'] || '';
      if (cleanH === 'trạng thái') return status;
      if (cleanH === 'mức độ ưu tiên') return payload['Mức độ ưu tiên'] || 'Trung bình';
      if (cleanH === 'ngày bắt đầu') return payload['Ngày bắt đầu'] || '';
      if (cleanH === 'ngày kết thúc' || cleanH === 'hạn hoàn thành') return payload['Ngày kết thúc'] || '';
      if (cleanH.includes('tiến độ')) return payload['Tiến độ (%)'] || 0;
      if (cleanH.includes('chủ trì') && cleanH.includes('tổ')) return toChuTri;
      if (cleanH.includes('phối hợp') && cleanH.includes('tổ')) return toPhoiHop;
      if (cleanH.includes('chủ trì') || cleanH.includes('phụ trách') || cleanH.includes('thực hiện')) return chuTri;
      if (cleanH.includes('phối hợp')) return phoiHop;
      if (cleanH === 'tổ') return toChuTri;
      if (cleanH.includes('việc con')) return subtasksJson;
      if (cleanH.includes('đính kèm')) return payload['Tệp đính kèm'] || '';
      if (cleanH.includes('ngày làm xong')) return doneDate;
      if (cleanH === 'kế hoạch') return keHoach;
      if (cleanH === 'thực hiện') return thucHien;
      if (cleanH === 'tỷ lệ') return tyLe;
      if (cleanH === 'ghi chú') return payload['Ghi chú'] || '';
      return payload[h] || '';
    });

    sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);
    SpreadsheetApp.flush();
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
    const idColIdx = findHeaderIndex(headers, 'ID');
    
    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idColIdx]) === String(payload.id)) {
        targetRow = i + 1;
        break;
      }
    }
    
    if (targetRow === -1) return { success: false, message: 'Task ID not found' };
    
    if (payload.ngayLamXong !== undefined) {
      let colIdx = findHeaderIndex(headers, 'Ngày làm xong');
      if (colIdx !== -1) sheet.getRange(targetRow, colIdx + 1).setValue(payload.ngayLamXong);
    }
    if (payload.thucHien !== undefined) {
      let colIdx = findHeaderIndex(headers, 'Thực hiện');
      if (colIdx !== -1) sheet.getRange(targetRow, colIdx + 1).setValue(payload.thucHien);
      
      let khCol = findHeaderIndex(headers, 'Kế hoạch');
      let tyLeCol = findHeaderIndex(headers, 'Tỷ lệ');
      if (khCol !== -1 && tyLeCol !== -1) {
        let kh = Number(sheet.getRange(targetRow, khCol + 1).getValue() || 1);
        let pct = kh > 0 ? Math.round((Number(payload.thucHien) / kh) * 100) : 0;
        sheet.getRange(targetRow, tyLeCol + 1).setValue(pct + '%');
      }
    }
    if (payload.progress !== undefined) {
      let colIdx = findHeaderIndex(headers, 'Tiến độ (%)');
      if (colIdx === -1) colIdx = findHeaderIndex(headers, 'Tiến độ');
      if (colIdx !== -1) sheet.getRange(targetRow, colIdx + 1).setValue(payload.progress);
    }
    if (payload.status !== undefined) {
      let colIdx = findHeaderIndex(headers, 'Trạng thái');
      if (colIdx !== -1) sheet.getRange(targetRow, colIdx + 1).setValue(payload.status);
    }
    if (payload.ghiChu !== undefined) {
      let colIdx = findHeaderIndex(headers, 'Ghi chú');
      if (colIdx !== -1) sheet.getRange(targetRow, colIdx + 1).setValue(payload.ghiChu);
    }
    
    SpreadsheetApp.flush();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function updateTaskStatus(payload) {
  return updateTaskInline({
    id: payload.id,
    status: payload.status,
    progress: payload.status === 'Hoàn thành' || payload.status === 'Hoàn thành quá hạn' ? 100 : undefined
  });
}

function deleteTask(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEETS.TASKS);
    if (!sheet) return { success: false, message: 'Sheet not found' };
    
    const data = sheet.getDataRange().getValues();
    const idColIdx = findHeaderIndex(data[0], 'ID');
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idColIdx]) === String(payload.id)) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
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
    SpreadsheetApp.flush();
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
    SpreadsheetApp.flush();
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
    SpreadsheetApp.flush();
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
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    return { success: false, message: 'ID not found' };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}
