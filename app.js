/**
 * ==============================================================================
 * UNG DUNG QUAN LY CONG VIEC (TASK MANAGEMENT WEB APP)
 * Frontend Logic: Single Page Application Engine (Vanilla JS)
 * ==============================================================================
 */

// Application State
const appState = {
  tasks: [],
  users: [],
  cvluuy: [],
  documents: [],
  currentTab: 'congviec',
  currentView: 'kanban',
  filters: {
    search: '',
    priority: '',
    status: '',
    assignee: '',
    dateStart: '',
    dateEnd: ''
  },
  sortColumn: 'ID',
  sortAscending: false,
  apiUrl: localStorage.getItem('GAS_WEB_APP_URL') || '',
  isGAS: typeof google !== 'undefined' && google.script && google.script.run
};

// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Check if API URL stored
  const urlInput = document.getElementById('gas-api-url-input');
  if (urlInput && appState.apiUrl) {
    urlInput.value = appState.apiUrl;
  }
  
  appState.loadData();
  setupKanbanDragAndDrop();
});

/**
 * Universal Backend Call Wrapper (Supports GAS google.script.run & Vercel fetch)
 */
appState.loadData = function (forceRefresh = false) {
  showToast('Đang tải dữ liệu từ Google Sheets...', 'info');
  
  if (appState.isGAS) {
    google.script.run
      .withSuccessHandler(onDataLoaded)
      .withFailureHandler(onDataError)
      .getInitialData(forceRefresh);
  } else {
    // External Vercel API fetch call
    const fetchUrl = appState.apiUrl || window.location.href;
    fetch(fetchUrl + '?action=getInitialData&t=' + new Date().getTime())
      .then(res => res.json())
      .then(data => onDataLoaded(data))
      .catch(err => onDataError(err));
  }
};

function callBackend(action, payload, successCallback) {
  if (appState.isGAS) {
    google.script.run
      .withSuccessHandler(res => {
        if (successCallback) successCallback(res);
        appState.loadData(true);
      })
      .withFailureHandler(onDataError)[action](payload);
  } else {
    const fetchUrl = appState.apiUrl || window.location.href;
    fetch(fetchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: action, payload: payload })
    })
      .then(res => res.json())
      .then(res => {
        if (successCallback) successCallback(res);
        appState.loadData(true);
      })
      .catch(err => onDataError(err));
  }
}

function onDataLoaded(response) {
  if (response && response.success) {
    appState.tasks = response.tasks || [];
    appState.users = response.users || [];
    appState.cvluuy = response.cvluuy || [];
    appState.documents = response.documents || [];
    
    // Parse subtasks JSON if string
    appState.tasks.forEach(t => {
      if (typeof t['Danh sách công việc con'] === 'string' && t['Danh sách công việc con']) {
        try {
          t.subtasks = JSON.parse(t['Danh sách công việc con']);
        } catch (e) {
          t.subtasks = [];
        }
      } else {
        t.subtasks = t.subtasks || [];
      }
    });

    populateAssigneeSelects();
    renderAllViews();
    showToast('Đã đồng bộ dữ liệu mới nhất!', 'success');
  } else {
    showToast('Lỗi nạp dữ liệu: ' + (response.message || 'Unknown'), 'error');
  }
}

function onDataError(error) {
  console.error('API Error:', error);
  showToast('Không thể kết nối Backend. Vui lòng kiểm tra lại URL API Google Apps Script.', 'error');
}

/**
 * Populate User selects across filter & forms
 */
function populateAssigneeSelects() {
  const filterSelect = document.getElementById('filter-assignee');
  const taskSelect = document.getElementById('task-assignee-input');
  
  if (!filterSelect || !taskSelect) return;
  
  const currentFilterVal = filterSelect.value;
  const currentTaskVal = taskSelect.value;
  
  filterSelect.innerHTML = '<option value="">-- Tất cả người thực hiện --</option>';
  taskSelect.innerHTML = '<option value="">-- Chọn người thực hiện --</option>';
  
  appState.users.forEach(u => {
    const name = u['Tên'] || u.name;
    if (name) {
      filterSelect.innerHTML += `<option value="${name}">${name}</option>`;
      taskSelect.innerHTML += `<option value="${name}">${name}</option>`;
    }
  });
  
  filterSelect.value = currentFilterVal;
  taskSelect.value = currentTaskVal;
}

/**
 * Filter & Sort Logic
 */
function getFilteredTasks() {
  return appState.tasks.filter(t => {
    const f = appState.filters;
    const title = (t['Tiêu đề'] || '').toLowerCase();
    const desc = (t['Mô tả'] || '').toLowerCase();
    const search = f.search.toLowerCase();
    
    if (search && !title.includes(search) && !desc.includes(search)) return false;
    if (f.priority && t['Mức độ ưu tiên'] !== f.priority) return false;
    if (f.status && t['Trạng thái'] !== f.status) return false;
    if (f.assignee && t['Người thực hiện'] !== f.assignee) return false;
    
    if (f.dateStart && t['Ngày bắt đầu'] && t['Ngày bắt đầu'] < f.dateStart) return false;
    if (f.dateEnd && t['Ngày kết thúc'] && t['Ngày kết thúc'] > f.dateEnd) return false;
    
    return true;
  });
}

function handleFilterChange() {
  appState.filters.search = document.getElementById('search-input').value;
  appState.filters.assignee = document.getElementById('filter-assignee').value;
  appState.filters.priority = document.getElementById('filter-priority').value;
  appState.filters.status = document.getElementById('filter-status').value;
  appState.filters.dateStart = document.getElementById('filter-date-start').value;
  appState.filters.dateEnd = document.getElementById('filter-date-end').value;
  
  renderAllViews();
}

function resetFilters() {
  document.getElementById('search-input').value = '';
  document.getElementById('filter-assignee').value = '';
  document.getElementById('filter-priority').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-date-start').value = '';
  document.getElementById('filter-date-end').value = '';
  
  appState.filters = { search: '', priority: '', status: '', assignee: '', dateStart: '', dateEnd: '' };
  renderAllViews();
}

/**
 * Tab and View Switchers
 */
function switchMainTab(tabName) {
  appState.currentTab = tabName;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');
  const viewSwitcherGroup = document.getElementById('view-switcher-group');
  const filterBar = document.getElementById('filter-bar');
  
  if (tabName === 'congviec') {
    viewSwitcherGroup.style.display = 'flex';
    filterBar.style.display = 'flex';
    switchTaskView(appState.currentView);
  } else {
    viewSwitcherGroup.style.display = 'none';
    filterBar.style.display = 'none';
    document.getElementById('view-' + tabName.toLowerCase()).style.display = 'block';
  }
}

function switchTaskView(viewName) {
  appState.currentView = viewName;
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  
  document.getElementById('view-kanban').style.display = viewName === 'kanban' ? 'block' : 'none';
  document.getElementById('view-list').style.display = viewName === 'list' ? 'block' : 'none';
  document.getElementById('view-gantt').style.display = viewName === 'gantt' ? 'block' : 'none';
  
  renderAllViews();
}

/**
 * Render All Views Router
 */
function renderAllViews() {
  if (appState.currentTab === 'congviec') {
    if (appState.currentView === 'kanban') renderKanban();
    else if (appState.currentView === 'list') renderListTable();
    else if (appState.currentView === 'gantt') renderGanttChart();
  } else if (appState.currentTab === 'cvluuy') {
    renderCvLuuYTable();
  } else if (appState.currentTab === 'Documents') {
    renderDocumentsTable();
  } else if (appState.currentTab === 'Users') {
    renderUsersTable();
  }
}

/* ==============================================================================
   1. KANBAN BOARD RENDER & DRAG DROP
   ============================================================================== */
function renderKanban() {
  const filtered = getFilteredTasks();
  const cols = {
    'Đang thực hiện': document.getElementById('cards-doing'),
    'Hoàn thành': document.getElementById('cards-done'),
    'Quá hạn': document.getElementById('cards-overdue'),
    'Đã hủy': document.getElementById('cards-canceled')
  };
  
  const counts = { 'Đang thực hiện': 0, 'Hoàn thành': 0, 'Quá hạn': 0, 'Đã hủy': 0 };
  
  Object.values(cols).forEach(c => { if(c) c.innerHTML = ''; });
  
  filtered.forEach(t => {
    const status = t['Trạng thái'] || 'Đang thực hiện';
    if (cols[status]) {
      counts[status]++;
      cols[status].appendChild(createTaskCardElement(t));
    }
  });
  
  document.getElementById('count-doing').innerText = counts['Đang thực hiện'];
  document.getElementById('count-done').innerText = counts['Hoàn thành'];
  document.getElementById('count-overdue').innerText = counts['Quá hạn'];
  document.getElementById('count-canceled').innerText = counts['Đã hủy'];
}

function createTaskCardElement(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.draggable = true;
  card.dataset.id = task.ID || task.id;
  
  const priority = task['Mức độ ưu tiên'] || 'Trung bình';
  const badgeClass = priority === 'Cao' ? 'badge-high' : priority === 'Trung bình' ? 'badge-med' : 'badge-low';
  
  const assignee = task['Người thực hiện'] || 'Chưa gán';
  const avatarLetter = assignee.charAt(0).toUpperCase();
  const progress = Number(task['Tiến độ (%)'] || 0);
  
  const endDateStr = task['Ngày kết thúc'] || '';
  const isOverdue = task['Trạng thái'] === 'Quá hạn';

  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const subtasksText = subtasks.length > 0 ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px;"><i class="fa-solid fa-list-check"></i> ${completedSubtasks}/${subtasks.length} việc con</div>` : '';

  const attachmentBtn = task['Tệp đính kèm'] ? `<a href="${task['Tệp đính kèm']}" target="_blank" class="btn btn-secondary btn-sm" style="padding:2px 6px;" title="Mở tệp đính kèm" onclick="event.stopPropagation();"><i class="fa-solid fa-paperclip"></i></a>` : '';

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">${escapeHtml(task['Tiêu đề'] || '')}</div>
      <span class="badge ${badgeClass}">${priority}</span>
    </div>
    ${task['Mô tả'] ? `<div class="card-desc">${escapeHtml(task['Mô tả'])}</div>` : ''}
    ${subtasksText}
    <div class="progress-container">
      <div class="progress-info">
        <span>Tiến độ</span>
        <span>${progress}%</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${progress}%;"></div>
      </div>
    </div>
    <div class="card-footer">
      <div class="assignee-info">
        <div class="avatar">${avatarLetter}</div>
        <span>${escapeHtml(assignee)}</span>
      </div>
      <div class="due-date ${isOverdue ? 'is-overdue' : ''}">
        <i class="fa-regular fa-clock"></i> ${endDateStr || 'N/A'}
      </div>
      <div style="display:flex; gap:4px;">
        ${attachmentBtn}
        <button class="btn btn-secondary btn-sm" style="padding:2px 6px;" onclick="openTaskModal('${task.ID || task.id}'); event.stopPropagation();"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-danger btn-sm" style="padding:2px 6px;" onclick="confirmDeleteTask('${task.ID || task.id}'); event.stopPropagation();"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `;
  
  card.addEventListener('dragstart', (e) => {
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', task.ID || task.id);
  });
  
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });
  
  return card;
}

function setupKanbanDragAndDrop() {
  document.querySelectorAll('.kanban-cards').forEach(container => {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.classList.add('drag-over');
    });
    
    container.addEventListener('dragleave', () => {
      container.classList.remove('drag-over');
    });
    
    container.addEventListener('drop', (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const newStatus = container.dataset.status;
      
      if (taskId && newStatus) {
        // Optimistic UI update
        const task = appState.tasks.find(t => (t.ID || t.id) === taskId);
        if (task) {
          task['Trạng thái'] = newStatus;
          if (newStatus === 'Hoàn thành') task['Tiến độ (%)'] = 100;
          renderKanban();
          callBackend('updateTaskStatus', { id: taskId, status: newStatus });
          showToast(`Đã chuyển công việc sang "${newStatus}"`, 'success');
        }
      }
    });
  });
}

/* ==============================================================================
   2. LIST VIEW (TABLE RENDER)
   ============================================================================== */
function renderListTable() {
  const filtered = getFilteredTasks();
  const tbody = document.getElementById('task-table-body');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">Không tìm thấy công việc phù hợp</td></tr>`;
    return;
  }
  
  filtered.forEach(t => {
    const priority = t['Mức độ ưu tiên'] || 'Trung bình';
    const badgeClass = priority === 'Cao' ? 'badge-high' : priority === 'Trung bình' ? 'badge-med' : 'badge-low';
    const progress = Number(t['Tiến độ (%)'] || 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${t.ID || t.id}</strong></td>
      <td>
        <div style="font-weight:600;">${escapeHtml(t['Tiêu đề'] || '')}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(t['Mô tả'] || '').substring(0, 50)}</div>
      </td>
      <td><span class="badge ${badgeClass}">${priority}</span></td>
      <td><strong>${t['Trạng thái']}</strong></td>
      <td>${escapeHtml(t['Người thực hiện'] || 'Chưa gán')}</td>
      <td>${t['Ngày kết thúc'] || ''}</td>
      <td>
        <div style="width:100px;">
          <div style="font-size:0.75rem; text-align:right;">${progress}%</div>
          <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${progress}%;"></div></div>
        </div>
      </td>
      <td style="text-align:right;">
        <button class="btn btn-secondary btn-sm" onclick="openTaskModal('${t.ID || t.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteTask('${t.ID || t.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function sortTable(columnName) {
  if (appState.sortColumn === columnName) {
    appState.sortAscending = !appState.sortAscending;
  } else {
    appState.sortColumn = columnName;
    appState.sortAscending = true;
  }
  
  appState.tasks.sort((a, b) => {
    let valA = a[columnName] || '';
    let valB = b[columnName] || '';
    if (valA < valB) return appState.sortAscending ? -1 : 1;
    if (valA > valB) return appState.sortAscending ? 1 : -1;
    return 0;
  });
  
  renderAllViews();
}

/* ==============================================================================
   3. GANTT CHART TIMELINE RENDER
   ============================================================================== */
function renderGanttChart() {
  const container = document.getElementById('gantt-chart-container');
  if (!container) return;
  
  const filtered = getFilteredTasks();
  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">Không có dữ liệu công việc hiển thị trên biểu đồ Gantt</div>`;
    return;
  }
  
  // Calculate Timeline Month Range
  const months = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  const currentMonthIdx = new Date().getMonth();
  const displayMonths = months.slice(currentMonthIdx, currentMonthIdx + 4); // Display 4 months window
  
  let html = `
    <div class="gantt-header-months">
      <div style="width:240px; min-width:240px; font-weight:700; padding:10px; background:#f8fafc; border-right:1px solid var(--border-color);">Tên Công Việc</div>
      <div style="flex:1; display:flex;">
  `;
  
  displayMonths.forEach(m => {
    html += `<div class="gantt-month-cell">${m}</div>`;
  });
  html += `</div></div><div class="gantt-rows">`;

  filtered.forEach((t, idx) => {
    // Simple visual position calculation for timeline bar span
    const startMonth = t['Ngày bắt đầu'] ? new Date(t['Ngày bắt đầu']).getMonth() : currentMonthIdx;
    const endMonth = t['Ngày kết thúc'] ? new Date(t['Ngày kết thúc']).getMonth() : currentMonthIdx + 1;
    
    let leftOffsetPercent = Math.max(0, ((startMonth - currentMonthIdx) / 4) * 100);
    let widthPercent = Math.min(100 - leftOffsetPercent, Math.max(15, (((endMonth - startMonth + 1) / 4) * 100)));
    
    const progress = Number(t['Tiến độ (%)'] || 0);

    html += `
      <div class="gantt-row">
        <div class="gantt-label" title="${escapeHtml(t['Tiêu đề'])}">${escapeHtml(t['Tiêu đề'])}</div>
        <div class="gantt-timeline-track">
          <div class="gantt-bar" style="left: ${leftOffsetPercent}%; width: ${widthPercent}%;" onclick="openTaskModal('${t.ID || t.id}')">
            <span>${escapeHtml(t['Tiêu đề'])} (${progress}%)</span>
          </div>
        </div>
      </div>
    `;
  });
  
  html += `</div>`;
  container.innerHTML = html;
}

/* ==============================================================================
   4. CÔNG VIỆC LƯU Ý & DOCUMENTS & USERS TABLES
   ============================================================================== */
function renderCvLuuYTable() {
  const tbody = document.getElementById('cvluuy-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  appState.cvluuy.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.ID || item.id}</strong></td>
      <td><strong>${escapeHtml(item['Công việc'] || '')}</strong></td>
      <td>${escapeHtml(item['Mô tả'] || '')}</td>
      <td>${escapeHtml(item['Tổ'] || '')}</td>
      <td>${item['Ngày bắt đầu'] || ''}</td>
      <td>${item['Ngày kết thúc'] || ''}</td>
      <td>${item['Ngày làm xong'] || ''}</td>
      <td><span class="badge badge-high">${item['Trạng thái'] || 'Cần lưu ý'}</span></td>
      <td>${escapeHtml(item['Ghi chú'] || '')}</td>
      <td style="text-align:right;">
        <button class="btn btn-secondary btn-sm" onclick="openCvLuuYModal('${item.ID || item.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteCvLuuY('${item.ID || item.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDocumentsTable() {
  const tbody = document.getElementById('documents-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  appState.documents.forEach(doc => {
    const valHD = Number(doc['Giá trị HĐ'] || 0).toLocaleString('vi-VN');
    const valTH = Number(doc['Giá trị thực hiện'] || 0).toLocaleString('vi-VN');
    const diffVal = Number(doc['Chênh lệch'] || 0).toLocaleString('vi-VN');
    
    const fileLink = doc['File URL'] ? `<a href="${doc['File URL']}" target="_blank" class="btn btn-secondary btn-sm"><i class="fa-solid fa-file-pdf"></i> Tệp</a>` : 'Không có';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(doc['Số hồ sơ'] || '')}</strong></td>
      <td><strong>${escapeHtml(doc['Tên hồ sơ'] || '')}</strong></td>
      <td>${escapeHtml(doc['Danh mục'] || '')}</td>
      <td>${escapeHtml(doc['Phòng ban'] || '')}</td>
      <td>${escapeHtml(doc['Nhà cung cấp'] || '')}</td>
      <td><span class="badge badge-low">${doc['Tình trạng'] || 'Hiệu lực'}</span></td>
      <td>${valHD} đ</td>
      <td>${valTH} đ</td>
      <td>${diffVal} đ</td>
      <td>${fileLink}</td>
      <td style="text-align:right;">
        <button class="btn btn-secondary btn-sm" onclick="openDocumentModal('${doc.ID || doc.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteDoc('${doc.ID || doc.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderUsersTable() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  appState.users.forEach(usr => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${usr.ID || usr.id}</strong></td>
      <td><strong>${escapeHtml(usr['Tên'] || '')}</strong></td>
      <td>${escapeHtml(usr['Tổ'] || '')}</td>
      <td style="text-align:right;">
        <button class="btn btn-secondary btn-sm" onclick="openUserModal('${usr.ID || usr.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteUser('${usr.ID || usr.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ==============================================================================
   5. TASK FORM & SUBTASKS HANDLERS
   ============================================================================== */
function openTaskModal(taskId = null) {
  const form = document.getElementById('form-task');
  form.reset();
  document.getElementById('subtasks-container').innerHTML = '';
  
  if (taskId) {
    const task = appState.tasks.find(t => String(t.ID || t.id) === String(taskId));
    if (task) {
      document.getElementById('modal-task-title').innerText = 'Chỉnh Sửa Công Việc #' + taskId;
      document.getElementById('task-id').value = task.ID || task.id;
      document.getElementById('task-title-input').value = task['Tiêu đề'] || '';
      document.getElementById('task-desc-input').value = task['Mô tả'] || '';
      document.getElementById('task-priority-input').value = task['Mức độ ưu tiên'] || 'Trung bình';
      document.getElementById('task-status-input').value = task['Trạng thái'] || 'Đang thực hiện';
      document.getElementById('task-start-input').value = task['Ngày bắt đầu'] || '';
      document.getElementById('task-end-input').value = task['Ngày kết thúc'] || '';
      document.getElementById('task-assignee-input').value = task['Người thực hiện'] || '';
      document.getElementById('task-progress-input').value = task['Tiến độ (%)'] || 0;
      document.getElementById('progress-val-display').innerText = task['Tiến độ (%)'] || 0;
      document.getElementById('task-attachment-input').value = task['Tệp đính kèm'] || '';

      if (task.subtasks && Array.isArray(task.subtasks)) {
        task.subtasks.forEach(st => addSubtaskRow(st.title, st.completed));
      }
    }
  } else {
    document.getElementById('modal-task-title').innerText = 'Tạo Công Việc Mới';
    document.getElementById('task-id').value = '';
  }
  
  openModal('modal-task');
}

function addSubtaskRow(title = '', completed = false) {
  const container = document.getElementById('subtasks-container');
  const div = document.createElement('div');
  div.className = 'subtask-item';
  div.innerHTML = `
    <input type="checkbox" ${completed ? 'checked' : ''} onchange="recalculateSubtasksProgress()">
    <input type="text" class="form-control" value="${escapeHtml(title)}" placeholder="Tên việc con..." oninput="recalculateSubtasksProgress()">
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove(); recalculateSubtasksProgress();">&times;</button>
  `;
  container.appendChild(div);
}

function recalculateSubtasksProgress() {
  const items = document.querySelectorAll('#subtasks-container .subtask-item');
  if (items.length === 0) return;
  
  let checkedCount = 0;
  items.forEach(item => {
    const cb = item.querySelector('input[type="checkbox"]');
    if (cb && cb.checked) checkedCount++;
  });
  
  const calcProgress = Math.round((checkedCount / items.length) * 100);
  document.getElementById('task-progress-input').value = calcProgress;
  document.getElementById('progress-val-display').innerText = calcProgress;
}

function handleTaskFormSubmit(e) {
  e.preventDefault();
  
  const subtasks = [];
  document.querySelectorAll('#subtasks-container .subtask-item').forEach((item, idx) => {
    const title = item.querySelector('input[type="text"]').value.trim();
    const completed = item.querySelector('input[type="checkbox"]').checked;
    if (title) {
      subtasks.push({ id: idx + 1, title: title, completed: completed });
    }
  });

  const payload = {
    id: document.getElementById('task-id').value,
    'Tiêu đề': document.getElementById('task-title-input').value,
    'Mô tả': document.getElementById('task-desc-input').value,
    'Mức độ ưu tiên': document.getElementById('task-priority-input').value,
    'Trạng thái': document.getElementById('task-status-input').value,
    'Ngày bắt đầu': document.getElementById('task-start-input').value,
    'Ngày kết thúc': document.getElementById('task-end-input').value,
    'Người thực hiện': document.getElementById('task-assignee-input').value,
    'Tiến độ (%)': Number(document.getElementById('task-progress-input').value),
    'Tệp đính kèm': document.getElementById('task-attachment-input').value,
    subtasks: subtasks
  };

  closeModal('modal-task');
  showToast('Đang lưu công việc...', 'info');
  callBackend('saveTask', payload, () => showToast('Đã lưu công việc thành công!', 'success'));
}

function confirmDeleteTask(id) {
  if (confirm('Bạn có chắc chắn muốn xóa công việc này?')) {
    callBackend('deleteTask', { id: id }, () => showToast('Đã xóa công việc!', 'success'));
  }
}

/* ==============================================================================
   6. OTHER MODALS HANDLERS (CvLuuY, Document, User)
   ============================================================================== */
function openCvLuuYModal(id = null) {
  document.getElementById('form-cvluuy').reset();
  if (id) {
    const item = appState.cvluuy.find(i => String(i.ID || i.id) === String(id));
    if (item) {
      document.getElementById('ly-id').value = item.ID || item.id;
      document.getElementById('ly-task').value = item['Công việc'] || '';
      document.getElementById('ly-desc').value = item['Mô tả'] || '';
      document.getElementById('ly-group').value = item['Tổ'] || '';
      document.getElementById('ly-status').value = item['Trạng thái'] || 'Cần lưu ý';
      document.getElementById('ly-start').value = item['Ngày bắt đầu'] || '';
      document.getElementById('ly-end').value = item['Ngày kết thúc'] || '';
      document.getElementById('ly-note').value = item['Ghi chú'] || '';
    }
  } else {
    document.getElementById('ly-id').value = '';
  }
  openModal('modal-cvluuy');
}

function handleCvLuuYSubmit(e) {
  e.preventDefault();
  const payload = {
    id: document.getElementById('ly-id').value,
    'Công việc': document.getElementById('ly-task').value,
    'Mô tả': document.getElementById('ly-desc').value,
    'Tổ': document.getElementById('ly-group').value,
    'Trạng thái': document.getElementById('ly-status').value,
    'Ngày bắt đầu': document.getElementById('ly-start').value,
    'Ngày kết thúc': document.getElementById('ly-end').value,
    'Ghi chú': document.getElementById('ly-note').value
  };
  closeModal('modal-cvluuy');
  callBackend('saveCvLuuY', payload, () => showToast('Đã lưu công việc lưu ý!', 'success'));
}

function confirmDeleteCvLuuY(id) {
  if (confirm('Bạn có chắc chắn muốn xóa mục này?')) {
    callBackend('deleteCvLuuY', { id: id }, () => showToast('Đã xóa thành công!', 'success'));
  }
}

function openDocumentModal(id = null) {
  document.getElementById('form-doc').reset();
  if (id) {
    const doc = appState.documents.find(d => String(d.ID || d.id) === String(id));
    if (doc) {
      document.getElementById('doc-id').value = doc.ID || doc.id;
      document.getElementById('doc-code').value = doc['Số hồ sơ'] || '';
      document.getElementById('doc-title').value = doc['Tên hồ sơ'] || '';
      document.getElementById('doc-category').value = doc['Danh mục'] || '';
      document.getElementById('doc-dept').value = doc['Phòng ban'] || '';
      document.getElementById('doc-vendor').value = doc['Nhà cung cấp'] || '';
      document.getElementById('doc-status').value = doc['Tình trạng'] || 'Đang hiệu lực';
      document.getElementById('doc-val-hd').value = doc['Giá trị HĐ'] || 0;
      document.getElementById('doc-val-th').value = doc['Giá trị thực hiện'] || 0;
      document.getElementById('doc-file-url').value = doc['File URL'] || '';
    }
  } else {
    document.getElementById('doc-id').value = '';
  }
  openModal('modal-doc');
}

function handleDocSubmit(e) {
  e.preventDefault();
  const payload = {
    id: document.getElementById('doc-id').value,
    'Số hồ sơ': document.getElementById('doc-code').value,
    'Tên hồ sơ': document.getElementById('doc-title').value,
    'Danh mục': document.getElementById('doc-category').value,
    'Phòng ban': document.getElementById('doc-dept').value,
    'Nhà cung cấp': document.getElementById('doc-vendor').value,
    'Tình trạng': document.getElementById('doc-status').value,
    'Giá trị HĐ': document.getElementById('doc-val-hd').value,
    'Giá trị thực hiện': document.getElementById('doc-val-th').value,
    'File URL': document.getElementById('doc-file-url').value
  };
  closeModal('modal-doc');
  callBackend('saveDocument', payload, () => showToast('Đã lưu hồ sơ thành công!', 'success'));
}

function confirmDeleteDoc(id) {
  if (confirm('Bạn có chắc chắn muốn xóa hồ sơ tài liệu này?')) {
    callBackend('deleteDocument', { id: id }, () => showToast('Đã xóa hồ sơ!', 'success'));
  }
}

function openUserModal(id = null) {
  document.getElementById('form-user').reset();
  if (id) {
    const usr = appState.users.find(u => String(u.ID || u.id) === String(id));
    if (usr) {
      document.getElementById('usr-id').value = usr.ID || usr.id;
      document.getElementById('usr-name').value = usr['Tên'] || '';
      document.getElementById('usr-group').value = usr['Tổ'] || '';
    }
  } else {
    document.getElementById('usr-id').value = '';
  }
  openModal('modal-user');
}

function handleUserSubmit(e) {
  e.preventDefault();
  const payload = {
    id: document.getElementById('usr-id').value,
    'Tên': document.getElementById('usr-name').value,
    'Tổ': document.getElementById('usr-group').value
  };
  closeModal('modal-user');
  callBackend('saveUser', payload, () => showToast('Đã lưu người dùng!', 'success'));
}

function confirmDeleteUser(id) {
  if (confirm('Bạn có chắc chắn muốn xóa người dùng này?')) {
    callBackend('deleteUser', { id: id }, () => showToast('Đã xóa người dùng!', 'success'));
  }
}

/* ==============================================================================
   7. UTILITY & TOAST NOTIFICATIONS
   ============================================================================== */
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function openSettingsModal() {
  openModal('modal-settings');
}

function saveSettings() {
  const url = document.getElementById('gas-api-url-input').value.trim();
  localStorage.setItem('GAS_WEB_APP_URL', url);
  appState.apiUrl = url;
  closeModal('modal-settings');
  showToast('Đã lưu URL kết nối API thành công!', 'success');
  appState.loadData(true);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#4568dc';
  
  toast.style.cssText = `
    background: ${bg};
    color: #ffffff;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-size: 0.88rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
  `;
  
  const icon = type === 'success' ? 'circle-check' : type === 'error' ? 'circle-exclamation' : 'circle-info';
  toast.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${escapeHtml(message)}`;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
