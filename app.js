/**
 * ==============================================================================
 * TTHT Tasks - Quản Lý Công Việc & Hồ Sơ (Vanilla JS Engine - Dark Theme)
 * ==============================================================================
 */

const appState = {
  tasks: [],
  users: [],
  cvluuy: [],
  documents: [],
  currentTab: 'tongquan',
  filters: {
    search: '',
    user: '',
    group: '',
    kanbanAssignee: '',
    kanbanPriority: ''
  },
  sortColumn: 'ID',
  sortAscending: false,
  apiUrl: localStorage.getItem('GAS_WEB_APP_URL') || '',
  isGAS: typeof google !== 'undefined' && google.script && google.script.run,
  donutChart: null
};

const noteDebounceTimers = {};

function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(38, el.scrollHeight) + 'px';
}

function cleanKey(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function getTaskAssignee(task) {
  if (!task) return 'Chưa gán';
  for (let k in task) {
    const ck = cleanKey(k);
    if (ck === 'nguoichutri' || ck === 'nguoiphutrach' || ck === 'nguoithuchien' || ck === 'assignee') {
      if (task[k] !== undefined && task[k] !== null && String(task[k]).trim() !== '') {
        return String(task[k]).trim();
      }
    }
  }
  for (let k in task) {
    const ck = cleanKey(k);
    if (ck.includes('chutri') || ck.includes('phutrach') || ck.includes('thuchien')) {
      if (task[k] !== undefined && task[k] !== null && String(task[k]).trim() !== '') {
        return String(task[k]).trim();
      }
    }
  }
  return 'Chưa gán';
}

function getTaskCollaborator(task) {
  if (!task) return '';
  for (let k in task) {
    const ck = cleanKey(k);
    if (ck === 'nguoiphoihop') {
      if (task[k] !== undefined && task[k] !== null && String(task[k]).trim() !== '') {
        return String(task[k]).trim();
      }
    }
  }
  for (let k in task) {
    const ck = cleanKey(k);
    if (ck.includes('phoihop') && !ck.includes('to')) {
      if (task[k] !== undefined && task[k] !== null && String(task[k]).trim() !== '') {
        return String(task[k]).trim();
      }
    }
  }
  return '';
}

function formatUniqueGroups(groupStr) {
  if (!groupStr) return '';
  const parts = String(groupStr).split(',').map(p => p.trim()).filter(Boolean);
  const unique = Array.from(new Set(parts));
  return unique.join(', ');
}

function getTaskGroup(task) {
  if (!task) return '';
  
  let rawGroup = '';
  for (let k in task) {
    const ck = cleanKey(k);
    if (ck === 'tochutri' || ck === 'to' || ck === 'tentocutri' || ck === 'tengroup') {
      if (task[k] !== undefined && task[k] !== null && String(task[k]).trim() !== '') {
        rawGroup = String(task[k]).trim();
        break;
      }
    }
  }

  if (!rawGroup) {
    const assignee = getTaskAssignee(task);
    if (assignee && assignee !== 'Chưa gán') {
      const names = assignee.split(',').map(n => n.trim()).filter(Boolean);
      const groups = new Set();
      names.forEach(name => {
        const usr = appState.users.find(u => {
          const uName = u['Tên'] || u['Tên nhân viên'] || u['Họ và tên'] || u.name;
          return cleanKey(uName) === cleanKey(name);
        });
        if (usr) {
          for (let k in usr) {
            const ck = cleanKey(k);
            if (ck === 'to' || ck === 'tochutri' || ck === 'tento') {
              if (usr[k] && String(usr[k]).trim()) groups.add(String(usr[k]).trim());
            }
          }
        }
      });
      if (groups.size > 0) rawGroup = Array.from(groups).join(', ');
    }
  }

  if (!rawGroup) {
    for (let k in task) {
      const ck = cleanKey(k);
      if (ck.includes('chutri') && ck.includes('to')) {
        if (task[k] && String(task[k]).trim()) {
          rawGroup = String(task[k]).trim();
          break;
        }
      }
    }
  }

  return formatUniqueGroups(rawGroup);
}

function getTaskCollaboratorGroup(task) {
  if (!task) return '';
  for (let k in task) {
    const ck = cleanKey(k);
    if (ck === 'tophoihop') {
      if (task[k] !== undefined && task[k] !== null && String(task[k]).trim() !== '') {
        return String(task[k]).trim();
      }
    }
  }
  for (let k in task) {
    const ck = cleanKey(k);
    if (ck.includes('phoihop') && ck.includes('to')) {
      if (task[k] && String(task[k]).trim()) return String(task[k]).trim();
    }
  }
  return '';
}

function ensureSelectsPopulated() {
  const gSelect = document.getElementById('global-group-select');
  if (!gSelect || gSelect.options.length <= 1) {
    populateSelects();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('gas-api-url-input');
  if (urlInput && appState.apiUrl) {
    urlInput.value = appState.apiUrl;
  }
  
  // Attach event listeners to sidebar tab buttons
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = btn.getAttribute('data-tab');
      if (tabName) switchSidebarTab(tabName);
    });
  });

  // Attach search & group filter event listeners
  const sInput = document.getElementById('global-search-input');
  const uSelect = document.getElementById('global-user-select');
  const gSelect = document.getElementById('global-group-select');

  if (sInput) sInput.addEventListener('input', handleGlobalFilter);
  if (uSelect) uSelect.addEventListener('change', handleGlobalFilter);
  if (gSelect) gSelect.addEventListener('change', onGlobalGroupChange);

  // Restore local cache for zero-latency initial view on F5
  const cachedTasks = localStorage.getItem('TTHT_TASKS_CACHE');
  const cachedUsers = localStorage.getItem('TTHT_USERS_CACHE');
  if (cachedTasks) {
    try { appState.tasks = JSON.parse(cachedTasks); } catch(e) {}
  }
  if (cachedUsers) {
    try { appState.users = JSON.parse(cachedUsers); } catch(e) {}
  }

  if (appState.tasks.length > 0 || appState.users.length > 0) {
    populateSelects();
    renderActiveTab();
  }

  appState.loadData();
  setupKanbanDragAndDrop();
});

appState.loadData = function (forceRefresh = false) {
  showToast('Đang đồng bộ dữ liệu với Google Sheets...', 'info');
  
  if (appState.isGAS) {
    google.script.run
      .withSuccessHandler(onDataLoaded)
      .withFailureHandler(onDataError)
      .getInitialData(forceRefresh);
  } else {
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

function callBackendSilent(action, payload) {
  if (appState.isGAS) {
    google.script.run
      .withSuccessHandler(res => {
        console.log('Silent sync success:', action, res);
      })
      .withFailureHandler(err => console.error('Silent sync error:', err))[action](payload);
  } else {
    const fetchUrl = appState.apiUrl || window.location.href;
    fetch(fetchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: action, payload: payload })
    }).catch(err => console.error('Silent sync error:', err));
  }
}

function onDataLoaded(response) {
  if (response && response.success) {
    appState.tasks = response.tasks || [];
    appState.users = response.users || [];
    appState.cvluuy = response.cvluuy || [];
    appState.documents = response.documents || [];
    
    appState.tasks.forEach(t => {
      if (typeof t['Danh sách công việc con'] === 'string' && t['Danh sách công việc con']) {
        try { t.subtasks = JSON.parse(t['Danh sách công việc con']); } catch (e) { t.subtasks = []; }
      } else {
        t.subtasks = t.subtasks || [];
      }

      // Check status: Hoàn thành quá hạn
      const doneDate = t['Ngày làm xong'] || '';
      const endDate = t['Ngày kết thúc'] || t['Hạn hoàn thành'] || '';
      if (doneDate && endDate && doneDate > endDate) {
        t['Trạng thái'] = 'Hoàn thành quá hạn';
      }
    });

    try {
      localStorage.setItem('TTHT_TASKS_CACHE', JSON.stringify(appState.tasks));
      localStorage.setItem('TTHT_USERS_CACHE', JSON.stringify(appState.users));
    } catch(e) {}

    populateSelects();
    renderActiveTab();
    showToast('Đồng bộ dữ liệu thành công!', 'success');
  } else {
    showToast('Lỗi: ' + (response.message || 'Unknown'), 'error');
  }
}

function onDataError(error) {
  console.error('API Error:', error);
  showToast('Không thể kết nối với Backend Google Apps Script.', 'error');
}

function populateSelects() {
  const groupSelect = document.getElementById('global-group-select');
  const cvluuyGroupSelect = document.getElementById('cvluuy-group-select');
  const kanbanAssigneeSelect = document.getElementById('kanban-assignee-filter');
  const taskChuTriSelect = document.getElementById('task-chutri-input');
  const taskPhoiHopSelect = document.getElementById('task-phoihop-input');
  
  const hostGroups = new Set();
  const allGroups = new Set();
  const assignees = new Set();
  
  appState.users.forEach(u => {
    let name = '';
    let group = '';
    for (let k in u) {
      const ck = cleanKey(k);
      if (ck === 'to' || ck === 'tochutri' || ck === 'tento' || ck === 'group') {
        if (u[k] && String(u[k]).trim()) group = String(u[k]).trim();
      }
      if (ck === 'ten' || ck === 'tennhanvien' || ck === 'hovaten' || ck === 'name') {
        if (u[k] && String(u[k]).trim()) name = String(u[k]).trim();
      }
    }
    if (group) {
      hostGroups.add(group);
      allGroups.add(group);
    }
    if (name) assignees.add(name);
  });

  appState.tasks.forEach(t => {
    const a = getTaskAssignee(t);
    const c = getTaskCollaborator(t);
    const tg = getTaskGroup(t);
    const tcg = getTaskCollaboratorGroup(t);
    
    if (a && a !== 'Chưa gán') assignees.add(a);
    if (c && String(c).trim()) assignees.add(c);
    if (tg && String(tg).trim()) {
      hostGroups.add(tg);
      allGroups.add(tg);
    }
    if (tcg && String(tcg).trim()) allGroups.add(tcg);

    for (let k in t) {
      const ck = cleanKey(k);
      if (ck.includes('to') && t[k] && typeof t[k] === 'string' && t[k].trim()) {
        const val = t[k].trim();
        if (val.toLowerCase().includes('tổ') || val.toLowerCase().includes('to ')) {
          hostGroups.add(val);
          allGroups.add(val);
        }
      }
    }
  });

  appState.cvluuy.forEach(item => {
    for (let k in item) {
      const ck = cleanKey(k);
      if (ck.includes('to') && item[k] && typeof item[k] === 'string' && item[k].trim()) {
        allGroups.add(item[k].trim());
      }
    }
  });

  if (groupSelect) {
    const curVal = groupSelect.value;
    groupSelect.innerHTML = '<option value="">Tất cả tổ chủ trì</option>';
    Array.from(hostGroups).sort().forEach(g => {
      if (g) groupSelect.innerHTML += `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`;
    });
    if (curVal) groupSelect.value = curVal;
  }

  if (cvluuyGroupSelect) {
    const curVal = cvluuyGroupSelect.value;
    cvluuyGroupSelect.innerHTML = '<option value="">Tất cả tổ</option>';
    Array.from(allGroups).sort().forEach(g => {
      if (g) cvluuyGroupSelect.innerHTML += `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`;
    });
    if (curVal) cvluuyGroupSelect.value = curVal;
  }

  if (kanbanAssigneeSelect) {
    const curVal = kanbanAssigneeSelect.value;
    kanbanAssigneeSelect.innerHTML = '<option value="">Tất cả người phụ trách</option>';
    Array.from(assignees).sort().forEach(a => {
      if (a) kanbanAssigneeSelect.innerHTML += `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`;
    });
    if (curVal) kanbanAssigneeSelect.value = curVal;
  }

  if (taskChuTriSelect) {
    const curVal = taskChuTriSelect.value;
    taskChuTriSelect.innerHTML = '<option value="">-- Chọn người chủ trì --</option>';
    Array.from(assignees).sort().forEach(a => {
      if (a) taskChuTriSelect.innerHTML += `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`;
    });
    if (curVal) taskChuTriSelect.value = curVal;
  }

  if (taskPhoiHopSelect) {
    const curVal = taskPhoiHopSelect.value;
    taskPhoiHopSelect.innerHTML = '<option value="">-- Chọn người phối hợp --</option>';
    Array.from(assignees).sort().forEach(a => {
      if (a) taskPhoiHopSelect.innerHTML += `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`;
    });
    if (curVal) taskPhoiHopSelect.value = curVal;
  }

  updateGlobalUserSelectOptions();
}

function onGlobalGroupChange() {
  updateGlobalUserSelectOptions();
  handleGlobalFilter();
}

function updateGlobalUserSelectOptions() {
  const userSelect = document.getElementById('global-user-select');
  const groupSelect = document.getElementById('global-group-select');
  if (!userSelect || !groupSelect) return;

  const selectedGroup = String(groupSelect.value || '').trim().toLowerCase();
  const currentSelectedUser = userSelect.value;

  const usersInGroup = new Set();

  appState.users.forEach(u => {
    const g = String(u['Tổ'] || u['TỔ'] || u['Tên tổ'] || u.group || '').trim();
    const name = String(u['Tên'] || u['Tên nhân viên'] || u['Họ và tên'] || u.name || '').trim();
    if (name) {
      if (!selectedGroup || g.toLowerCase() === selectedGroup) {
        usersInGroup.add(name);
      }
    }
  });

  appState.tasks.forEach(t => {
    const tg = getTaskGroup(t).trim().toLowerCase();
    if (!selectedGroup || tg === selectedGroup) {
      const chuTri = getTaskAssignee(t);
      const phoiHop = getTaskCollaborator(t);
      if (chuTri && chuTri !== 'Chưa gán') usersInGroup.add(chuTri);
      if (phoiHop) usersInGroup.add(phoiHop);
    }
  });

  userSelect.innerHTML = '<option value="">Tất cả người phụ trách</option>';
  Array.from(usersInGroup).sort().forEach(name => {
    userSelect.innerHTML += `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
  });

  if (currentSelectedUser && Array.from(usersInGroup).some(u => u.toLowerCase() === currentSelectedUser.toLowerCase())) {
    userSelect.value = currentSelectedUser;
  } else {
    userSelect.value = '';
    appState.filters.user = '';
  }
}

function switchSidebarTab(tabName) {
  appState.currentTab = tabName;
  
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
  const activeSec = document.getElementById('section-' + tabName);
  if (activeSec) activeSec.classList.add('active');

  const titles = {
    tongquan: 'Tổng quan',
    kanban: 'Bảng Kanban',
    danhsach: 'Danh sách',
    gantt: 'Biểu đồ Gantt',
    tailieu: 'Quản lý tài liệu',
    nguoidung: 'Quản lý người dùng',
    thongke: 'Đánh giá & Thống kê',
    cvluuy: 'Công việc lưu ý'
  };
  const titleDisplay = document.getElementById('page-title-display');
  if (titleDisplay) titleDisplay.innerText = titles[tabName] || 'TTHT Tasks';

  renderActiveTab();
}

function handleGlobalFilter() {
  const sEl = document.getElementById('global-search-input');
  const uEl = document.getElementById('global-user-select');
  const gEl = document.getElementById('global-group-select');

  appState.filters.search = sEl ? sEl.value.trim() : '';
  appState.filters.user = uEl ? uEl.value : '';
  appState.filters.group = gEl ? gEl.value : '';
  
  renderActiveTab();
}

function handleKanbanFilter() {
  appState.filters.kanbanAssignee = document.getElementById('kanban-assignee-filter').value;
  appState.filters.kanbanPriority = document.getElementById('kanban-priority-filter').value;
  renderKanbanBoard();
}

function getFilteredTasks() {
  const search = (appState.filters.search || '').trim().toLowerCase();
  const groupFilter = (appState.filters.group || '').trim().toLowerCase();
  const userFilter = (appState.filters.user || '').trim().toLowerCase();
  const kanbanAssignee = (appState.filters.kanbanAssignee || '').trim().toLowerCase();
  const kanbanPriority = (appState.filters.kanbanPriority || '').trim();

  return appState.tasks.filter(t => {
    const chuTri = getTaskAssignee(t);
    const toChuTri = getTaskGroup(t);
    const phoiHop = getTaskCollaborator(t);
    const toPhoiHop = getTaskCollaboratorGroup(t);

    // 1. Text search box filter
    if (search) {
      const allTextValues = Object.values(t).join(' ').toLowerCase();
      const combinedText = `${allTextValues} ${chuTri.toLowerCase()} ${toChuTri.toLowerCase()} ${phoiHop.toLowerCase()} ${toPhoiHop.toLowerCase()}`;
      if (!combinedText.includes(search)) return false;
    }
    
    // 2. Group filter (Tổ chủ trì)
    if (groupFilter) {
      if (toChuTri.toLowerCase() !== groupFilter) return false;
    }

    // 3. User / Person in charge filter (Chủ trì hoặc Phối hợp)
    if (userFilter) {
      const matchChuTri = chuTri.toLowerCase() === userFilter;
      const matchPhoiHop = phoiHop.toLowerCase() === userFilter;
      if (!matchChuTri && !matchPhoiHop) return false;
    }

    // 4. Kanban specific filters
    if (kanbanAssignee && chuTri.toLowerCase() !== kanbanAssignee) return false;
    if (kanbanPriority && String(t['Mức độ ưu tiên'] || '').trim() !== kanbanPriority) return false;

    return true;
  });
}

function renderActiveTab() {
  const tab = appState.currentTab;
  if (tab === 'tongquan') renderDashboard();
  else if (tab === 'kanban') renderKanbanBoard();
  else if (tab === 'danhsach') renderTaskListTable();
  else if (tab === 'gantt') renderGanttChart();
  else if (tab === 'tailieu') renderDocumentsTable();
  else if (tab === 'nguoidung') renderUsersTable();
  else if (tab === 'thongke') renderOrgStatistics();
  else if (tab === 'cvluuy') renderCvLuuYTable();
}

/* 1. DASHBOARD */
function renderDashboard() {
  const filtered = getFilteredTasks();
  let countDoing = 0, countDone = 0, countOverdue = 0, countCanceled = 0;
  filtered.forEach(t => {
    const st = t['Trạng thái'] || 'Đang thực hiện';
    if (st === 'Đang thực hiện') countDoing++;
    else if (st === 'Hoàn thành' || st === 'Hoàn thành quá hạn') countDone++;
    else if (st === 'Quá hạn') countOverdue++;
    else if (st === 'Đã hủy') countCanceled++;
  });
  
  const total = filtered.length;
  if (document.getElementById('kpi-total-val')) document.getElementById('kpi-total-val').innerText = total;
  if (document.getElementById('kpi-doing-val')) document.getElementById('kpi-doing-val').innerText = countDoing;
  if (document.getElementById('kpi-done-val')) document.getElementById('kpi-done-val').innerText = countDone;
  if (document.getElementById('kpi-overdue-val')) document.getElementById('kpi-overdue-val').innerText = countOverdue;

  const pctDone = total > 0 ? Math.round((countDone / total) * 100) : 0;
  if (document.getElementById('donut-percent')) document.getElementById('donut-percent').innerText = pctDone + '%';
  if (document.getElementById('lg-doing')) document.getElementById('lg-doing').innerText = countDoing;
  if (document.getElementById('lg-done')) document.getElementById('lg-done').innerText = countDone;
  if (document.getElementById('lg-overdue')) document.getElementById('lg-overdue').innerText = countOverdue;
  if (document.getElementById('lg-canceled')) document.getElementById('lg-canceled').innerText = countCanceled;

  renderDonutChart(countDoing, countDone, countOverdue, countCanceled);
  renderHighPriorityTasks(filtered);
  renderRecentTasks(filtered);
}

function renderDonutChart(doing, done, overdue, canceled) {
  const ctx = document.getElementById('statusDonutChart');
  if (!ctx || typeof Chart === 'undefined') return;
  if (appState.donutChart) appState.donutChart.destroy();
  
  try {
    appState.donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Đang thực hiện', 'Hoàn thành', 'Quá hạn', 'Đã hủy'],
        datasets: [{
          data: [doing, done, overdue, canceled],
          backgroundColor: ['#38bdf8', '#10b981', '#ef4444', '#64748b'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        cutout: '78%',
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        responsive: true,
        maintainAspectRatio: false
      }
    });
  } catch (e) {
    console.error('Chart error:', e);
  }
}

function renderHighPriorityTasks(tasks) {
  const container = document.getElementById('high-priority-container');
  if (!container) return;
  const highPriority = tasks.filter(t => t['Mức độ ưu tiên'] === 'Cao');
  if (highPriority.length === 0) {
    container.innerHTML = `<div class="empty-widget-state"><i class="fa-solid fa-angles-down"></i> Không có công việc ưu tiên cao</div>`;
    return;
  }
  let html = '';
  highPriority.slice(0, 5).forEach(t => {
    html += `
      <div class="recent-row-item" onclick="openTaskModal('${t.ID || t.id}')" style="cursor:pointer;">
        <div class="recent-title-group">
          <i class="fa-solid fa-circle-exclamation" style="color:#f43f5e;"></i>
          <span>${escapeHtml(t['Tiêu đề'])}</span>
        </div>
        <div class="recent-meta-group">
          <span class="tag-priority tag-p-high">Cao</span>
          <span style="font-size:0.75rem; color:#94a3b8;">${formatDateVN(t['Ngày kết thúc'])}</span>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderRecentTasks(tasks) {
  const container = document.getElementById('recent-tasks-container');
  if (!container) return;
  if (tasks.length === 0) {
    container.innerHTML = `<div class="empty-widget-state">Chưa có dữ liệu công việc</div>`;
    return;
  }
  let html = '';
  tasks.slice(0, 8).forEach(t => {
    const priority = t['Mức độ ưu tiên'] || 'Trung bình';
    const tagPClass = priority === 'Cao' ? 'tag-p-high' : priority === 'Trung bình' ? 'tag-p-med' : 'tag-p-low';
    const status = t['Trạng thái'] || '';
    
    let statusHtml = `<span style="font-size:0.75rem; color:#94a3b8;">${status}</span>`;
    if (status === 'Hoàn thành quá hạn') {
      statusHtml = `<span style="color:#f59e0b; font-weight:600; font-size:0.75rem;">Hoàn thành quá hạn</span>`;
    } else if (status === 'Quá hạn') {
      statusHtml = `<span class="tag-status-overdue">Quá hạn</span>`;
    }

    html += `
      <div class="recent-row-item" onclick="openTaskModal('${t.ID || t.id}')" style="cursor:pointer;">
        <div class="recent-title-group">
          <span>${escapeHtml(t['Tiêu đề'])}</span>
          <span class="tag-org">VNPT</span>
        </div>
        <div class="recent-meta-group">
          <span class="tag-priority ${tagPClass}">${priority}</span>
          ${statusHtml}
          <span style="font-size:0.75rem; color:#64748b;">${formatDateVN(t['Ngày kết thúc'])}</span>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

/* 2. KANBAN BOARD */
function renderKanbanBoard() {
  const filtered = getFilteredTasks();
  const cols = {
    'Đang thực hiện': document.getElementById('cards-doing'),
    'Hoàn thành': document.getElementById('cards-done'),
    'Quá hạn': document.getElementById('cards-overdue'),
    'Đã hủy': document.getElementById('cards-canceled')
  };
  const counts = { 'Đang thực hiện': 0, 'Hoàn thành': 0, 'Quá hạn': 0, 'Đã hủy': 0 };
  Object.values(cols).forEach(c => { if (c) c.innerHTML = ''; });
  
  filtered.forEach(t => {
    let st = t['Trạng thái'] || 'Đang thực hiện';
    if (st === 'Hoàn thành quá hạn') st = 'Hoàn thành';
    if (cols[st]) {
      counts[st]++;
      cols[st].appendChild(createDarkTaskCard(t));
    }
  });

  if (document.getElementById('kb-count-doing')) document.getElementById('kb-count-doing').innerText = counts['Đang thực hiện'];
  if (document.getElementById('kb-count-done')) document.getElementById('kb-count-done').innerText = counts['Hoàn thành'];
  if (document.getElementById('kb-count-overdue')) document.getElementById('kb-count-overdue').innerText = counts['Quá hạn'];
  if (document.getElementById('kb-count-canceled')) document.getElementById('kb-count-canceled').innerText = counts['Đã hủy'];
}

function createDarkTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'dark-card';
  card.draggable = true;
  card.dataset.id = task.ID || task.id;
  
  const priority = task['Mức độ ưu tiên'] || 'Trung bình';
  const tagPClass = priority === 'Cao' ? 'tag-p-high' : priority === 'Trung bình' ? 'tag-p-med' : 'tag-p-low';
  const assignee = getTaskAssignee(task);
  const avatarLetter = assignee.charAt(0).toUpperCase();

  card.innerHTML = `
    <div class="dark-card-tags">
      <span class="tag-priority ${tagPClass}">${priority}</span>
      <span class="tag-org">VNPT</span>
    </div>
    <div class="dark-card-title">${escapeHtml(task['Tiêu đề'] || '')}</div>
    ${task['Mô tả'] ? `<div class="dark-card-sub">${escapeHtml(task['Mô tả'])}</div>` : ''}
    <div class="dark-card-footer">
      <div><i class="fa-regular fa-calendar"></i> ${formatDateVN(task['Ngày kết thúc'])}</div>
      <div style="display:flex; align-items:center; gap:6px;">
        <div style="width:22px; height:22px; border-radius:50%; background:var(--emerald-primary); color:#0b0f19; font-weight:700; font-size:0.7rem; display:flex; align-items:center; justify-content:center;">${avatarLetter}</div>
        <button class="btn-dark-sec btn-sm" style="padding:2px 6px;" onclick="openTaskModal('${task.ID || task.id}'); event.stopPropagation();"><i class="fa-solid fa-pen"></i></button>
      </div>
    </div>
  `;
  
  card.addEventListener('dragstart', (e) => {
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', task.ID || task.id);
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
  
  return card;
}

function setupKanbanDragAndDrop() {
  document.querySelectorAll('.kanban-cards-dark').forEach(container => {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.style.background = 'rgba(0, 200, 151, 0.08)';
    });
    container.addEventListener('dragleave', () => container.style.background = 'transparent');
    container.addEventListener('drop', (e) => {
      e.preventDefault();
      container.style.background = 'transparent';
      const taskId = e.dataTransfer.getData('text/plain');
      const newStatus = container.dataset.status;
      
      if (taskId && newStatus) {
        const task = appState.tasks.find(t => String(t.ID || t.id) === String(taskId));
        if (task) {
          task['Trạng thái'] = newStatus;
          if (newStatus === 'Hoàn thành') task['Tiến độ (%)'] = 100;
          try { localStorage.setItem('TTHT_TASKS_CACHE', JSON.stringify(appState.tasks)); } catch(e) {}
          renderKanbanBoard();
          callBackendSilent('updateTaskStatus', { id: taskId, status: newStatus });
          showToast(`Đã chuyển công việc sang "${newStatus}"`, 'success');
        }
      }
    });
  });
}

function formatNameList(nameStr) {
  if (!nameStr) return '';
  const names = String(nameStr).split(',').map(n => n.trim()).filter(Boolean);
  if (names.length === 0) return '';
  return names.map(n => `<div style="line-height:1.35; margin:3px 0; word-break:break-word;">${escapeHtml(n)}</div>`).join('');
}

/* 3. DANH SÁCH (TABLE) */
function renderTaskListTable() {
  const filtered = getFilteredTasks();
  const tbody = document.getElementById('task-list-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding:30px; color:var(--text-muted);">Không có dữ liệu công việc phù hợp</td></tr>`;
    return;
  }
  
  filtered.forEach(t => {
    const taskId = t.ID || t.id;
    const status = t['Trạng thái'] || 'Đang thực hiện';
    
    let statusBadge = '';
    if (status === 'Hoàn thành quá hạn') {
      statusBadge = `<span style="color:#f59e0b; font-weight:600; background:rgba(245, 158, 11, 0.15); padding:2px 8px; border-radius:12px; font-size:0.75rem;">Hoàn thành quá hạn</span>`;
    } else if (status === 'Quá hạn') {
      statusBadge = `<span class="tag-status-overdue">Quá hạn</span>`;
    } else if (status === 'Hoàn thành') {
      statusBadge = `<span style="color:#10b981; font-weight:600;">Hoàn thành</span>`;
    } else {
      statusBadge = `<span style="color:#38bdf8; font-weight:600;">${status}</span>`;
    }

    const progress = Number(t['Tiến độ (%)'] || 0);
    const keHoach = t['Kế hoạch'] !== undefined && t['Kế hoạch'] !== '' ? t['Kế hoạch'] : 1;
    const thucHien = t['Thực hiện'] !== undefined && t['Thực hiện'] !== '' ? t['Thực hiện'] : 0;
    const tyLe = t['Tỷ lệ'] || (keHoach > 0 ? Math.round((thucHien / keHoach) * 100) + '%' : '0%');
    const ghiChu = t['Ghi chú'] || '';
    const ngayLamXong = t['Ngày làm xong'] || '';
    const chuTriName = getTaskAssignee(t);
    const toChuTriName = getTaskGroup(t);
    const phoiHopName = getTaskCollaborator(t);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-title-cell"><strong style="color:#ffffff;">${escapeHtml(t['Tiêu đề'] || '')}</strong></td>
      <td class="col-desc-cell">${escapeHtml(t['Mô tả'] || '')}</td>
      <td class="status-col-cell">${statusBadge}</td>
      <td>${formatNameList(chuTriName)}</td>
      <td><span class="tag-org">${escapeHtml(toChuTriName || 'Chung')}</span></td>
      <td>${formatNameList(phoiHopName)}</td>
      <td>${formatDateVN(t['Ngày bắt đầu'])}</td>
      <td>${formatDateVN(t['Ngày kết thúc'])}</td>
      <td>
        <input type="date" class="inline-date-picker" value="${ngayLamXong}" onchange="handleInlineTaskChange('${taskId}', 'ngayLamXong', this.value, this)">
      </td>
      <td class="progress-col-cell">
        <div style="display:flex; align-items:center; gap:6px; justify-content:center;">
          <div style="width:45px; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
            <div style="width:${progress}%; height:100%; background:var(--emerald-primary);"></div>
          </div>
          <span style="font-size:0.75rem; color:#94a3b8;">${progress}%</span>
        </div>
      </td>
      <td><span class="number-pill">${keHoach}</span></td>
      <td>
        <input type="number" class="inline-note-input" style="width:50px; text-align:center; padding:3px;" value="${thucHien}" onchange="handleInlineTaskChange('${taskId}', 'thucHien', this.value, this)" oninput="handleInlineTaskChange('${taskId}', 'thucHien', this.value, this)">
      </td>
      <td class="ty-le-col-cell"><strong style="color:var(--emerald-primary);">${tyLe}</strong></td>
      <td class="col-note-cell">
        <textarea class="inline-note-textarea" placeholder="Nhập ghi chú..." oninput="autoResizeTextarea(this); handleInlineTaskChange('${taskId}', 'ghiChu', this.value, this)" onchange="handleInlineTaskChange('${taskId}', 'ghiChu', this.value, this)">${escapeHtml(ghiChu)}</textarea>
      </td>
      <td style="text-align:center;">
        <div style="display:flex; gap:4px; justify-content:center;">
          <button class="btn-action-edit" title="Sửa công việc" onclick="openTaskModal('${taskId}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-action-delete" title="Xóa công việc" onclick="confirmDeleteTask('${taskId}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  setTimeout(() => {
    document.querySelectorAll('.inline-note-textarea').forEach(autoResizeTextarea);
  }, 50);
}

function handleInlineTaskChange(taskId, field, value, element) {
  const task = appState.tasks.find(t => String(t.ID || t.id) === String(taskId));
  if (!task) return;
  const payload = { id: taskId };

  if (field === 'ghiChu') {
    task['Ghi chú'] = value;
    payload.ghiChu = value;
    try { localStorage.setItem('TTHT_TASKS_CACHE', JSON.stringify(appState.tasks)); } catch(e) {}

    if (noteDebounceTimers[taskId]) clearTimeout(noteDebounceTimers[taskId]);
    noteDebounceTimers[taskId] = setTimeout(() => {
      callBackendSilent('updateTaskInline', payload);
    }, 500);
    return;
  }

  if (field === 'ngayLamXong') {
    task['Ngày làm xong'] = value;
    payload.ngayLamXong = value;

    if (value) {
      task['Tiến độ (%)'] = 100;
      const endDate = task['Ngày kết thúc'] || task['Hạn hoàn thành'] || '';
      if (endDate && value > endDate) {
        task['Trạng thái'] = 'Hoàn thành quá hạn';
      } else {
        task['Trạng thái'] = 'Hoàn thành';
      }
    } else {
      const kh = Number(task['Kế hoạch'] || 1);
      const th = Number(task['Thực hiện'] || 0);
      task['Tiến độ (%)'] = kh > 0 ? Math.min(100, Math.round((th / kh) * 100)) : 0;
      const endDate = task['Ngày kết thúc'] || task['Hạn hoàn thành'] || '';
      const todayStr = new Date().toISOString().split('T')[0];
      if (endDate && todayStr > endDate && task['Tiến độ (%)'] < 100) {
        task['Trạng thái'] = 'Quá hạn';
      } else {
        task['Trạng thái'] = 'Đang thực hiện';
      }
    }

    payload.progress = task['Tiến độ (%)'];
    payload.status = task['Trạng thái'];

    try { localStorage.setItem('TTHT_TASKS_CACHE', JSON.stringify(appState.tasks)); } catch(e) {}

    if (element) {
      const tr = element.closest('tr');
      if (tr) {
        const progressCell = tr.querySelector('.progress-col-cell');
        if (progressCell) {
          progressCell.innerHTML = `
            <div style="display:flex; align-items:center; gap:6px; justify-content:center;">
              <div style="width:45px; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
                <div style="width:${task['Tiến độ (%)']}%; height:100%; background:var(--emerald-primary);"></div>
              </div>
              <span style="font-size:0.75rem; color:#94a3b8;">${task['Tiến độ (%)']}%</span>
            </div>
          `;
        }
        const statusCell = tr.querySelector('.status-col-cell');
        if (statusCell) {
          const st = task['Trạng thái'];
          if (st === 'Hoàn thành quá hạn') {
            statusCell.innerHTML = `<span style="color:#f59e0b; font-weight:600; background:rgba(245, 158, 11, 0.15); padding:2px 8px; border-radius:12px; font-size:0.75rem;">Hoàn thành quá hạn</span>`;
          } else if (st === 'Hoàn thành') {
            statusCell.innerHTML = `<span style="color:#10b981; font-weight:600;">Hoàn thành</span>`;
          } else if (st === 'Quá hạn') {
            statusCell.innerHTML = `<span class="tag-status-overdue">Quá hạn</span>`;
          } else {
            statusCell.innerHTML = `<span style="color:#38bdf8; font-weight:600;">${st}</span>`;
          }
        }
      }
    }
  }

  if (field === 'thucHien') {
    const numVal = Number(value);
    task['Thực hiện'] = numVal;
    payload.thucHien = numVal;

    const kh = task['Kế hoạch'] !== undefined && task['Kế hoạch'] !== '' ? Number(task['Kế hoạch']) : 1;
    const pct = kh > 0 ? Math.round((numVal / kh) * 100) : 0;
    task['Tỷ lệ'] = pct + '%';
    
    if (!task['Ngày làm xong']) {
      task['Tiến độ (%)'] = Math.min(100, pct);
      payload.progress = task['Tiến độ (%)'];
    }

    try { localStorage.setItem('TTHT_TASKS_CACHE', JSON.stringify(appState.tasks)); } catch(e) {}

    if (element) {
      const tr = element.closest('tr');
      if (tr) {
        const tyLeTd = tr.querySelector('.ty-le-col-cell');
        if (tyLeTd) {
          tyLeTd.innerHTML = `<strong style="color:var(--emerald-primary);">${task['Tỷ lệ']}</strong>`;
        }
        const progressCell = tr.querySelector('.progress-col-cell');
        if (progressCell) {
          progressCell.innerHTML = `
            <div style="display:flex; align-items:center; gap:6px; justify-content:center;">
              <div style="width:45px; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
                <div style="width:${task['Tiến độ (%)']}%; height:100%; background:var(--emerald-primary);"></div>
              </div>
              <span style="font-size:0.75rem; color:#94a3b8;">${task['Tiến độ (%)']}%</span>
            </div>
          `;
        }
      }
    }
  }

  callBackendSilent('updateTaskInline', payload);
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
  
  renderTaskListTable();
}

function renderGanttChart() {
  const container = document.getElementById('gantt-chart-container');
  if (!container) return;
  const filtered = getFilteredTasks();
  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">Không có dữ liệu công việc</div>`;
    return;
  }
  const months = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  const curM = new Date().getMonth();
  const displayMonths = months.slice(curM, curM + 4);
  
  let html = `
    <div style="display:flex; background:#141b2d; border-bottom:1px solid var(--card-border); padding:10px 16px; font-weight:600;">
      <div style="width:240px;">Tên Công Việc</div>
      <div style="flex:1; display:flex; justify-content:space-around;">
        ${displayMonths.map(m => `<div>${m}</div>`).join('')}
      </div>
    </div>
    <div style="padding:16px;">
  `;

  filtered.forEach(t => {
    const progress = Number(t['Tiến độ (%)'] || 0);
    html += `
      <div style="display:flex; align-items:center; height:44px; border-bottom:1px dashed rgba(255,255,255,0.06);">
        <div style="width:240px; font-size:0.85rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(t['Tiêu đề'])}</div>
        <div style="flex:1; position:relative; height:100%;">
          <div style="position:absolute; left:20%; width:50%; top:8px; height:26px; background:var(--emerald-primary); color:#0b0f19; font-weight:700; font-size:0.75rem; border-radius:13px; display:flex; align-items:center; padding:0 12px; cursor:pointer;" onclick="openTaskModal('${t.ID || t.id}')">
            ${escapeHtml(t['Tiêu đề'])} (${progress}%)
          </div>
        </div>
      </div>
    `;
  });
  
  html += `</div>`;
  container.innerHTML = html;
}

function renderCvLuuYTable() {
  const tbody = document.getElementById('cvluuy-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const search = (document.getElementById('cvluuy-search-input')?.value || '').toLowerCase();
  const group = document.getElementById('cvluuy-group-select')?.value || '';

  const filtered = appState.cvluuy.filter(item => {
    const task = (item['Công việc'] || '').toLowerCase();
    const desc = (item['Mô tả'] || '').toLowerCase();
    if (search && !task.includes(search) && !desc.includes(search)) return false;
    if (group && item['Tổ'] !== group) return false;
    return true;
  });

  filtered.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-title-cell"><strong>${escapeHtml(item['Công việc'] || '')}</strong></td>
      <td class="col-desc-cell">${escapeHtml(item['Mô tả'] || '')}</td>
      <td><span class="tag-org">${escapeHtml(item['Tổ'] || 'Chung')}</span></td>
      <td>${formatDateVN(item['Ngày bắt đầu'])}</td>
      <td>${formatDateVN(item['Ngày kết thúc'])}</td>
      <td><input type="date" class="inline-date-picker" value="${item['Ngày làm xong'] || ''}"></td>
      <td><span class="tag-priority tag-p-low">${item['Trạng thái'] || 'Cần lưu ý'}</span></td>
      <td class="col-note-cell">
        <textarea class="inline-note-textarea" placeholder="Nhập ghi chú..." oninput="autoResizeTextarea(this); handleInlineTaskChange('${item.ID || item.id}', 'cvluuy_ghiChu', this.value, this)" onchange="handleInlineTaskChange('${item.ID || item.id}', 'cvluuy_ghiChu', this.value, this)">${escapeHtml(item['Ghi chú'] || '')}</textarea>
      </td>
      <td style="text-align:right;">
        <div style="display:flex; gap:6px; justify-content:flex-end;">
          <button class="btn-action-edit" onclick="openCvLuuYModal('${item.ID || item.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-action-delete" onclick="confirmDeleteCvLuuY('${item.ID || item.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  setTimeout(() => {
    document.querySelectorAll('.inline-note-textarea').forEach(autoResizeTextarea);
  }, 50);
}

function renderDocumentsTable() {
  const tbody = document.getElementById('documents-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  appState.documents.forEach(doc => {
    const valHD = Number(doc['Giá trị HĐ'] || 0).toLocaleString('vi-VN');
    const valTH = Number(doc['Giá trị thực hiện'] || 0).toLocaleString('vi-VN');
    const diffVal = Number(doc['Chênh lệch'] || 0).toLocaleString('vi-VN');
    const fileBtn = doc['File URL'] ? `<a href="${doc['File URL']}" target="_blank" class="btn-dark-sec btn-sm"><i class="fa-solid fa-file-pdf"></i> Tệp</a>` : 'N/A';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(doc['Số hồ sơ'] || '')}</strong></td>
      <td class="col-title-cell"><strong>${escapeHtml(doc['Tên hồ sơ'] || '')}</strong></td>
      <td>${escapeHtml(doc['Danh mục'] || '')}</td>
      <td>${escapeHtml(doc['Phòng ban'] || '')}</td>
      <td>${escapeHtml(doc['Nhà cung cấp'] || '')}</td>
      <td><span class="tag-priority tag-p-low">${doc['Tình trạng'] || 'Hiệu lực'}</span></td>
      <td>${valHD} đ</td>
      <td>${valTH} đ</td>
      <td>${diffVal} đ</td>
      <td>${fileBtn}</td>
      <td style="text-align:right;">
        <div style="display:flex; gap:6px; justify-content:flex-end;">
          <button class="btn-action-edit" onclick="openDocumentModal('${doc.ID || doc.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-action-delete" onclick="confirmDeleteDoc('${doc.ID || doc.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderUsersTable() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  appState.users.forEach(usr => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${usr.ID || usr.id}</strong></td>
      <td><strong>${escapeHtml(usr['Tên'] || '')}</strong></td>
      <td>${escapeHtml(usr['Tổ'] || '')}</td>
      <td style="text-align:right;">
        <div style="display:flex; gap:6px; justify-content:flex-end;">
          <button class="btn-action-edit" onclick="openUserModal('${usr.ID || usr.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-action-delete" onclick="confirmDeleteUser('${usr.ID || usr.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderOrgStatistics() {
  const container = document.getElementById('stats-org-container');
  if (!container) return;
  
  const orgMap = {};
  appState.users.forEach(u => {
    const org = u['Tổ'] || 'Chưa phân tổ';
    if (!orgMap[org]) orgMap[org] = { total: 0, done: 0 };
  });

  appState.tasks.forEach(t => {
    const assignee = getTaskAssignee(t);
    const usr = appState.users.find(u => u['Tên'] === assignee);
    const org = usr ? (usr['Tổ'] || 'Khác') : 'Khác';
    if (!orgMap[org]) orgMap[org] = { total: 0, done: 0 };
    orgMap[org].total++;
    const st = t['Trạng thái'];
    if (st === 'Hoàn thành' || st === 'Hoàn thành quá hạn') orgMap[org].done++;
  });

  let html = `<div style="display:flex; flex-direction:column; gap:16px;">`;
  Object.keys(orgMap).forEach(org => {
    const data = orgMap[org];
    const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
    html += `
      <div>
        <div style="display:flex; justify-content:space-between; font-size:0.88rem; margin-bottom:6px;">
          <span><strong>${org}</strong> (${data.done}/${data.total} hoàn thành)</span>
          <span>${pct}%</span>
        </div>
        <div style="height:8px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden;">
          <div style="height:100%; width:${pct}%; background:var(--emerald-primary);"></div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

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
      document.getElementById('task-kehoach-input').value = task['Kế hoạch'] !== undefined ? task['Kế hoạch'] : 1;
      document.getElementById('task-thuchien-input').value = task['Thực hiện'] !== undefined ? task['Thực hiện'] : 0;
      document.getElementById('task-chutri-input').value = getTaskAssignee(task);
      document.getElementById('task-phoihop-input').value = getTaskCollaborator(task);
      document.getElementById('task-progress-input').value = task['Tiến độ (%)'] || 0;
      document.getElementById('progress-val-display').innerText = task['Tiến độ (%)'] || 0;
      document.getElementById('task-ghichu-input').value = task['Ghi chú'] || '';
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
  div.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:8px;';
  div.innerHTML = `
    <input type="checkbox" ${completed ? 'checked' : ''} onchange="recalculateSubtasksProgress()">
    <input type="text" class="dark-form-control" value="${escapeHtml(title)}" placeholder="Tên việc con..." oninput="recalculateSubtasksProgress()">
    <button type="button" class="btn-dark-sec btn-sm" style="color:#ef4444;" onclick="this.parentElement.remove(); recalculateSubtasksProgress();">&times;</button>
  `;
  container.appendChild(div);
}

function recalculateSubtasksProgress() {
  const items = document.querySelectorAll('#subtasks-container div');
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
  document.querySelectorAll('#subtasks-container div').forEach((item, idx) => {
    const title = item.querySelector('input[type="text"]').value.trim();
    const completed = item.querySelector('input[type="checkbox"]').checked;
    if (title) subtasks.push({ id: idx + 1, title: title, completed: completed });
  });

  const chuTriName = document.getElementById('task-chutri-input').value;
  const phoiHopName = document.getElementById('task-phoihop-input').value;

  const chuTriUser = appState.users.find(u => (u['Tên'] || u.name) === chuTriName);
  const phoiHopUser = appState.users.find(u => (u['Tên'] || u.name) === phoiHopName);

  const payload = {
    id: document.getElementById('task-id').value,
    'Tiêu đề': document.getElementById('task-title-input').value,
    'Mô tả': document.getElementById('task-desc-input').value,
    'Mức độ ưu tiên': document.getElementById('task-priority-input').value,
    'Trạng thái': document.getElementById('task-status-input').value,
    'Ngày bắt đầu': document.getElementById('task-start-input').value,
    'Ngày kết thúc': document.getElementById('task-end-input').value,
    'Kế hoạch': Number(document.getElementById('task-kehoach-input').value),
    'Thực hiện': Number(document.getElementById('task-thuchien-input').value),
    'Người chủ trì': chuTriName,
    'Tổ chủ trì': chuTriUser ? (chuTriUser['Tổ'] || chuTriUser.group) : '',
    'Người phối hợp': phoiHopName,
    'Tổ phối hợp': phoiHopUser ? (phoiHopUser['Tổ'] || phoiHopUser.group) : '',
    'Người thực hiện': chuTriName,
    'Người phụ trách': chuTriName,
    'Tiến độ (%)': Number(document.getElementById('task-progress-input').value),
    'Ghi chú': document.getElementById('task-ghichu-input').value,
    'Tệp đính kèm': document.getElementById('task-attachment-input').value,
    subtasks: subtasks
  };

  closeModal('modal-task');
  showToast('Đang lưu công việc...', 'info');
  callBackend('saveTask', payload, () => showToast('Đã lưu công việc!', 'success'));
}

function confirmDeleteTask(id) {
  if (confirm('Bạn có chắc chắn muốn xóa công việc này?')) {
    callBackend('deleteTask', { id: id }, () => showToast('Đã xóa công việc!', 'success'));
  }
}

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
  callBackend('saveCvLuuY', payload, () => showToast('Đã lưu lưu ý!', 'success'));
}

function confirmDeleteCvLuuY(id) {
  if (confirm('Xóa mục này?')) {
    callBackend('deleteCvLuuY', { id: id }, () => showToast('Đã xóa lưu ý!', 'success'));
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
  callBackend('saveDocument', payload, () => showToast('Đã lưu hồ sơ!', 'success'));
}

function confirmDeleteDoc(id) {
  if (confirm('Xóa hồ sơ này?')) {
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
  if (confirm('Xóa người dùng này?')) {
    callBackend('deleteUser', { id: id }, () => showToast('Đã xóa người dùng!', 'success'));
  }
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function openSettingsModal() { openModal('modal-settings'); }

function saveSettings() {
  const url = document.getElementById('gas-api-url-input').value.trim();
  localStorage.setItem('GAS_WEB_APP_URL', url);
  appState.apiUrl = url;
  closeModal('modal-settings');
  showToast('Đã lưu cấu hình API thành công!', 'success');
  appState.loadData(true);
}

function formatDateVN(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#0284c7';
  
  toast.style.cssText = `
    background: ${bg};
    color: #ffffff;
    padding: 10px 18px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    font-size: 0.85rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
  `;
  
  const icon = type === 'success' ? 'circle-check' : type === 'error' ? 'circle-exclamation' : 'circle-info';
  toast.innerHTML = `<i class="fa-solid fa-circle-${icon}"></i> ${escapeHtml(message)}`;
  
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
