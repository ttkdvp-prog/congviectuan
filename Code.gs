/**
 * ==============================================================================
 * UNG DUNG QUAN LY CONG VIEC (TASK MANAGEMENT WEB APP)
 * Backend Google Apps Script & Google Sheets API
 * Spreadsheet ID: 13ggsO-iGlpspavwuBk8g6ZmAqcRsOmE8dZZZl8t_oLE
 * ==============================================================================
 */

const SPREADSHEET_ID = '13ggsO-iGlpspavwuBk8g6ZmAqcRsOmE8dZZZl8t_oLE';
const CACHE_KEY = 'TASK_MGMT_DATA_CACHE_V1';
const CACHE_TTL_SECONDS = 600; // 10 minutes cache

/**
 * Web App Entry point: Serves HTML or handles JSON API GET requests
 */
function doGet(e) {
  // If JSON request parameter 'action' is present (e.g. from Vercel deployment)
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest(e.parameter.action, e.parameter);
  }
  
  // Default: Render HTML Page for Apps Script Web App
  const template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('Hệ Thống Quản Lý Công Việc & Hồ Sơ')
    .setFaviconUrl('https://ssl.gstatic.com/docs/doclist/images/infinite_drives_24dp.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Handles JSON API POST requests (for Vercel or external clients)
 */
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

/**
 * Handle API GET request dispatcher
 */
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

/**
 * Include HTML files (CSS, JS) inside Apps Script index.html template
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Get Spreadsheet instance safely
 */
function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID') {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Ensure all 4 Sheets exist with headers and seed data if empty
 */
function setupSheetsAndSampleData() {
  const ss = getSpreadsheet();
  
  // 1. Sheet congviec
  let cvSheet = ss.getSheetByName('congviec');
  if (!cvSheet) {
    cvSheet = ss.insertSheet('congviec');
  }
  if (cvSheet.getLastRow() === 0) {
    cvSheet.appendRow([
      'ID', 'Tiêu đề', 'Mô tả', 'Trạng thái', 'Mức độ ưu tiên',
      'Ngày bắt đầu', 'Ngày kết thúc', 'Tiến độ (%)', 'Người thực hiện', 'Danh sách công việc con', 'Tệp đính kèm'
    ]);
    // Format headers
    cvSheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#4568dc').setFontColor('#ffffff');
    
    // Sample Tasks Data
    const today = new Date();
    const formatDate = (d) => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const d1 = new Date(today.getTime() - 2 * 86400000);
    const d2 = new Date(today.getTime() + 5 * 86400000);
    const d3 = new Date(today.getTime() - 10 * 86400000);
    const d4 = new Date(today.getTime() - 1 * 86400000);
    
    cvSheet.appendRow([
      'TASK-001',
      'Nâng cấp hạ tầng Server Quản lý Hồ sơ',
      'Cấu hình bộ nhớ cache và tối ưu hóa truy vấn cơ sở dữ liệu cho ứng dụng.',
      'Đang thực hiện',
      'Cao',
      formatDate(d1),
      formatDate(d2),
      60,
      'Nguyễn Văn A',
      JSON.stringify([
        { id: 1, title: 'Kiểm tra cấu hình RAM/CPU', completed: true },
        { id: 2, title: 'Cài đặt Cache Redis', completed: true },
        { id: 3, title: 'Thử nghiệm tải ứng dụng', completed: false }
      ]),
      'https://drive.google.com'
    ]);
    
    cvSheet.appendRow([
      'TASK-002',
      'Xây dựng giao diện Dashboard Gantt Chart',
      'Thiết kế biểu đồ tiến độ công việc theo dòng thời gian tháng bằng Vanilla JS & CSS.',
      'Hoàn thành',
      'Trung bình',
      formatDate(d3),
      formatDate(d4),
      100,
      'Trần Thị B',
      JSON.stringify([
        { id: 1, title: 'Phác thảo Wireframe', completed: true },
        { id: 2, title: 'Viết mã HTML/CSS Responsive', completed: true }
      ]),
      ''
    ]);
    
    cvSheet.appendRow([
      'TASK-003',
      'Báo cáo kiểm toán chất lượng công trình Q3',
      'Thu thập chứng từ, đối soát hợp đồng và lập báo cáo chi tiết gửi Ban Giám Đốc.',
      'Quá hạn',
      'Cao',
      formatDate(d3),
      formatDate(d4),
      30,
      'Lê Văn C',
      JSON.stringify([
        { id: 1, title: 'Thu thập hóa đơn VAT', completed: true },
        { id: 2, title: 'Tổng hợp số liệu chi phí', completed: false }
      ]),
      ''
    ]);
    
    cvSheet.appendRow([
      'TASK-004',
      'Cập nhật tài liệu quy trình vận hành',
      'Soạn thảo văn bản hướng dẫn sử dụng phần mềm cho cán bộ nhân viên mới.',
      'Đang thực hiện',
      'Thấp',
      formatDate(today),
      formatDate(d2),
      0,
      'Phạm Thị D',
      JSON.stringify([]),
      ''
    ]);
  }

  // 2. Sheet Users
  let usersSheet = ss.getSheetByName('Users');
  if (!usersSheet) {
    usersSheet = ss.insertSheet('Users');
  }
  if (usersSheet.getLastRow() === 0) {
    usersSheet.appendRow(['ID', 'Tên', 'Tổ']);
    usersSheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#4568dc').setFontColor('#ffffff');
    usersSheet.appendRow(['USR-01', 'Nguyễn Văn A', 'Tổ Công Nghệ Thống Nhất']);
    usersSheet.appendRow(['USR-02', 'Trần Thị B', 'Tổ Phát Triển Phần Mềm']);
    usersSheet.appendRow(['USR-03', 'Lê Văn C', 'Tổ Kế Hoạch - Tài Chính']);
    usersSheet.appendRow(['USR-04', 'Phạm Thị D', 'Tổ Hành Chính Quản Trị']);
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
    cvLuuYSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#4568dc').setFontColor('#ffffff');
    
    const formatDate = (d) => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const today = new Date();
    cvLuuYSheet.appendRow([
      'LY-001',
      'Kiểm tra định kỳ sao lưu dữ liệu máy chủ',
      'Đảm bảo bản sao lưu hàng tuần được đồng bộ lên Cloud Storage.',
      'Tổ Công Nghệ Thống Nhất',
      formatDate(new Date(today.getTime() - 7 * 86400000)),
      formatDate(new Date(today.getTime() + 2 * 86400000)),
      '',
      'Cần lưu ý',
      'Ưu tiên thực hiện vào cuối tuần'
    ]);
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
    docsSheet.getRange(1, 1, 1, 17).setFontWeight('bold').setBackground('#4568dc').setFontColor('#ffffff');
    
    const formatDate = (d) => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const today = new Date();
    docsSheet.appendRow([
      'DOC-001',
      'HS-2026/01',
      'Hợp đồng mua sắm thiết bị công nghệ thông tin',
      'Hợp đồng kinh tế',
      'Phòng CNTT',
      formatDate(new Date(today.getTime() - 30 * 86400000)),
      formatDate(new Date(today.getTime() + 180 * 86400000)),
      'Chuyển đổi số VNPT 2026',
      'Công ty Cổ phần Công nghệ ABC',
      'Đang hiệu lực',
      500000000,
      350000000,
      150000000,
      'HopDong_ThietBi_2026.pdf',
      'https://drive.google.com',
      'Hợp đồng cung cấp 50 máy tính trạm và server lưu trữ.',
      formatDate(today)
    ]);
  }
}

/**
 * Read table sheet helper
 */
function readSheetData(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return []; // Only header or empty
  
  const range = sheet.getRange(1, 1, lastRow, lastCol);
  const values = range.getValues();
  const headers = values[0];
  
  const data = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    // Check if row is not completely empty
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

/**
 * Auto Check and Update Overdue Tasks
 */
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
      if (endDateRaw instanceof Date) {
        endDate = endDateRaw;
      } else if (typeof endDateRaw === 'string' && endDateRaw.trim() !== '') {
        endDate = new Date(endDateRaw);
      }
      
      if (endDate && !isNaN(endDate.getTime())) {
        endDate.setHours(23, 59, 59, 999);
        if (endDate < today) {
          sheet.getRange(i + 2, 4).setValue('Quá hạn');
          updatedCount++;
        }
      }
    }
  }
  
  if (updatedCount > 0) {
    clearCache();
  }
  return { success: true, updatedCount: updatedCount };
}

/**
 * Main Function: Get all initial data for application (with caching)
 */
function getInitialData(forceRefresh) {
  setupSheetsAndSampleData();
  autoCheckOverdue();
  
  const cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Fallback if cache parse fails
      }
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
  
  try {
    cache.put(CACHE_KEY, JSON.stringify(result), CACHE_TTL_SECONDS);
  } catch (e) {
    // Cache string size limit exceeded fallback
  }
  
  return result;
}

/**
 * Clear script cache
 */
function clearCache() {
  try {
    CacheService.getScriptCache().remove(CACHE_KEY);
  } catch (e) {}
}

/**
 * Save Task (Create or Update) in 'congviec' sheet
 */
function saveTask(taskData) {
  setupSheetsAndSampleData();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('congviec');
  
  const subtasksJson = typeof taskData.subtasks === 'string' 
    ? taskData.subtasks 
    : JSON.stringify(taskData.subtasks || []);
    
  let isNew = false;
  if (!taskData.id) {
    isNew = true;
    taskData.id = 'TASK-' + Math.floor(1000 + Math.random() * 9000);
  }
  
  const rowValues = [
    taskData.id,
    taskData['Tiêu đề'] || taskData.title || '',
    taskData['Mô tả'] || taskData.description || '',
    taskData['Trạng thái'] || taskData.status || 'Đang thực hiện',
    taskData['Mức độ ưu tiên'] || taskData.priority || 'Trung bình',
    taskData['Ngày bắt đầu'] || taskData.startDate || '',
    taskData['Ngày kết thúc'] || taskData.endDate || '',
    Number(taskData['Tiến độ (%)'] || taskData.progress || 0),
    taskData['Người thực hiện'] || taskData.assignee || '',
    subtasksJson,
    taskData['Tệp đính kèm'] || taskData.attachment || ''
  ];
  
  if (isNew) {
    sheet.appendRow(rowValues);
  } else {
    // Search existing row by ID
    const lastRow = sheet.getLastRow();
    const ids = sheet.getRange(1, 1, lastRow, 1).getValues();
    let rowIndex = -1;
    for (let i = 1; i < ids.length; i++) {
      if (String(ids[i][0]) === String(taskData.id)) {
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

/**
 * Delete Task from 'congviec'
 */
function deleteTask(taskId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('congviec');
  if (!sheet) return { success: false, message: 'Không tìm thấy sheet congviec' };
  
  const lastRow = sheet.getLastRow();
  const ids = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (let i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === String(taskId)) {
      sheet.deleteRow(i + 1);
      clearCache();
      return { success: true, message: 'Đã xóa công việc thành công!' };
    }
  }
  return { success: false, message: 'Không tìm thấy công việc với ID: ' + taskId };
}

/**
 * Update Task Status fast (Drag and drop)
 */
function updateTaskStatus(taskId, newStatus) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('congviec');
  if (!sheet) return { success: false, message: 'Sheet congviec không tồn tại' };
  
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
  return { success: false, message: 'Không tìm thấy công việc' };
}

/**
 * Save Item to 'cvluuy' sheet
 */
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

/**
 * Delete Item from 'cvluuy'
 */
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
      return { success: true, message: 'Đã xóa mục công việc lưu ý!' };
    }
  }
  return { success: false, message: 'Không tìm thấy ID' };
}

/**
 * Save Document to 'Documents' sheet
 */
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
  return { success: true, message: 'Đã lưu hồ sơ / tài liệu thành công!' };
}

/**
 * Delete Document from 'Documents'
 */
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
      return { success: true, message: 'Đã xóa tài liệu thành công!' };
    }
  }
  return { success: false, message: 'Không tìm thấy ID' };
}

/**
 * Save User to 'Users' sheet
 */
function saveUser(usr) {
  setupSheetsAndSampleData();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  
  let isNew = false;
  if (!usr.id) {
    isNew = true;
    usr.id = 'USR-' + Math.floor(10 + Math.random() * 90);
  }
  
  const rowValues = [
    usr.id,
    usr['Tên'] || usr.name || '',
    usr['Tổ'] || usr.group || ''
  ];
  
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
  return { success: true, message: 'Đã lưu thông tin người dùng!' };
}

/**
 * Delete User
 */
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
      return { success: true, message: 'Đã xóa người dùng!' };
    }
  }
  return { success: false, message: 'Không tìm thấy ID' };
}
