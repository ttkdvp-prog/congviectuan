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
  TOVIEN: 'tovien',
  TOTRUONGGIAOVIEC: 'totruonggiaoviec'
};

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : null;
  if (action === 'getInitialData') {
    return createJsonResponse(getInitialData(true));
  }
  if (action === 'getToTruongSheetData') {
    return createJsonResponse(getToTruongSheetData());
  }
  if (action === 'getTeamMembers') {
    const groupName = e.parameter.group || '';
    return createJsonResponse(getTeamMembers(groupName));
  }
  if (action === 'refreshTovien') {
    return createJsonResponse({ success: true, tovien: getSheetDataAsObjects(SHEETS.TOVIEN) });
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
    else if (action === 'getToTruongSheetData') result = getToTruongSheetData();
    else if (action === 'saveToTruongTask') result = saveToTruongTask(payload);
    else if (action === 'updateToTruongTaskInline') result = updateToTruongTaskInline(payload);

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
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
  
  let tasks = [], users = [], cvluuy = [], documents = [], tovien = [], totruonggiaoviec = [];
  
  try { 
    let taskSheet = getSheetFlexible(ss, SHEETS.TASKS);
    if (taskSheet) ensureTaskHeaders(taskSheet);
    tasks = getSheetDataAsObjects(SHEETS.TASKS); 
  } catch(e) { Logger.log('Error loading tasks: ' + e); }
  
  try {
    const userSheetVariants = ['Nguoidung', 'User', 'Users', 'Nguoi dung', 'Nhanvien', 'Nhân viên', 'Danhsachnhanvien'];
    for (const uName of userSheetVariants) {
      users = getSheetDataAsObjects(uName);
      if (users && users.length > 0) {
        Logger.log('Successfully loaded ' + users.length + ' users from sheet: ' + uName);
        break;
      }
    }
  } catch(e) { Logger.log('Error loading users: ' + e); }
  try { cvluuy = getSheetDataAsObjects(SHEETS.CVLUUY); } catch(e) { Logger.log('Error loading cvluuy: ' + e); }
  try { documents = getSheetDataAsObjects(SHEETS.DOCUMENTS); } catch(e) { Logger.log('Error loading documents: ' + e); }
  try { tovien = getSheetDataAsObjects(SHEETS.TOVIEN); } catch(e) { Logger.log('Error loading tovien: ' + e); }
  try { totruonggiaoviec = getSheetDataAsObjects(SHEETS.TOTRUONGGIAOVIEC); } catch(e) { Logger.log('Error loading totruonggiaoviec: ' + e); }

  Logger.log('Data loaded - tasks:' + tasks.length + ' users:' + users.length + ' tovien:' + tovien.length + ' totruonggiaoviec:' + totruonggiaoviec.length);
  if (totruonggiaoviec.length > 0) {
    Logger.log('totruonggiaoviec first record keys: ' + JSON.stringify(Object.keys(totruonggiaoviec[0])));
  }

  return {
    success: true,
    tasks: tasks,
    users: users,
    cvluuy: cvluuy,
    documents: documents,
    tovien: tovien,
    totruonggiaoviec: totruonggiaoviec
  };
}

// Standalone function to load ONLY totruonggiaoviec sheet data
// Can be called independently as a backup when getInitialData doesn't include it
function getToTruongSheetData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
    const allSheets = ss.getSheets();
    const allSheetNames = allSheets.map(s => s.getName());
    Logger.log('ALL SHEET NAMES: ' + JSON.stringify(allSheetNames));
    
    // Try multiple name variants
    const nameVariants = [
      'totruonggiaoviec',
      'totruonggiaoviẹc',
      'totruonggiaovịec', 
      'tổ trưởng giao việc',
      'Totruonggiaoviec',
      'TotruongGiaoviec'
    ];
    
    let foundSheet = null;
    
    // Try exact matches first
    for (const name of nameVariants) {
      foundSheet = ss.getSheetByName(name);
      if (foundSheet) {
        Logger.log('Found sheet by exact name: ' + name);
        break;
      }
    }
    
    // If not found, try fuzzy contains match on all sheets
    if (!foundSheet) {
      for (let i = 0; i < allSheets.length; i++) {
        const sName = allSheets[i].getName().toLowerCase();
        // Check if sheet name contains 'totruong' and 'giao' or 'viec'
        if (sName.includes('totruong') || (sName.includes('truong') && sName.includes('giao'))) {
          foundSheet = allSheets[i];
          Logger.log('Found sheet by fuzzy match: ' + allSheets[i].getName());
          break;
        }
      }
    }
    
    if (!foundSheet) {
      Logger.log('Sheet NOT FOUND! Available sheets: ' + JSON.stringify(allSheetNames));
      return { success: true, data: [], sheetNames: allSheetNames, error: 'Sheet not found. Available: ' + allSheetNames.join(', ') };
    }
    
    // Read data from found sheet
    const data = foundSheet.getDataRange().getValues();
    Logger.log('Sheet "' + foundSheet.getName() + '" has ' + data.length + ' rows');
    
    if (data.length < 2) {
      return { success: true, data: [], sheetName: foundSheet.getName(), rows: data.length };
    }
    
    const headers = data[0].map(h => String(h).trim());
    Logger.log('Headers: ' + JSON.stringify(headers));
    
    const result = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const isRowEmpty = row.every(cell => cell === "" || cell === null || cell === undefined);
      if (isRowEmpty) continue;
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
    
    Logger.log('getToTruongSheetData: loaded ' + result.length + ' records from "' + foundSheet.getName() + '"');
    if (result.length > 0) {
      Logger.log('First record keys: ' + JSON.stringify(Object.keys(result[0])));
      Logger.log('First record: ' + JSON.stringify(result[0]));
    }
    
    return { success: true, data: result, sheetName: foundSheet.getName() };
  } catch(e) {
    Logger.log('getToTruongSheetData error: ' + e);
    return { success: false, error: e.toString(), data: [] };
  }
}

// Real-time team members lookup - reads fresh data from tovien sheet
// Called when user opens modal and selects a group
function getTeamMembers(groupName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetFlexible(ss, SHEETS.TOVIEN);
    if (!sheet) return { success: true, members: [], leader: null };
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return { success: true, members: [], leader: null };
    
    const headers = data[0].map(h => String(h).trim());
    
    // Find column indices for group, employee name, employee code, leader name, leader code
    let colGroup = -1, colEmpName = -1, colEmpCode = -1, colLeaderName = -1, colLeaderCode = -1;
    headers.forEach((h, idx) => {
      const cl = String(h).toLowerCase().replace(/\s+/g, '');
      if (cl.includes('tổ') || cl.includes('to') || cl === 'tên tổ' || cl === 'tento') colGroup = idx;
      if (cl.includes('tênthànhviên') || cl.includes('tenthanhvien') || cl.includes('tên nhân viên') || cl.includes('tennhanvien') || cl === 'tên thành viên') colEmpName = idx;
      if (cl.includes('mãthànhviên') || cl.includes('mathanhvien') || cl.includes('mã nhân viên') || cl.includes('manhanvien') || cl === 'mã thành viên') colEmpCode = idx;
      if (cl.includes('tổtrưởng') || cl.includes('totruong') || cl.includes('tên tổ trưởng') || cl.includes('tentotruong')) colLeaderName = idx;
      if (cl.includes('mãtổtrưởng') || cl.includes('matotruong') || cl.includes('mã tổ trưởng')) colLeaderCode = idx;
    });
    
    // If column detection fails, try by index (typical: col0=group, col1=leaderName, col2=leaderCode, col3=empName, col4=empCode)
    if (colGroup === -1) colGroup = 0;
    if (colLeaderName === -1 && headers.length > 1) colLeaderName = 1;
    if (colLeaderCode === -1 && headers.length > 2) colLeaderCode = 2;
    if (colEmpName === -1 && headers.length > 3) colEmpName = 3;
    if (colEmpCode === -1 && headers.length > 4) colEmpCode = 4;
    
    const members = [];
    let leader = null;
    let currentGroup = '';
    const cleanGroupInput = String(groupName).toLowerCase().replace(/[^a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ0-9]/g, '');
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const grpVal = String(row[colGroup] || '').trim();
      if (grpVal) currentGroup = grpVal;
      
      const cleanGrp = String(currentGroup).toLowerCase().replace(/[^a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ0-9]/g, '');
      
      if (!groupName || cleanGrp.includes(cleanGroupInput) || cleanGroupInput.includes(cleanGrp)) {
        const empName = colEmpName >= 0 ? String(row[colEmpName] || '').trim() : '';
        const empCode = colEmpCode >= 0 ? String(row[colEmpCode] || '').trim() : '';
        const ldrName = colLeaderName >= 0 ? String(row[colLeaderName] || '').trim() : '';
        const ldrCode = colLeaderCode >= 0 ? String(row[colLeaderCode] || '').trim() : '';
        
        if (empName) {
          members.push({ name: empName, code: empCode, group: currentGroup });
        }
        
        if (ldrName && (!leader || leader.name !== ldrName)) {
          leader = { name: ldrName, code: ldrCode, group: currentGroup };
        }
      }
    }
    
    Logger.log('getTeamMembers(' + groupName + '): found ' + members.length + ' members, leader: ' + (leader ? leader.name : 'none'));
    return { success: true, members: members, leader: leader, group: groupName };
  } catch(e) {
    Logger.log('getTeamMembers error: ' + e);
    return { success: false, error: e.toString(), members: [], leader: null };
  }
}

function getSheetFlexible(ss, targetName) {
  if (!ss || !targetName) return null;
  let sheet = ss.getSheetByName(targetName);
  if (sheet) return sheet;

  const cleanTarget = String(targetName).toLowerCase().replace(/[^a-z0-9]/g, '');
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sName = sheets[i].getName();
    const cleanS = String(sName).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanS === cleanTarget || cleanS.includes(cleanTarget) || cleanTarget.includes(cleanS)) {
      return sheets[i];
    }
  }
  return null;
}

function getSheetDataAsObjects(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetFlexible(ss, sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const headers = data[0].map(h => String(h).trim());
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const isRowEmpty = row.every(cell => cell === "" || cell === null || cell === undefined);
    if (isRowEmpty) continue;
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

// Save/update task in the totruonggiaoviec sheet (separate from congviec)
function saveToTruongTask(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = getSheetFlexible(ss, SHEETS.TOTRUONGGIAOVIEC);
    if (!sheet) sheet = ss.insertSheet(SHEETS.TOTRUONGGIAOVIEC);
    
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
      if (!payload.id) payload.id = 'TT-' + Math.floor(1000 + Math.random() * 9000);
    }

    const rowValues = headers.map(h => {
      const cleanH = String(h).trim().toLowerCase();
      if (cleanH === 'id') return payload.id;
      if (cleanH === 'tiêu đề') return payload['Tiêu đề'] || '';
      if (cleanH === 'mô tả') return payload['Mô tả'] || '';
      if (cleanH === 'trạng thái') return payload['Trạng thái'] || 'Đang thực hiện';
      if (cleanH.includes('mã nv (a)')) return payload['Mã NV (A)'] || '';
      if (cleanH.includes('tên nv (a)')) return payload['Tên NV (A)'] || '';
      if (cleanH === 'tổ') return payload['Tổ'] || '';
      if (cleanH.includes('mã nv (r)')) return payload['Mã NV (R)'] || '';
      if (cleanH.includes('tên nv (r)')) return payload['Tên NV (R)'] || '';
      if (cleanH.includes('mã nv (c)')) return payload['Mã NV (C)'] || '';
      if (cleanH.includes('tên nv (c)')) return payload['Tên NV (C)'] || '';
      if (cleanH === 'ngày bắt đầu') return payload['Ngày bắt đầu'] || '';
      if (cleanH === 'ngày kết thúc' || cleanH === 'hạn hoàn thành') return payload['Ngày kết thúc'] || '';
      if (cleanH.includes('tiến độ')) return payload['Tiến độ (%)'] || 0;
      if (cleanH.includes('ngày làm xong')) return payload['Ngày làm xong'] || '';
      if (cleanH === 'kế hoạch') return payload['Kế hoạch'] !== undefined ? Number(payload['Kế hoạch']) : 1;
      if (cleanH === 'thực hiện') return payload['Thực hiện'] !== undefined ? Number(payload['Thực hiện']) : 0;
      if (cleanH === 'tỷ lệ') {
        const kh = payload['Kế hoạch'] !== undefined ? Number(payload['Kế hoạch']) : 1;
        const th = payload['Thực hiện'] !== undefined ? Number(payload['Thực hiện']) : 0;
        return kh > 0 ? Math.round((th / kh) * 100) + '%' : '0%';
      }
      if (cleanH === 'ghi chú') return payload['Ghi chú'] || '';
      if (cleanH.includes('đính kèm')) return payload['Tệp đính kèm'] || '';
      return payload[h] || '';
    });

    sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);
    SpreadsheetApp.flush();
    return { success: true, id: payload.id };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// Inline update for totruonggiaoviec sheet
function updateToTruongTaskInline(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetFlexible(ss, SHEETS.TOTRUONGGIAOVIEC);
    if (!sheet) return { success: false, message: 'Sheet totruonggiaoviec not found' };

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
    
    if (targetRow === -1) return { success: false, message: 'Task ID not found in totruonggiaoviec' };
    
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
