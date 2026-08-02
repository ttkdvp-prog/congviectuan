/**
 * ==============================================================================
 * TTHT Tasks - Quản Lý Công Việc & Hồ Sơ (Vanilla JS Engine - Dark Theme)
 * ==============================================================================
 */

const appState = {
  tasks: [],
  users: [],
  tovien: [],
  totruonggiaoviec: [],
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

const cleanKeyCache = new Map();
function cleanKey(str) {
  if (!str) return '';
  const sStr = String(str);
  let cached = cleanKeyCache.get(sStr);
  if (cached !== undefined) return cached;
  cached = sStr
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  if (cleanKeyCache.size > 3000) cleanKeyCache.clear();
  cleanKeyCache.set(sStr, cached);
  return cached;
}

function clearTaskCaches() {
  cleanKeyCache.clear();
  if (appState.tasks && Array.isArray(appState.tasks)) {
    appState.tasks.forEach(t => {
      delete t._cachedAssignee;
      delete t._cachedCollab;
      delete t._cachedGroup;
      delete t._cachedCollabGroup;
    });
  }
  if (appState.totruonggiaoviec && Array.isArray(appState.totruonggiaoviec)) {
    appState.totruonggiaoviec.forEach(t => {
      delete t._cachedAssignee;
      delete t._cachedCollab;
      delete t._cachedGroup;
      delete t._cachedCollabGroup;
    });
  }
  if (appState.users && Array.isArray(appState.users)) {
    appState.users.forEach(u => delete u._cachedInfo);
  }
  if (appState.tovien && Array.isArray(appState.tovien)) {
    appState.tovien.forEach(r => delete r._cachedInfo);
  }
}

function getTaskAssignee(task) {
  if (!task) return 'Chưa gán';
  if (task._cachedAssignee !== undefined) return task._cachedAssignee;
  let res = 'Chưa gán';
  for (let k in task) {
    if (k.startsWith('_')) continue;
    const ck = cleanKey(k);
    if (ck === 'nguoichutri' || ck === 'nguoiphutrach' || ck === 'nguoithuchien' || ck === 'assignee') {
      if (task[k] !== undefined && task[k] !== null && String(task[k]).trim() !== '') {
        res = String(task[k]).trim();
        break;
      }
    }
  }
  if (res === 'Chưa gán') {
    for (let k in task) {
      if (k.startsWith('_')) continue;
      const ck = cleanKey(k);
      if (ck.includes('chutri') || ck.includes('phutrach') || ck.includes('thuchien')) {
        if (task[k] !== undefined && task[k] !== null && String(task[k]).trim() !== '') {
          res = String(task[k]).trim();
          break;
        }
      }
    }
  }
  task._cachedAssignee = res;
  return res;
}

function getTaskCollaborator(task) {
  if (!task) return '';
  if (task._cachedCollab !== undefined) return task._cachedCollab;
  let res = '';
  for (let k in task) {
    if (k.startsWith('_')) continue;
    const ck = cleanKey(k);
    if (ck === 'nguoiphoihop') {
      if (task[k] !== undefined && task[k] !== null && String(task[k]).trim() !== '') {
        res = String(task[k]).trim();
        break;
      }
    }
  }
  if (!res) {
    for (let k in task) {
      if (k.startsWith('_')) continue;
      const ck = cleanKey(k);
      if (ck.includes('phoihop') && !ck.includes('to')) {
        if (task[k] !== undefined && task[k] !== null && String(task[k]).trim() !== '') {
          res = String(task[k]).trim();
          break;
        }
      }
    }
  }
  task._cachedCollab = res;
  return res;
}

function formatUniqueGroups(groupStr) {
  if (!groupStr) return '';
  const parts = String(groupStr).split(',').map(p => p.trim()).filter(Boolean);
  const unique = Array.from(new Set(parts));
  return unique.join(', ');
}

function getTaskGroup(task) {
  if (!task) return '';
  if (task._cachedGroup !== undefined) return task._cachedGroup;
  
  let rawGroup = '';
  for (let k in task) {
    if (k.startsWith('_')) continue;
    const ck = cleanKey(k);
    if (ck === 'tochutri' || ck === 'tochutriar' || ck === 'to' || ck === 'tentocutri' || ck === 'tengroup') {
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
        const cleanN = cleanKey(name);
        if (appState.users && Array.isArray(appState.users)) {
          appState.users.forEach(u => {
            const { name: uName, group: uGrp } = getUserNameAndGroup(u);
            if (uName && uGrp && cleanKey(uName) === cleanN) {
              groups.add(uGrp);
            }
          });
        }
      });
      if (groups.size > 0) rawGroup = Array.from(groups).join(', ');
    }
  }

  if (!rawGroup) {
    for (let k in task) {
      if (k.startsWith('_')) continue;
      const ck = cleanKey(k);
      if (ck.includes('chutri') && ck.includes('to')) {
        if (task[k] && String(task[k]).trim()) {
          rawGroup = String(task[k]).trim();
          break;
        }
      }
    }
  }

  const res = formatUniqueGroups(rawGroup);
  task._cachedGroup = res;
  return res;
}

function getTaskCollaboratorGroup(task) {
  if (!task) return '';
  if (task._cachedCollabGroup !== undefined) return task._cachedCollabGroup;
  let res = '';
  for (let k in task) {
    if (k.startsWith('_')) continue;
    const ck = cleanKey(k);
    if (ck === 'tophoihop') {
      if (task[k] !== undefined && task[k] !== null && String(task[k]).trim() !== '') {
        res = String(task[k]).trim();
        break;
      }
    }
  }
  if (!res) {
    for (let k in task) {
      if (k.startsWith('_')) continue;
      const ck = cleanKey(k);
      if (ck.includes('phoihop') && ck.includes('to')) {
        if (task[k] && String(task[k]).trim()) {
          res = String(task[k]).trim();
          break;
        }
      }
    }
  }
  task._cachedCollabGroup = res;
  return res;
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
  const gSelect = document.getElementById('global-group-select');
  const cgSelect = document.getElementById('global-collab-group-select');
  const lSelect = document.getElementById('global-leader-select');
  const uSelect = document.getElementById('global-user-select');
  const cuSelect = document.getElementById('global-collab-user-select');

  if (sInput) sInput.addEventListener('input', handleGlobalFilterDebounced);
  if (gSelect) gSelect.addEventListener('change', onGlobalGroupChange);
  if (cgSelect) cgSelect.addEventListener('change', onGlobalGroupChange);
  if (lSelect) lSelect.addEventListener('change', handleGlobalFilter);
  if (uSelect) uSelect.addEventListener('change', handleGlobalFilter);
  if (cuSelect) cuSelect.addEventListener('change', handleGlobalFilter);

  // Restore local cache for zero-latency initial view on F5 across all devices
  const cachedTasks = localStorage.getItem('TTHT_TASKS_CACHE');
  const cachedUsers = localStorage.getItem('TTHT_USERS_CACHE');
  const cachedTovien = localStorage.getItem('TTHT_TOVIEN_CACHE');
  const cachedToTruong = localStorage.getItem('TTHT_TOTRUONGGIAOVIEC_CACHE');
  const cachedCvLuuY = localStorage.getItem('TTHT_CVLUUY_CACHE');
  const cachedDocs = localStorage.getItem('TTHT_DOCUMENTS_CACHE');

  if (cachedTasks) { try { appState.tasks = JSON.parse(cachedTasks); } catch(e) {} }
  if (cachedUsers) { try { appState.users = JSON.parse(cachedUsers); } catch(e) {} }
  if (cachedTovien) { try { appState.tovien = JSON.parse(cachedTovien); } catch(e) {} }
  if (cachedToTruong) { try { appState.totruonggiaoviec = JSON.parse(cachedToTruong); } catch(e) {} }
  if (cachedCvLuuY) { try { appState.cvluuy = JSON.parse(cachedCvLuuY); } catch(e) {} }
  if (cachedDocs) { try { appState.documents = JSON.parse(cachedDocs); } catch(e) {} }

  populateSelects();
  renderActiveTab();

  // Background silent sync with backend if available
  appState.loadData();
  setupKanbanDragAndDrop();

  // === AUTO-SYNC: Refresh data from Google Sheets every 60 seconds ===
  setInterval(function() {
    console.log('[AutoSync] Refreshing data from Google Sheets...');
    appState.loadData(false, false);
  }, 60000);
});

appState.loadData = function (forceRefresh = false, showNotification = false) {
  if (appState.isGAS) {
    google.script.run
      .withSuccessHandler(data => onDataLoaded(data, showNotification))
      .withFailureHandler(err => console.warn('Background GAS sync failed, using local cache:', err))
      .getInitialData(forceRefresh);
  } else {
    const fetchUrl = appState.apiUrl;
    if (!fetchUrl) {
      console.log('Running in local offline mode (no apiUrl configured).');
      return;
    }
    fetch(fetchUrl + '?action=getInitialData&t=' + new Date().getTime())
      .then(res => res.json())
      .then(data => onDataLoaded(data, showNotification))
      .catch(err => console.warn('Background fetch failed, using local cache:', err));
  }
};

function callBackend(action, payload, successCallback) {
  if (appState.isGAS) {
    google.script.run
      .withSuccessHandler(res => {
        if (successCallback) successCallback(res);
      })
      .withFailureHandler(err => {
        console.warn('GAS backend call failed, using local cache:', action, err);
        if (successCallback) successCallback({ success: true, localOnly: true });
      })[action](payload);
  } else {
    const fetchUrl = appState.apiUrl;
    if (!fetchUrl) {
      console.warn('No apiUrl set for standalone backend call:', action);
      if (successCallback) successCallback({ success: true, localOnly: true });
      return;
    }
    fetch(fetchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: action, payload: payload })
    })
      .then(res => res.json())
      .then(res => {
        if (successCallback) successCallback(res);
      })
      .catch(err => {
        console.warn('Backend fetch failed, using local cache:', action, err);
        if (successCallback) successCallback({ success: true, localOnly: true });
      });
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
    const fetchUrl = appState.apiUrl;
    if (!fetchUrl) return;
    fetch(fetchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: action, payload: payload })
    }).catch(err => console.error('Silent sync error:', err));
  }
}

function onDataLoaded(response, showNotification = false) {
  console.log('[onDataLoaded] Response keys:', response ? Object.keys(response) : 'null');
  console.log('[onDataLoaded] totruonggiaoviec in response:', response?.totruonggiaoviec ? response.totruonggiaoviec.length + ' records' : 'MISSING');
  if (response && response.success) {
    clearTaskCaches();
    // Accept data from server even if empty (supports deletions on Google Sheets)
    if (Array.isArray(response.tasks)) appState.tasks = response.tasks;
    if (Array.isArray(response.users)) appState.users = response.users;
    if (Array.isArray(response.tovien)) appState.tovien = response.tovien;
    if (Array.isArray(response.totruonggiaoviec)) {
      appState.totruonggiaoviec = response.totruonggiaoviec;
      console.log('[onDataLoaded] totruonggiaoviec loaded:', response.totruonggiaoviec.length, 'records');
      if (response.totruonggiaoviec[0]) {
        console.log('[onDataLoaded] totruonggiaoviec KEYS:', JSON.stringify(Object.keys(response.totruonggiaoviec[0])));
      }
    } else {
      console.warn('[onDataLoaded] totruonggiaoviec MISSING from main response. Triggering backup load...');
      loadToTruongBackup();
    }
    if (Array.isArray(response.cvluuy)) appState.cvluuy = response.cvluuy;
    if (Array.isArray(response.documents)) appState.documents = response.documents;
    
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
      localStorage.setItem('TTHT_TOVIEN_CACHE', JSON.stringify(appState.tovien));
      localStorage.setItem('TTHT_TOTRUONGGIAOVIEC_CACHE', JSON.stringify(appState.totruonggiaoviec));
      localStorage.setItem('TTHT_CVLUUY_CACHE', JSON.stringify(appState.cvluuy));
      localStorage.setItem('TTHT_DOCUMENTS_CACHE', JSON.stringify(appState.documents));
    } catch(e) {}

    populateSelects();
    renderActiveTab();
    if (showNotification) {
      showToast('Đồng bộ dữ liệu thành công!', 'success');
    }
  }
}

// Backup function: independently load totruonggiaoviec data
function loadToTruongBackup() {
  console.log('[loadToTruongBackup] Attempting independent load of totruonggiaoviec...');
  
  if (appState.isGAS) {
    // Try dedicated function first
    try {
      google.script.run
        .withSuccessHandler(function(res) {
          if (res && res.success && res.data && res.data.length > 0) {
            appState.totruonggiaoviec = res.data;
            console.log('[loadToTruongBackup] SUCCESS via getToTruongSheetData:', res.data.length, 'records');
            if (res.data[0]) console.log('[loadToTruongBackup] KEYS:', JSON.stringify(Object.keys(res.data[0])));
            try { localStorage.setItem('TTHT_TOTRUONGGIAOVIEC_CACHE', JSON.stringify(res.data)); } catch(e) {}
            renderActiveTab();
          } else {
            console.warn('[loadToTruongBackup] getToTruongSheetData returned empty/failed:', JSON.stringify(res));
          }
        })
        .withFailureHandler(function(err) {
          console.warn('[loadToTruongBackup] getToTruongSheetData failed (function may not exist in deployed Code.gs):', err);
        })
        .getToTruongSheetData();
    } catch(e) {
      console.warn('[loadToTruongBackup] Error calling getToTruongSheetData:', e);
    }
  } else {
    const fetchUrl = appState.apiUrl;
    if (fetchUrl) {
      const getUrl = fetchUrl + '?action=getToTruongSheetData&t=' + new Date().getTime();
      console.log('[loadToTruongBackup] Fetching via GET:', getUrl);
      fetch(getUrl)
        .then(res => {
          console.log('[loadToTruongBackup] Response status:', res.status);
          return res.json();
        })
        .then(res => {
          console.log('[loadToTruongBackup] Response data:', JSON.stringify(res).substring(0, 500));
          if (res && res.success && res.data && res.data.length > 0) {
            appState.totruonggiaoviec = res.data;
            appState._toTruongBackupTriggered = false; // Reset so it can try again if needed
            console.log('[loadToTruongBackup] SUCCESS via GET:', res.data.length, 'records');
            if (res.data[0]) console.log('[loadToTruongBackup] KEYS:', JSON.stringify(Object.keys(res.data[0])));
            try { localStorage.setItem('TTHT_TOTRUONGGIAOVIEC_CACHE', JSON.stringify(res.data)); } catch(e) {}
            renderActiveTab();
          } else {
            console.warn('[loadToTruongBackup] Response empty/failed:', JSON.stringify(res));
            // Update debug banner with error details
            const banner = document.getElementById('totruong-debug-banner');
            if (banner) {
              const sheetInfo = res.sheetNames ? '📋 Sheets: ' + res.sheetNames.join(', ') : '';
              const sheetNameUsed = res.sheetName ? '📄 Found: "' + res.sheetName + '"' : '❌ Sheet NOT FOUND';
              const errMsg = res.error || 'data rỗng';
              banner.innerHTML = `⚠️ ${sheetNameUsed}. ${errMsg}. ${sheetInfo}. <button onclick="appState._toTruongBackupTriggered=false; loadToTruongBackup(); this.textContent='Đang tải...'" style="background:#ef4444;color:white;border:none;padding:2px 10px;border-radius:4px;cursor:pointer;margin-left:8px;">Thử lại</button>`;
            }
          }
        })
        .catch(err => {
          console.warn('[loadToTruongBackup] Fetch FAILED:', err);
          const banner = document.getElementById('totruong-debug-banner');
          if (banner) {
            banner.innerHTML = `⚠️ Lỗi kết nối: ${err.message || err}. URL: ${fetchUrl ? 'CÓ' : 'KHÔNG'}. <button onclick="appState._toTruongBackupTriggered=false; loadToTruongBackup(); this.textContent='Đang tải...'" style="background:#ef4444;color:white;border:none;padding:2px 10px;border-radius:4px;cursor:pointer;margin-left:8px;">Thử lại</button>`;
          }
        });
    } else {
      console.warn('[loadToTruongBackup] No apiUrl configured!');
    }
  }
}

function onDataError(error) {
  console.warn('API Warning:', error);
}

function getUserNameAndGroup(u) {
  if (!u || typeof u !== 'object') return { name: '', group: '' };
  if (u._cachedInfo) return u._cachedInfo;

  let name = '';
  let group = '';

  for (let k in u) {
    if (k.startsWith('_')) continue;
    const ck = cleanKey(k);
    if (ck === 'ten' || ck === 'tennhanvien' || ck === 'hovaten' || ck === 'tennguoidung' || ck === 'name' || ck === 'nguoithuchien') {
      if (u[k] && String(u[k]).trim()) {
        name = String(u[k]).trim();
        break;
      }
    }
  }
  if (!name) {
    for (let k in u) {
      if (k.startsWith('_')) continue;
      const ck = cleanKey(k);
      if ((ck.includes('ten') || ck.includes('user')) && !ck.includes('to') && !ck.includes('file')) {
        if (u[k] && String(u[k]).trim()) {
          name = String(u[k]).trim();
          break;
        }
      }
    }
  }

  for (let k in u) {
    if (k.startsWith('_')) continue;
    const ck = cleanKey(k);
    if (ck === 'to' || ck === 'tochutri' || ck === 'tento' || ck === 'group' || ck === 'nhom' || ck === 'donvi') {
      if (u[k] && String(u[k]).trim()) {
        group = String(u[k]).trim();
        break;
      }
    }
  }
  if (!group) {
    for (let k in u) {
      if (k.startsWith('_')) continue;
      const ck = cleanKey(k);
      if ((ck.includes('to') || ck.includes('group') || ck.includes('donvi')) && !ck.includes('tiendo') && !ck.includes('taptin') && !ck.includes('tep')) {
        if (u[k] && String(u[k]).trim() && isNaN(u[k])) {
          group = String(u[k]).trim();
          break;
        }
      }
    }
  }

  const res = { name, group };
  u._cachedInfo = res;
  return res;
}

function populateSelects() {
  const groupSelect = document.getElementById('global-group-select');
  const cvluuyGroupSelect = document.getElementById('cvluuy-group-select');
  const kanbanAssigneeSelect = document.getElementById('kanban-assignee-filter');
  const taskToChuTriSelect = document.getElementById('task-tochutri-input');
  const taskChuTriSelect = document.getElementById('task-chutri-input');
  const taskPhoiHopSelect = document.getElementById('task-phoihop-input');
  
  const hostGroups = new Set();
  const allGroups = new Set();
  const assignees = new Set();
  
  if (appState.users && Array.isArray(appState.users)) {
    appState.users.forEach(u => {
      const { name, group } = getUserNameAndGroup(u);
      if (group) {
        hostGroups.add(group);
        allGroups.add(group);
      }
      if (name) assignees.add(name);
    });
  }

  if (appState.tasks && Array.isArray(appState.tasks)) {
    appState.tasks.forEach(t => {
      const a = getTaskAssignee(t);
      const c = getTaskCollaborator(t);
      const tg = getTaskGroup(t);
      const tcg = getTaskCollaboratorGroup(t);
      
      if (a && a !== 'Chưa gán') {
        a.split(',').forEach(n => { if (n.trim()) assignees.add(n.trim()); });
      }
      if (c && String(c).trim()) {
        c.split(',').forEach(n => { if (n.trim()) assignees.add(n.trim()); });
      }
      if (tg && String(tg).trim()) {
        hostGroups.add(tg);
        allGroups.add(tg);
      }
      if (tcg && String(tcg).trim()) allGroups.add(tcg);
    });
  }

  if (appState.tovien && Array.isArray(appState.tovien)) {
    let lastGroup = '';
    appState.tovien.forEach(row => {
      const info = getTovienRowInfo(row);
      if (info.group) lastGroup = info.group;
      if (lastGroup) {
        hostGroups.add(lastGroup);
        allGroups.add(lastGroup);
      }
    });
  }

  if (appState.totruonggiaoviec && Array.isArray(appState.totruonggiaoviec)) {
    appState.totruonggiaoviec.forEach(t => {
      const tg = getToTruongTaskGroup(t);
      if (tg) {
        hostGroups.add(tg);
        allGroups.add(tg);
      }
    });
  }

  if (appState.cvluuy && Array.isArray(appState.cvluuy)) {
    appState.cvluuy.forEach(item => {
      for (let k in item) {
        const ck = cleanKey(k);
        if (ck.includes('to') && item[k] && typeof item[k] === 'string' && item[k].trim()) {
          allGroups.add(item[k].trim());
        }
      }
    });
  }

  if (groupSelect) {
    const curVal = groupSelect.value;
    const opts = ['<option value="">Tất cả Tổ chủ trì (AR)</option>'];
    Array.from(hostGroups).sort().forEach(g => {
      if (g) opts.push(`<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`);
    });
    groupSelect.innerHTML = opts.join('');
    if (curVal) groupSelect.value = curVal;
  }

  const collabGroupSelect = document.getElementById('global-collab-group-select');
  if (collabGroupSelect) {
    const curVal = collabGroupSelect.value;
    const collabGroups = new Set();
    if (appState.tasks && Array.isArray(appState.tasks)) {
      appState.tasks.forEach(t => {
        const tcg = getTaskCollaboratorGroup(t) || t['Tổ (R)'] || '';
        if (tcg && String(tcg).trim()) collabGroups.add(String(tcg).trim());
      });
    }
    const opts = ['<option value="">Tất cả Tổ (R)</option>'];
    Array.from(collabGroups).sort().forEach(g => {
      if (g) opts.push(`<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`);
    });
    collabGroupSelect.innerHTML = opts.join('');
    if (curVal) collabGroupSelect.value = curVal;
  }

  if (cvluuyGroupSelect) {
    const curVal = cvluuyGroupSelect.value;
    const opts = ['<option value="">Tất cả tổ</option>'];
    Array.from(allGroups).sort().forEach(g => {
      if (g) opts.push(`<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`);
    });
    cvluuyGroupSelect.innerHTML = opts.join('');
    if (curVal) cvluuyGroupSelect.value = curVal;
  }

  if (kanbanAssigneeSelect) {
    const curVal = kanbanAssigneeSelect.value;
    const opts = ['<option value="">Tất cả người phụ trách</option>'];
    Array.from(assignees).sort().forEach(a => {
      if (a) opts.push(`<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`);
    });
    kanbanAssigneeSelect.innerHTML = opts.join('');
    if (curVal) kanbanAssigneeSelect.value = curVal;
  }

  if (taskToChuTriSelect) {
    const curVal = taskToChuTriSelect.value;
    // Collect ALL groups from all sources for the modal dropdown
    const modalGroups = new Set(hostGroups);
    // Add groups from tovien (employee directory)
    if (appState.tovien && Array.isArray(appState.tovien)) {
      let lastGroup = '';
      appState.tovien.forEach(row => {
        const info = getTovienRowInfo(row);
        if (info.group) lastGroup = info.group;
        if (lastGroup) modalGroups.add(lastGroup);
      });
    }
    // Add groups from totruonggiaoviec data
    if (appState.totruonggiaoviec && Array.isArray(appState.totruonggiaoviec)) {
      appState.totruonggiaoviec.forEach(t => {
        const tg = t['Tổ'] || t['Tổ chủ trì'] || '';
        if (tg) modalGroups.add(tg);
      });
    }
    const opts = ['<option value="">-- Tất cả tổ --</option>'];
    Array.from(modalGroups).sort().forEach(g => {
      if (g) opts.push(`<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`);
    });
    taskToChuTriSelect.innerHTML = opts.join('');
    if (curVal) taskToChuTriSelect.value = curVal;
  }

  if (!appState.dropdownData) appState.dropdownData = { chutri: [], phoihop: [] };
  appState.dropdownData.phoihop = Array.from(assignees).sort();
  appState.dropdownData.chutri = Array.from(assignees).sort();

  updateGlobalUserSelectOptions();
}

function isTeamName(name) {
  if (!name) return false;
  const str = String(name).trim();
  const lower = str.toLowerCase();
  if (lower.startsWith('tổ ') || lower.startsWith('tổ_') || lower === 'tổ' || lower.includes('tổ hạ tầng') || lower.includes('tổ tổng hợp') || lower.includes('tổ khách hàng') || lower.includes('tổ kỹ thuật')) {
    return true;
  }
  return false;
}

function handleModalGroupChange(selectedGroup) {
  // Filter locally from appState.tovien & appState.users — INSTANT, no API call
  const filteredUsers = new Set();
  const selGrpClean = cleanKey(selectedGroup);

  if (selGrpClean && appState.tovien && Array.isArray(appState.tovien)) {
    let lastGroup = '';
    appState.tovien.forEach(row => {
      const info = getTovienRowInfo(row);
      if (info.group) lastGroup = info.group;
      else if (lastGroup) info.group = lastGroup;
      
      const ckG = cleanKey(info.group);
      if (ckG && (ckG.includes(selGrpClean) || selGrpClean.includes(ckG))) {
        if (info.empName && !isTeamName(info.empName)) filteredUsers.add(info.empName);
        if (info.leaderName && !isTeamName(info.leaderName)) filteredUsers.add(info.leaderName);
      }
    });
  }

  // Fallback: show all employees if no group or no match
  if (!selGrpClean || filteredUsers.size === 0) {
    if (appState.tovien && Array.isArray(appState.tovien)) {
      appState.tovien.forEach(row => {
        const info = getTovienRowInfo(row);
        if (info.empName && !isTeamName(info.empName)) filteredUsers.add(info.empName);
        if (info.leaderName && !isTeamName(info.leaderName)) filteredUsers.add(info.leaderName);
      });
    }
    if (appState.users && Array.isArray(appState.users)) {
      appState.users.forEach(u => {
        const { name } = getUserNameAndGroup(u);
        if (name && !isTeamName(name) && !isBanLanhDao('', name)) filteredUsers.add(name);
      });
    }
  }

  const sortedUsers = Array.from(filteredUsers).filter(n => !isTeamName(n) && !isBanLanhDao('', n)).sort();

  const leadersList = ['Nguyễn Công Hoan', 'Đỗ Chu Đằng', 'Vũ Thị Lan Phương'];
  if (appState.users && Array.isArray(appState.users)) {
    appState.users.forEach(u => {
      const { name, group } = getUserNameAndGroup(u);
      if (name && isBanLanhDao(group, name)) {
        if (!leadersList.includes(name)) leadersList.push(name);
      }
    });
  }

  if (!appState.dropdownData) appState.dropdownData = { lanhdao: [], leadera: [], chutri: [], phoihop: [] };
  appState.dropdownData.lanhdao = Array.from(new Set(leadersList)).sort();
  appState.dropdownData.leadera = sortedUsers;
  appState.dropdownData.chutri = sortedUsers;
  appState.dropdownData.phoihop = sortedUsers;
}

// Refresh tovien data from Google Sheets in background
// Called once when task modal opens — ensures appState.tovien has latest data
function refreshTovienFromSheet() {
  const now = Date.now();
  // Skip if refreshed less than 10 seconds ago
  if (appState._lastTovienRefresh && (now - appState._lastTovienRefresh) < 10000) return;
  appState._lastTovienRefresh = now;
  
  if (appState.isGAS) {
    try {
      google.script.run
        .withSuccessHandler(function(res) {
          if (res && res.success && res.tovien && res.tovien.length > 0) {
            appState.tovien = res.tovien;
            console.log('[refreshTovien] ✅ Fresh tovien loaded:', res.tovien.length, 'records');
            try { localStorage.setItem('TTHT_TOVIEN_CACHE', JSON.stringify(res.tovien)); } catch(e) {}
            // Re-filter the current group to update dropdown with fresh data
            const toSelect = document.getElementById('task-tochutri-input');
            if (toSelect && toSelect.value) {
              handleModalGroupChange(toSelect.value);
            }
          }
        })
        .withFailureHandler(function(err) {
          console.warn('[refreshTovien] GAS failed:', err);
        })
        .getInitialData(true);
    } catch(e) {
      console.warn('[refreshTovien] Error:', e);
    }
  } else if (appState.apiUrl) {
    const url = appState.apiUrl + '?action=refreshTovien&t=' + now;
    fetch(url)
      .then(res => res.json())
      .then(res => {
        if (res && res.success && res.tovien && res.tovien.length > 0) {
          appState.tovien = res.tovien;
          console.log('[refreshTovien] ✅ Fresh tovien loaded via fetch:', res.tovien.length, 'records');
          try { localStorage.setItem('TTHT_TOVIEN_CACHE', JSON.stringify(res.tovien)); } catch(e) {}
          // Re-filter the current group with fresh data
          const toSelect = document.getElementById('task-tochutri-input');
          if (toSelect && toSelect.value) {
            handleModalGroupChange(toSelect.value);
            // Refresh open dropdowns
            const chuTriDropdown = document.getElementById('dropdown-chutri');
            const phoiHopDropdown = document.getElementById('dropdown-phoihop');
            if (chuTriDropdown) filterCustomDropdown('chutri', document.getElementById('task-chutri-input')?.value || '');
            if (phoiHopDropdown) filterCustomDropdown('phoihop', document.getElementById('task-phoihop-input')?.value || '');
          }
        }
      })
      .catch(err => console.warn('[refreshTovien] Fetch failed:', err));
  }
}

/* CUSTOM SEARCHABLE DROPDOWN JS ENGINE */
function showCustomDropdown(type) {
  closeAllCustomDropdowns();
  const listEl = document.getElementById('dropdown-' + type);
  const inputEl = document.getElementById('task-' + type + '-input');
  if (!listEl || !inputEl) return;

  filterCustomDropdown(type, inputEl.value);
  listEl.classList.add('active');
}

function toggleCustomDropdown(type, event) {
  if (event) event.stopPropagation();
  const listEl = document.getElementById('dropdown-' + type);
  if (!listEl) return;
  if (listEl.classList.contains('active')) {
    listEl.classList.remove('active');
  } else {
    showCustomDropdown(type);
  }
}

function filterCustomDropdown(type, query) {
  const listEl = document.getElementById('dropdown-' + type);
  if (!listEl) return;

  const rawList = (appState.dropdownData && appState.dropdownData[type]) ? appState.dropdownData[type] : [];
  const qClean = cleanKey(query);

  let filtered = rawList;
  if (qClean) {
    filtered = rawList.filter(item => cleanKey(item).includes(qClean));
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="custom-dropdown-empty">Không tìm thấy kết quả phù hợp</div>`;
  } else {
    listEl.innerHTML = filtered.map(item => `
      <div class="custom-dropdown-item" onclick="selectCustomDropdownItem('${type}', '${escapeHtml(item)}')">
        ${escapeHtml(item)}
      </div>
    `).join('');
  }
  listEl.classList.add('active');
}

function selectCustomDropdownItem(type, val) {
  const inputEl = document.getElementById('task-' + type + '-input');
  if (inputEl) inputEl.value = val;
  const listEl = document.getElementById('dropdown-' + type);
  if (listEl) listEl.classList.remove('active');

  // Auto-lookup employee code and display it
  const empCode = lookupEmpCodeByName(val);
  const codeDisplayIdMap = {
    lanhdao: 'task-lanhdao-code-display',
    leadera: 'task-leadera-code-display',
    chutri: 'task-chutri-code-display',
    phoihop: 'task-phoihop-code-display'
  };
  const codeDisplayId = codeDisplayIdMap[type];
  const codeDisplay = document.getElementById(codeDisplayId);
  if (codeDisplay) {
    if (empCode) {
      codeDisplay.innerHTML = `<span style="color:#00c897; font-weight:600;">Mã NV: ${escapeHtml(empCode)}</span>`;
      codeDisplay.style.display = 'block';
    } else if (val) {
      codeDisplay.innerHTML = `<span style="color:#f59e0b; font-size:0.78rem;">⚠ Không tìm thấy mã NV</span>`;
      codeDisplay.style.display = 'block';
    } else {
      codeDisplay.style.display = 'none';
    }
  }
}

// Lookup employee code by name from appState.tovien
function lookupEmpCodeByName(name) {
  if (!name || !appState.tovien || !Array.isArray(appState.tovien)) return '';
  const nameClean = cleanKey(name);
  if (!nameClean) return '';

  for (let i = 0; i < appState.tovien.length; i++) {
    const info = getTovienRowInfo(appState.tovien[i]);
    if (info.empName && cleanKey(info.empName) === nameClean && info.empCode) {
      return info.empCode;
    }
    if (info.leaderName && cleanKey(info.leaderName) === nameClean && info.leaderCode) {
      return info.leaderCode;
    }
  }
  return '';
}

function closeAllCustomDropdowns() {
  document.querySelectorAll('.custom-dropdown-list').forEach(el => el.classList.remove('active'));
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select-box')) {
    closeAllCustomDropdowns();
  }
});

/* HEADER SEARCHABLE CUSTOM DROPDOWN ENGINE */
function isBanLanhDao(groupName, empName, roleName) {
  const gClean = cleanKey(groupName || '');
  const rClean = cleanKey(roleName || '');
  const nClean = cleanKey(empName || '');
  if (gClean === 'banlanhdao' || gClean === 'lanhdao' || gClean.includes('banlanhdao') || gClean.includes('bangiamboc') || gClean.includes('lanhdaotrungtam')) {
    return true;
  }
  if (rClean.includes('lanhdao') || rClean.includes('giamdoc')) {
    return true;
  }
  if (nClean.includes('banlanhdao') || nClean.includes('bangiamboc') || nClean === 'nguyenconghoan' || nClean.includes('nguyenconghoan')) {
    return true;
  }
  return false;
}

function getUserNameFromUserObj(u) {
  if (!u || typeof u !== 'object') return '';
  if (u._cachedName) return u._cachedName;
  let name = u['Tên'] || u['Tên nhân viên'] || u['Họ và tên'] || u['Tên người dùng'] || u.name || u.ten || u.fullName || '';
  if (!name) {
    for (let k in u) {
      if (k.startsWith('_')) continue;
      const ck = cleanKey(k);
      if (ck === 'ten' || ck === 'tennhanvien' || ck === 'hovaten' || ck === 'tennguoidung' || ck === 'name') {
        if (u[k] && String(u[k]).trim()) {
          name = String(u[k]).trim();
          break;
        }
      }
    }
  }
  const result = String(name).trim();
  u._cachedName = result;
  return result;
}

function getUserGroupFromUserObj(u) {
  if (!u || typeof u !== 'object') return '';
  if (u._cachedGroup) return u._cachedGroup;
  let group = u['Tổ'] || u['Tổ chủ trì'] || u['Đơn vị'] || u['Tổ công tác'] || u.group || u.to || '';
  if (!group) {
    for (let k in u) {
      if (k.startsWith('_')) continue;
      const ck = cleanKey(k);
      if (ck === 'to' || ck === 'tochutri' || ck === 'tento' || ck === 'group' || ck === 'donvi') {
        if (u[k] && String(u[k]).trim()) {
          group = String(u[k]).trim();
          break;
        }
      }
    }
  }
  const result = String(group).trim();
  u._cachedGroup = result;
  return result;
}

function getNonLeaderUsersFromSheetUsers(selectedGroupStr) {
  const selectedGroupClean = cleanKey(selectedGroupStr || '');
  const userSet = new Set();

  const addIfValid = (name, group) => {
    if (!name || name === 'Chưa gán') return;
    const trimmed = String(name).trim();
    if (!trimmed) return;
    if (isBanLanhDao(group, trimmed)) return;

    const grpClean = cleanKey(group || '');
    const isMatchGroup = !selectedGroupClean || grpClean === selectedGroupClean || grpClean.includes(selectedGroupClean) || selectedGroupClean.includes(grpClean);
    if (isMatchGroup) {
      userSet.add(trimmed);
    }
  };

  // 1. Collect from appState.users (Sheet User / Nguoidung ONLY)
  if (appState.users && Array.isArray(appState.users)) {
    appState.users.forEach(u => {
      const name = getUserNameFromUserObj(u);
      const group = getUserGroupFromUserObj(u);
      addIfValid(name, group);
    });
  }

  // 2. Collect from appState.tasks (Sheet congviec ONLY - strictly isolated from totruonggiaoviec)
  if (appState.tasks && Array.isArray(appState.tasks)) {
    appState.tasks.forEach(t => {
      const tg = getTaskGroup(t) || t['Tổ chủ trì (AR)'];
      const aName = getTaskLeaderName(t);
      const rName = getTaskEmpRName(t) || getTaskAssignee(t);
      const cName = getTaskEmpCName(t) || getTaskCollaborator(t);
      addIfValid(aName, tg);
      addIfValid(rName, tg);
      addIfValid(cName, tg);
    });
  }

  // NOTE: appState.totruonggiaoviec and appState.tovien are STRICTLY EXCLUDED to keep sheet congviec and totruonggiaoviec separated!

  return Array.from(userSet).sort();
}

function getHeaderGroupOptions() {
  const hostGroups = new Set();
  const addGroup = (g) => {
    if (g && !isBanLanhDao(g)) hostGroups.add(String(g).trim());
  };

  if (appState.users && Array.isArray(appState.users)) {
    appState.users.forEach(u => {
      const group = getUserGroupFromUserObj(u);
      addGroup(group);
    });
  }
  if (appState.totruonggiaoviec && Array.isArray(appState.totruonggiaoviec)) {
    appState.totruonggiaoviec.forEach(t => {
      addGroup(getToTruongTaskGroup(t));
      addGroup(t['Tổ chủ trì (AR)']);
    });
  }
  if (appState.tasks && Array.isArray(appState.tasks)) {
    appState.tasks.forEach(t => addGroup(getTaskGroup(t)));
  }

  return Array.from(hostGroups).sort();
}

function getHeaderCollabGroupOptions() {
  const collabGroups = new Set();
  const addGroup = (g) => {
    if (g && !isBanLanhDao(g)) collabGroups.add(String(g).trim());
  };

  if (appState.tasks && Array.isArray(appState.tasks)) {
    appState.tasks.forEach(t => {
      addGroup(getTaskCollaboratorGroup(t));
      addGroup(t['Tổ (R)']);
    });
  }
  if (appState.totruonggiaoviec && Array.isArray(appState.totruonggiaoviec)) {
    appState.totruonggiaoviec.forEach(t => {
      addGroup(t['Tổ (R)']);
    });
  }

  return Array.from(collabGroups).sort();
}

function toggleHeaderDropdown(type, event) {
  if (event) event.stopPropagation();
  const menuEl = document.getElementById(`header-select-${type}-menu`);
  const isActive = menuEl ? menuEl.classList.contains('active') : false;
  
  closeAllHeaderDropdowns();
  closeAllCustomDropdowns();

  if (!isActive && menuEl) {
    renderHeaderDropdownItems(type);
    menuEl.classList.add('active');
    const searchInput = menuEl.querySelector('input');
    if (searchInput) {
      searchInput.value = '';
      setTimeout(() => searchInput.focus(), 50);
    }
  }
}

function closeAllHeaderDropdowns() {
  document.querySelectorAll('.header-search-select-menu').forEach(m => m.classList.remove('active'));
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.header-search-select-wrapper')) {
    closeAllHeaderDropdowns();
  }
});

function renderHeaderDropdownItems(type, filterQuery = '') {
  const listEl = document.getElementById(`header-select-${type}-list`);
  if (!listEl) return;

  let items = [];
  let currentVal = '';
  let defaultLabel = '';

  if (type === 'group') {
    items = getHeaderGroupOptions();
    currentVal = appState.filters.group || '';
    defaultLabel = 'Tất cả Tổ chủ trì (AR)';
  } else if (type === 'collabGroup') {
    items = getHeaderCollabGroupOptions();
    currentVal = appState.filters.collabGroup || '';
    defaultLabel = 'Tất cả Tổ (R)';
  } else if (type === 'leaderA') {
    items = getNonLeaderUsersFromSheetUsers(appState.filters.group);
    currentVal = appState.filters.leaderA || '';
    defaultLabel = 'Tất cả Tên NV (A)';
  } else if (type === 'user') {
    items = getNonLeaderUsersFromSheetUsers(appState.filters.group);
    currentVal = appState.filters.user || '';
    defaultLabel = 'Tất cả Tên NV (R)';
  } else if (type === 'collabUser') {
    items = getNonLeaderUsersFromSheetUsers(appState.filters.collabGroup || appState.filters.group);
    currentVal = appState.filters.collabUser || '';
    defaultLabel = 'Tất cả Tên NV (C)';
  }

  const qClean = cleanKey(filterQuery);
  if (qClean) {
    items = items.filter(item => cleanKey(item).includes(qClean));
  }

  let html = `<div class="header-search-select-item ${!currentVal ? 'selected' : ''}" onclick="selectHeaderOption('${type}', '')">${escapeHtml(defaultLabel)}</div>`;
  
  if (items.length === 0) {
    html += `<div class="header-search-select-empty">Không tìm thấy kết quả</div>`;
  } else {
    items.forEach(item => {
      const isSel = currentVal.toLowerCase() === item.toLowerCase();
      html += `<div class="header-search-select-item ${isSel ? 'selected' : ''}" onclick="selectHeaderOption('${type}', '${escapeHtml(item)}')">${escapeHtml(item)}</div>`;
    });
  }

  listEl.innerHTML = html;
}

function filterHeaderDropdownItems(type, query) {
  renderHeaderDropdownItems(type, query);
}

function selectHeaderOption(type, value) {
  closeAllHeaderDropdowns();
  
  const hiddenSelectId = {
    group: 'global-group-select',
    collabGroup: 'global-collab-group-select',
    leaderA: 'global-leader-select',
    user: 'global-user-select',
    collabUser: 'global-collab-user-select'
  }[type];

  const labelId = `header-select-${type}-label`;
  const labelEl = document.getElementById(labelId);
  const hiddenSelect = document.getElementById(hiddenSelectId);

  const defaultLabels = {
    group: 'Tất cả Tổ chủ trì (AR)',
    collabGroup: 'Tất cả Tổ (R)',
    leaderA: 'Tất cả Tên NV (A)',
    user: 'Tất cả Tên NV (R)',
    collabUser: 'Tất cả Tên NV (C)'
  };

  if (labelEl) {
    labelEl.innerText = value || defaultLabels[type];
    if (value) {
      labelEl.style.color = '#38bdf8';
      labelEl.style.fontWeight = '600';
    } else {
      labelEl.style.color = '';
      labelEl.style.fontWeight = '';
    }
  }

  if (hiddenSelect) {
    if (value && !Array.from(hiddenSelect.options).some(opt => opt.value === value)) {
      const newOpt = document.createElement('option');
      newOpt.value = value;
      newOpt.text = value;
      hiddenSelect.appendChild(newOpt);
    }
    hiddenSelect.value = value;
  }

  if (appState.filters) {
    if (type === 'group') appState.filters.group = value;
    else if (type === 'collabGroup') appState.filters.collabGroup = value;
    else if (type === 'leaderA') appState.filters.leaderA = value;
    else if (type === 'user') appState.filters.user = value;
    else if (type === 'collabUser') appState.filters.collabUser = value;
  }

  if (type === 'group' || type === 'collabGroup') {
    onGlobalGroupChange();
  } else {
    handleGlobalFilter();
  }
}

function onGlobalGroupChange() {
  updateGlobalUserSelectOptions();
  handleGlobalFilter();
}

function updateGlobalUserSelectOptions() {
  ['leaderA', 'user', 'collabUser'].forEach(type => {
    const hiddenSelectId = {
      leaderA: 'global-leader-select',
      user: 'global-user-select',
      collabUser: 'global-collab-user-select'
    }[type];
    const hiddenSelect = document.getElementById(hiddenSelectId);
    const labelEl = document.getElementById(`header-select-${type}-label`);
    const filterKey = type === 'leaderA' ? 'leaderA' : type === 'user' ? 'user' : 'collabUser';
    const val = appState.filters ? (appState.filters[filterKey] || '') : (hiddenSelect ? hiddenSelect.value : '');
    const validUsers = getNonLeaderUsersFromSheetUsers(type === 'collabUser' ? appState.filters.collabGroup || appState.filters.group : appState.filters.group);
    
    if (val && !validUsers.some(u => u.toLowerCase() === val.toLowerCase())) {
      if (hiddenSelect) hiddenSelect.value = '';
      if (labelEl) {
        labelEl.innerText = {
          leaderA: 'Tất cả Tên NV (A)',
          user: 'Tất cả Tên NV (R)',
          collabUser: 'Tất cả Tên NV (C)'
        }[type];
        labelEl.style.color = '';
        labelEl.style.fontWeight = '';
      }
      if (appState.filters) {
        appState.filters[filterKey] = '';
      }
    } else if (val && hiddenSelect) {
      if (!Array.from(hiddenSelect.options).some(opt => opt.value === val)) {
        const newOpt = document.createElement('option');
        newOpt.value = val;
        newOpt.text = val;
        hiddenSelect.appendChild(newOpt);
      }
      hiddenSelect.value = val;
    }
  });
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
    totruonggiaoviec: 'Tổ trưởng giao việc',
    tailieu: 'Quản lý tài liệu',
    nguoidung: 'Quản lý người dùng',
    thongke: 'Thống kê theo tổ',
    danhgiacanhan: 'Đánh giá cá nhân',
    cvluuy: 'Công việc lưu ý'
  };
  const titleDisplay = document.getElementById('page-title-display');
  if (titleDisplay) titleDisplay.innerText = titles[tabName] || 'TTHT Tasks';

  // Auto-refresh data from Google Sheets when switching to totruonggiaoviec tab
  if (tabName === 'totruonggiaoviec') {
    appState.loadData(false, false);
  }

  renderActiveTab();
}

let _globalFilterTimer = null;
function handleGlobalFilterDebounced() {
  if (_globalFilterTimer) clearTimeout(_globalFilterTimer);
  _globalFilterTimer = setTimeout(() => handleGlobalFilter(), 150);
}

let _toTruongFilterTimer = null;
function renderToTruongTaskListDebounced() {
  if (_toTruongFilterTimer) clearTimeout(_toTruongFilterTimer);
  _toTruongFilterTimer = setTimeout(() => renderToTruongTaskList(), 150);
}

let _cvLuuYFilterTimer = null;
function renderCvLuuYTableDebounced() {
  if (_cvLuuYFilterTimer) clearTimeout(_cvLuuYFilterTimer);
  _cvLuuYFilterTimer = setTimeout(() => renderCvLuuYTable(), 150);
}

function handleGlobalFilter() {
  const sEl = document.getElementById('global-search-input');
  const gEl = document.getElementById('global-group-select');
  const cgEl = document.getElementById('global-collab-group-select');
  const lEl = document.getElementById('global-leader-select');
  const uEl = document.getElementById('global-user-select');
  const cuEl = document.getElementById('global-collab-user-select');

  if (sEl) appState.filters.search = sEl.value.trim();
  if (gEl && gEl.value) appState.filters.group = gEl.value;
  if (cgEl && cgEl.value) appState.filters.collabGroup = cgEl.value;
  if (lEl && lEl.value) appState.filters.leaderA = lEl.value;
  if (uEl && uEl.value) appState.filters.user = uEl.value;
  if (cuEl && cuEl.value) appState.filters.collabUser = cuEl.value;
  
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
  const collabGroupFilter = (appState.filters.collabGroup || '').trim().toLowerCase();
  const leaderAFilter = (appState.filters.leaderA || '').trim().toLowerCase();
  const userFilter = (appState.filters.user || '').trim().toLowerCase();
  const collabUserFilter = (appState.filters.collabUser || '').trim().toLowerCase();
  const kanbanAssignee = (appState.filters.kanbanAssignee || '').trim().toLowerCase();
  const kanbanPriority = (appState.filters.kanbanPriority || '').trim();

  return appState.tasks.filter(t => {
    const titleVal = String(t['Tiêu đề'] || t['Tiêu đề công việc'] || '').toLowerCase();
    const descVal = String(t['Mô tả'] || t['Mô tả công việc'] || '').toLowerCase();
    const lanhDaoVal = String(getTaskLanhDaoName(t)).toLowerCase();
    const lanhDaoCodeVal = String(getTaskLanhDaoCode(t)).toLowerCase();
    const chuTriAVal = String(getTaskLeaderName(t) || t['Tên NV (A)'] || '').toLowerCase();
    const chuTriACodeVal = String(getTaskLeaderCode(t) || t['Mã NV (A)'] || '').toLowerCase();
    const empRVal = String(getTaskEmpRName(t) || getTaskAssignee(t) || t['Tên NV (R)'] || '').toLowerCase();
    const empRCodeVal = String(getTaskEmpRCode(t) || t['Mã NV (R)'] || '').toLowerCase();
    const empCVal = String(getTaskEmpCName(t) || getTaskCollaborator(t) || t['Tên NV (C)'] || '').toLowerCase();
    const empCCodeVal = String(getTaskEmpCCode(t) || t['Mã NV (C)'] || '').toLowerCase();
    const toChuTriVal = String(getTaskGroup(t) || t['Tổ chủ trì (AR)'] || t['Tổ'] || '').toLowerCase();
    const toPhoiHopVal = String(getTaskCollaboratorGroup(t) || t['Tổ (R)'] || '').toLowerCase();
    const ghiChuVal = String(t['Ghi chú'] || '').toLowerCase();
    const idVal = String(t['ID'] || t['id'] || '').toLowerCase();

    // 1. Search filter
    if (search) {
      const match = titleVal.includes(search) ||
                    descVal.includes(search) ||
                    lanhDaoVal.includes(search) ||
                    lanhDaoCodeVal.includes(search) ||
                    chuTriAVal.includes(search) ||
                    chuTriACodeVal.includes(search) ||
                    empRVal.includes(search) ||
                    empRCodeVal.includes(search) ||
                    empCVal.includes(search) ||
                    empCCodeVal.includes(search) ||
                    toChuTriVal.includes(search) ||
                    toPhoiHopVal.includes(search) ||
                    ghiChuVal.includes(search) ||
                    idVal.includes(search);
      if (!match) return false;
    }

    // 2. Tổ chủ trì (AR) filter
    if (groupFilter) {
      const groupFilterClean = cleanKey(groupFilter);
      const matchHostGroup = cleanKey(toChuTriVal).includes(groupFilterClean);
      if (!matchHostGroup) return false;
    }

    // 3. Tổ (R) filter
    if (collabGroupFilter) {
      const collabGroupFilterClean = cleanKey(collabGroupFilter);
      const matchCollabGroup = cleanKey(toPhoiHopVal).includes(collabGroupFilterClean);
      if (!matchCollabGroup) return false;
    }

    // 4. Tên NV (A) filter
    if (leaderAFilter) {
      const leaderAFilterClean = cleanKey(leaderAFilter);
      const matchLeader = cleanKey(chuTriAVal).includes(leaderAFilterClean) ||
                          cleanKey(lanhDaoVal).includes(leaderAFilterClean) ||
                          cleanKey(t['Tên NV (A)'] || '').includes(leaderAFilterClean) ||
                          cleanKey(t['Người chủ trì'] || '').includes(leaderAFilterClean);
      if (!matchLeader) return false;
    }

    // 5. Tên NV (R) filter
    if (userFilter) {
      const userFilterClean = cleanKey(userFilter);
      const matchEmpR = cleanKey(empRVal).includes(userFilterClean) ||
                        cleanKey(t['Tên NV (R)'] || '').includes(userFilterClean) ||
                        cleanKey(t['Người phối hợp'] || '').includes(userFilterClean) ||
                        cleanKey(t['Người thực hiện'] || '').includes(userFilterClean);
      if (!matchEmpR) return false;
    }

    // 6. Tên NV (C) filter
    if (collabUserFilter) {
      const collabUserFilterClean = cleanKey(collabUserFilter);
      const matchEmpC = cleanKey(empCVal).includes(collabUserFilterClean) ||
                        cleanKey(t['Tên NV (C)'] || '').includes(collabUserFilterClean);
      if (!matchEmpC) return false;
    }

    // 7. Kanban specific filters
    if (kanbanAssignee && cleanKey(empRVal) !== cleanKey(kanbanAssignee)) return false;
    if (kanbanPriority && String(t['Mức độ ưu tiên'] || '').trim() !== kanbanPriority) return false;

    return true;
  });
}

function renderActiveTab() {
  const tab = appState.currentTab;
  if (tab === 'tongquan') renderDashboard();
  else if (tab === 'kanban') renderKanbanBoard();
  else if (tab === 'danhsach') renderTaskListTable();
  else if (tab === 'totruonggiaoviec') { populateToTruongFilters(); renderToTruongTaskList(); }
  else if (tab === 'tailieu') renderDocumentsTable();
  else if (tab === 'nguoidung') renderUsersTable();
  else if (tab === 'thongke') renderOrgStatistics();
  else if (tab === 'danhgiacanhan') { populateStatsUserFilters(); renderUserStatistics(); }
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
  highPriority.slice(0, 5).forEach((t, idx) => {
    html += `
      <div class="recent-row-item" onclick="openTaskModal('${t.ID || t.id}')" style="cursor:pointer;">
        <div class="recent-title-group">
          <i class="fa-solid fa-circle-exclamation" style="color:#f43f5e;"></i>
          <span><span style="color:#38bdf8; font-weight:700; margin-right:4px;">${idx + 1}.</span>${escapeHtml(t['Tiêu đề'])}</span>
        </div>
        <div class="recent-meta-group">
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
  tasks.slice(0, 8).forEach((t, idx) => {
    let status = t['Trạng thái'] || '';
    
    // Auto-detect overdue
    const _nx = t['Ngày làm xong'] || t['Ngày hoàn thành'] || '';
    const _hh = t['Hạn hoàn thành'] || t['Ngày kết thúc'] || '';
    if (!_nx && _hh && status !== 'Hoàn thành' && status !== 'Hoàn thành quá hạn') {
      try {
        const _d = new Date(_hh); const _t = new Date(); _t.setHours(0,0,0,0); _d.setHours(0,0,0,0);
        if (!isNaN(_d.getTime()) && _t > _d) status = 'Quá hạn';
      } catch(e) {}
    }
    let statusHtml = `<span style="font-size:0.75rem; color:#94a3b8;">${status}</span>`;
    if (status === 'Hoàn thành quá hạn') {
      statusHtml = `<span style="color:#f59e0b; font-weight:600; font-size:0.75rem;">Hoàn thành quá hạn</span>`;
    } else if (status === 'Quá hạn') {
      statusHtml = `<span class="tag-status-overdue">Quá hạn</span>`;
    }

    html += `
      <div class="recent-row-item" onclick="openTaskModal('${t.ID || t.id}')" style="cursor:pointer;">
        <div class="recent-title-group">
          <span><span style="color:#38bdf8; font-weight:700; margin-right:4px;">${idx + 1}.</span>${escapeHtml(t['Tiêu đề'])}</span>
        </div>
        <div class="recent-meta-group">
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
      cols[st].appendChild(createDarkTaskCard(t, counts[st]));
    }
  });

  if (document.getElementById('kb-count-doing')) document.getElementById('kb-count-doing').innerText = counts['Đang thực hiện'];
  if (document.getElementById('kb-count-done')) document.getElementById('kb-count-done').innerText = counts['Hoàn thành'];
  if (document.getElementById('kb-count-overdue')) document.getElementById('kb-count-overdue').innerText = counts['Quá hạn'];
  if (document.getElementById('kb-count-canceled')) document.getElementById('kb-count-canceled').innerText = counts['Đã hủy'];
}

function createDarkTaskCard(task, index) {
  const card = document.createElement('div');
  card.className = 'dark-card';
  card.draggable = true;
  card.dataset.id = task.ID || task.id;
  
  const assignee = getTaskAssignee(task);
  const avatarLetter = assignee.charAt(0).toUpperCase();

  const numPrefix = index ? `<span style="color:#38bdf8; font-weight:700; margin-right:4px;">${index}.</span>` : '';

  card.innerHTML = `
    <div class="dark-card-title">${numPrefix}${escapeHtml(task['Tiêu đề'] || '')}</div>
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
    tbody.innerHTML = `<tr><td colspan="17" style="text-align:center; padding:30px; color:var(--text-muted);">Không có dữ liệu công việc phù hợp</td></tr>`;
    return;
  }
  
  const rowsHtml = [];
  filtered.forEach((t, index) => {
    const taskId = t.ID || t.id;
    let status = t['Trạng thái'] || 'Đang thực hiện';
    
    // Auto-detect overdue: if NGÀY LÀM XONG is empty and today > HẠN HOÀN THÀNH → Quá hạn
    const _ngayXong = t['Ngày làm xong'] || t['Ngày hoàn thành'] || '';
    const _hanHT = t['Hạn hoàn thành'] || t['Ngày kết thúc'] || '';
    if (!_ngayXong && _hanHT && status !== 'Hoàn thành' && status !== 'Hoàn thành quá hạn') {
      try {
        const _dl = new Date(_hanHT);
        const _td = new Date();
        _td.setHours(0, 0, 0, 0);
        _dl.setHours(0, 0, 0, 0);
        if (!isNaN(_dl.getTime()) && _td > _dl) {
          status = 'Quá hạn';
        }
      } catch(e) {}
    }
    
    let statusBadge = '';
    if (status === 'Hoàn thành quá hạn') {
      statusBadge = `<span style="color:#f59e0b; font-weight:600; background:rgba(245, 158, 11, 0.15); padding:2px 8px; border-radius:12px; font-size:0.75rem;">Hoàn thành quá hạn</span>`;
    } else if (status === 'Quá hạn') {
      statusBadge = `<span class="tag-status-overdue">Quá hạn</span>`;
    } else if (status === 'Hoàn thành') {
      statusBadge = `<span style="color:#10b981; font-weight:600;">Hoàn thành</span>`;
    } else {
      statusBadge = `<span style="color:#94a3b8; font-size:0.78rem;">${escapeHtml(status)}</span>`;
    }

    const progress = Number(t['Tiến độ (%)'] || 0);
    const keHoach = t['Kế hoạch'] !== undefined && t['Kế hoạch'] !== '' ? t['Kế hoạch'] : 1;
    const thucHien = t['Thực hiện'] !== undefined && t['Thực hiện'] !== '' ? t['Thực hiện'] : 0;
    const tyLe = t['Tỷ lệ'] || (keHoach > 0 ? Math.round((thucHien / keHoach) * 100) + '%' : '0%');
    const ghiChu = t['Ghi chú'] || '';
    const ngayLamXong = t['Ngày làm xong'] || '';
    const lanhDaoName = getTaskLanhDaoName(t);
    const lanhDaoCode = getTaskLanhDaoCode(t) || lookupEmpCodeByName(lanhDaoName);
    const chuTriName = getTaskLeaderName(t) || getTaskAssignee(t);
    const chuTriCode = getTaskLeaderCode(t) || lookupEmpCodeByName(chuTriName);
    const toChuTriName = t['Tổ chủ trì (AR)'] || getTaskGroup(t);
    const phoiHopName = getTaskEmpRName(t) || getTaskAssignee(t);
    const phoiHopCode = getTaskEmpRCode(t) || lookupEmpCodeByName(phoiHopName);
    const empCName = getTaskEmpCName(t) || getTaskCollaborator(t);
    const empCCode = getTaskEmpCCode(t) || lookupEmpCodeByName(empCName);

    rowsHtml.push(`
      <tr>
        <td class="col-title-cell"><span style="color:#38bdf8; font-weight:700; margin-right:4px;">${index + 1}.</span><strong style="color:#ffffff;">${escapeHtml(t['Tiêu đề'] || '')}</strong></td>
        <td class="col-desc-cell">${escapeHtml(t['Mô tả'] || '')}</td>
        <td class="status-col-cell">${statusBadge}</td>
        <td><div>${formatNameList(lanhDaoName)}</div>${lanhDaoCode ? `<div style="color:#64748b; font-size:0.72rem; margin-top:2px;">${escapeHtml(lanhDaoCode)}</div>` : ''}</td>
        <td><span class="tag-org">${escapeHtml(toChuTriName || 'Chung')}</span></td>
        <td><div>${formatNameList(chuTriName)}</div>${chuTriCode ? `<div style="color:#64748b; font-size:0.72rem; margin-top:2px;">${escapeHtml(chuTriCode)}</div>` : ''}</td>
        <td><div>${formatNameList(phoiHopName)}</div>${phoiHopCode ? `<div style="color:#64748b; font-size:0.72rem; margin-top:2px;">${escapeHtml(phoiHopCode)}</div>` : ''}</td>
        <td><div>${formatNameList(empCName)}</div>${empCCode ? `<div style="color:#64748b; font-size:0.72rem; margin-top:2px;">${escapeHtml(empCCode)}</div>` : ''}</td>
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
      </tr>
    `);
  });

  tbody.innerHTML = rowsHtml.join('');

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

  filtered.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-title-cell"><span style="color:#38bdf8; font-weight:700; margin-right:4px;">${idx + 1}.</span><strong>${escapeHtml(item['Công việc'] || '')}</strong></td>
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
  
  appState.documents.forEach((doc, idx) => {
    const valHD = Number(doc['Giá trị HĐ'] || 0).toLocaleString('vi-VN');
    const valTH = Number(doc['Giá trị thực hiện'] || 0).toLocaleString('vi-VN');
    const diffVal = Number(doc['Chênh lệch'] || 0).toLocaleString('vi-VN');
    const fileBtn = doc['File URL'] ? `<a href="${doc['File URL']}" target="_blank" class="btn-dark-sec btn-sm"><i class="fa-solid fa-file-pdf"></i> Tệp</a>` : 'N/A';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(doc['Số hồ sơ'] || '')}</strong></td>
      <td class="col-title-cell"><span style="color:#38bdf8; font-weight:700; margin-right:4px;">${idx + 1}.</span><strong>${escapeHtml(doc['Tên hồ sơ'] || '')}</strong></td>
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
  
  appState.users.forEach((usr, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${usr.ID || usr.id}</strong></td>
      <td><span style="color:#38bdf8; font-weight:700; margin-right:4px;">${idx + 1}.</span><strong>${escapeHtml(usr['Tên'] || '')}</strong></td>
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

  if (appState.users && Array.isArray(appState.users)) {
    appState.users.forEach(u => {
      const { group } = getUserNameAndGroup(u);
      if (group && !orgMap[group]) {
        orgMap[group] = { total: 0, inProgress: 0, done: 0, overdue: 0 };
      }
    });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  if (appState.tasks && Array.isArray(appState.tasks)) {
    appState.tasks.forEach(t => {
      let grp = getTaskGroup(t);
      if (!grp) {
        const assignee = getTaskAssignee(t);
        const usr = appState.users.find(u => {
          const { name } = getUserNameAndGroup(u);
          return name === assignee;
        });
        if (usr) {
          const { group } = getUserNameAndGroup(usr);
          grp = group;
        }
      }
      if (!grp) grp = 'Chưa phân tổ';

      if (!orgMap[grp]) {
        orgMap[grp] = { total: 0, inProgress: 0, done: 0, overdue: 0 };
      }

      orgMap[grp].total++;

      const st = t['Trạng thái'] || '';
      const endDate = t['Ngày kết thúc'] || t['Hạn hoàn thành'] || '';

      const isDone = (st === 'Hoàn thành');
      const isDoneOverdue = (st === 'Hoàn thành quá hạn');
      const isOverdue = isDoneOverdue || (!isDone && endDate && endDate < todayStr);

      if (isDone) {
        orgMap[grp].done++;
      } else if (isDoneOverdue) {
        orgMap[grp].done++;
        orgMap[grp].overdue++;
      } else if (isOverdue) {
        orgMap[grp].overdue++;
        orgMap[grp].inProgress++;
      } else {
        orgMap[grp].inProgress++;
      }
    });
  }

  const groups = Object.keys(orgMap).sort();
  let grandTotal = 0, grandInProgress = 0, grandDone = 0, grandOverdue = 0;

  groups.forEach(g => {
    grandTotal += orgMap[g].total;
    grandInProgress += orgMap[g].inProgress;
    grandDone += orgMap[g].done;
    grandOverdue += orgMap[g].overdue;
  });

  let html = `
    <div style="display:flex; flex-direction:column; gap:20px;">
      <!-- TOP PROGRESS SUMMARY CARDS -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
  `;

  groups.forEach(g => {
    const data = orgMap[g];
    const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
    html += `
      <div style="background:rgba(255,255,255,0.03); border:1px solid var(--card-border); border-radius:12px; padding:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="color:var(--text-white); font-size:0.92rem;"><i class="fa-solid fa-users icon-green" style="margin-right:6px;"></i>${escapeHtml(g)}</strong>
          <span style="background:rgba(0,200,151,0.15); color:var(--emerald-primary); padding:2px 8px; border-radius:10px; font-weight:700; font-size:0.78rem;">${pct}%</span>
        </div>
        <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden; margin-bottom:10px;">
          <div style="height:100%; width:${pct}%; background:var(--emerald-primary); transition:width 0.4s ease;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--text-sub);">
          <span>Tổng: <strong style="color:#fff;">${data.total}</strong></span>
          <span>Đang làm: <strong style="color:#38bdf8;">${data.inProgress}</strong></span>
          <span>Xong: <strong style="color:#00c897;">${data.done}</strong></span>
          <span>Trễ: <strong style="color:#ef4444;">${data.overdue}</strong></span>
        </div>
      </div>
    `;
  });

  html += `
      </div>

      <!-- DETAILED STATISTICS TABLE -->
      <div class="card-dark" style="margin-top:10px; border:1px solid var(--card-border); border-radius:12px; overflow:hidden;">
        <div style="padding:14px 18px; background:rgba(255,255,255,0.03); border-bottom:1px solid var(--card-border); font-weight:700; color:var(--text-white); display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-table-list icon-green"></i> Bảng Thống Kê Tiến Độ Chi Tiết Theo Tổ
        </div>
        <div style="overflow-x:auto;">
          <table class="dark-table" style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
            <thead>
              <tr style="background:#251652; color:#ffffff;">
                <th style="padding:12px 14px; text-align:center; width:50px;">STT</th>
                <th style="padding:12px 14px; text-align:left;">Tổ Chủ Trì</th>
                <th style="padding:12px 14px; text-align:center;">Tổng Số Công Việc</th>
                <th style="padding:12px 14px; text-align:center; color:#38bdf8;">Đang Thực Hiện</th>
                <th style="padding:12px 14px; text-align:center; color:#00c897;">Đã Hoàn Thành</th>
                <th style="padding:12px 14px; text-align:center; color:#ef4444;">Quá Hạn</th>
                <th style="padding:12px 14px; text-align:center;">Tỷ Lệ Hoàn Thành</th>
              </tr>
            </thead>
            <tbody>
  `;

  groups.forEach((g, idx) => {
    const data = orgMap[g];
    const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
    html += `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
        <td style="padding:10px 14px; font-weight:700; color:#38bdf8;">${idx + 1}</td>
        <td style="padding:10px 14px; text-align:left; font-weight:600; color:#ffffff;">${escapeHtml(g)}</td>
        <td style="padding:10px 14px;"><span class="number-pill" style="background:rgba(255,255,255,0.1); font-weight:700;">${data.total}</span></td>
        <td style="padding:10px 14px; font-weight:600; color:#38bdf8;">${data.inProgress}</td>
        <td style="padding:10px 14px; font-weight:600; color:#00c897;">${data.done}</td>
        <td style="padding:10px 14px; font-weight:600; color:${data.overdue > 0 ? '#ef4444' : 'var(--text-sub)'};">${data.overdue > 0 ? `<span style="background:rgba(239,68,68,0.2); color:#ef4444; padding:2px 8px; border-radius:10px; font-weight:700;">${data.overdue}</span>` : '0'}</td>
        <td style="padding:10px 14px;">
          <div style="display:flex; align-items:center; gap:8px; justify-content:center;">
            <div style="width:80px; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
              <div style="height:100%; width:${pct}%; background:var(--emerald-primary);"></div>
            </div>
            <strong style="color:var(--emerald-primary); font-size:0.8rem;">${pct}%</strong>
          </div>
        </td>
      </tr>
    `;
  });

  const grandPct = grandTotal > 0 ? Math.round((grandDone / grandTotal) * 100) : 0;
  html += `
            </tbody>
            <tfoot>
              <tr style="background:rgba(0,200,151,0.1); font-weight:700; color:#ffffff; border-top:2px solid var(--card-border);">
                <td colspan="2" style="padding:12px 14px; text-align:left; font-size:0.9rem; color:var(--emerald-primary);">TỔNG CỘNG TOÀN ĐƠN VỊ</td>
                <td style="padding:12px 14px;"><span class="number-pill" style="background:var(--emerald-primary); color:#0f172a; font-weight:800;">${grandTotal}</span></td>
                <td style="padding:12px 14px; color:#38bdf8; font-size:0.9rem;">${grandInProgress}</td>
                <td style="padding:12px 14px; color:#00c897; font-size:0.9rem;">${grandDone}</td>
                <td style="padding:12px 14px; color:#ef4444; font-size:0.9rem;">${grandOverdue}</td>
                <td style="padding:12px 14px; color:var(--emerald-primary); font-size:0.9rem;">${grandPct}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

let currentStatsSubTab = 'org';

function switchStatsSubTab(type) {
  currentStatsSubTab = type;
  const btnOrg = document.getElementById('btn-subtab-org');
  const btnUser = document.getElementById('btn-subtab-user');
  const contentOrg = document.getElementById('subtab-org-content');
  const contentUser = document.getElementById('subtab-user-content');
  const filterBar = document.getElementById('stats-user-filter-bar');

  if (type === 'org') {
    if (btnOrg) btnOrg.classList.add('active');
    if (btnUser) btnUser.classList.remove('active');
    if (contentOrg) contentOrg.style.display = 'block';
    if (contentUser) contentUser.style.display = 'none';
    if (filterBar) filterBar.style.display = 'none';
    renderOrgStatistics();
  } else {
    if (btnUser) btnUser.classList.add('active');
    if (btnOrg) btnOrg.classList.remove('active');
    if (contentUser) contentUser.style.display = 'block';
    if (contentOrg) contentOrg.style.display = 'none';
    if (filterBar) filterBar.style.display = 'flex';
    populateStatsUserFilters();
    renderUserStatistics();
  }
}

function populateStatsUserFilters() {
  const grpSelect = document.getElementById('stats-user-group-filter');
  const usrSelect = document.getElementById('stats-user-person-filter');
  if (!grpSelect || !usrSelect) return;

  const currentGrp = grpSelect.value;
  const hostGroups = new Set();

  if (appState.users && Array.isArray(appState.users)) {
    appState.users.forEach(u => {
      const { group } = getUserNameAndGroup(u);
      if (group) hostGroups.add(group);
    });
  }

  if (appState.tasks && Array.isArray(appState.tasks)) {
    appState.tasks.forEach(t => {
      const tg = getTaskGroup(t);
      if (tg) hostGroups.add(tg);
    });
  }

  grpSelect.innerHTML = '<option value="">Tất cả tổ</option>';
  Array.from(hostGroups).sort().forEach(g => {
    grpSelect.innerHTML += `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`;
  });
  if (currentGrp) grpSelect.value = currentGrp;

  onStatsUserGroupChange();
}

function onStatsUserGroupChange() {
  const grpSelect = document.getElementById('stats-user-group-filter');
  const usrSelect = document.getElementById('stats-user-person-filter');
  if (!grpSelect || !usrSelect) return;

  const selGrp = grpSelect.value;
  const selGrpClean = cleanKey(selGrp);
  const currentUsr = usrSelect.value;

  const usersInGrp = new Set();

  if (selGrpClean) {
    if (appState.users && Array.isArray(appState.users)) {
      appState.users.forEach(u => {
        const { name, group } = getUserNameAndGroup(u);
        const ckG = cleanKey(group);
        if (ckG && (ckG.includes(selGrpClean) || selGrpClean.includes(ckG)) && name) {
          usersInGrp.add(name);
        }
      });
    }

    if (appState.tasks && Array.isArray(appState.tasks)) {
      appState.tasks.forEach(t => {
        const tg = getTaskGroup(t);
        const ckTg = cleanKey(tg);
        const a = getTaskAssignee(t);
        if (ckTg && (ckTg.includes(selGrpClean) || selGrpClean.includes(ckTg)) && a && a !== 'Chưa gán') {
          a.split(',').forEach(n => { if (n.trim()) usersInGrp.add(n.trim()); });
        }
      });
    }
  } else {
    if (appState.users && Array.isArray(appState.users)) {
      appState.users.forEach(u => {
        const { name } = getUserNameAndGroup(u);
        if (name) usersInGrp.add(name);
      });
    }
    if (appState.tasks && Array.isArray(appState.tasks)) {
      appState.tasks.forEach(t => {
        const a = getTaskAssignee(t);
        const c = getTaskCollaborator(t);
        if (a && a !== 'Chưa gán') a.split(',').forEach(n => { if (n.trim()) usersInGrp.add(n.trim()); });
        if (c && String(c).trim()) c.split(',').forEach(n => { if (n.trim()) usersInGrp.add(n.trim()); });
      });
    }
  }

  usrSelect.innerHTML = '<option value="">Tất cả cá nhân</option>';
  Array.from(usersInGrp).sort().forEach(u => {
    usrSelect.innerHTML += `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`;
  });

  if (currentUsr && Array.from(usersInGrp).includes(currentUsr)) {
    usrSelect.value = currentUsr;
  }

  renderUserStatistics();
}

function getUserTeamName(personName) {
  if (!personName) return '';
  const pClean = cleanKey(personName);
  if (!pClean) return '';

  if (appState.tovien && Array.isArray(appState.tovien)) {
    let lastGroup = '';
    for (let i = 0; i < appState.tovien.length; i++) {
      const row = appState.tovien[i];
      const info = getTovienRowInfo(row);
      if (info.group) lastGroup = info.group;

      if (info.empName && cleanKey(info.empName) === pClean) {
        if (info.group || lastGroup) return info.group || lastGroup;
      }
      if (info.leaderName && cleanKey(info.leaderName) === pClean) {
        if (info.group || lastGroup) return info.group || lastGroup;
      }
    }
  }

  let foundUser = appState.users && Array.isArray(appState.users) ? appState.users.find(u => {
    const { name } = getUserNameAndGroup(u);
    return cleanKey(name) === pClean;
  }) : null;

  if (!foundUser && appState.users && Array.isArray(appState.users)) {
    foundUser = appState.users.find(u => {
      const { name } = getUserNameAndGroup(u);
      const uClean = cleanKey(name);
      return uClean && (uClean.includes(pClean) || pClean.includes(uClean));
    });
  }

  if (foundUser) {
    const { group } = getUserNameAndGroup(foundUser);
    if (group && group !== 'Chưa phân tổ') return group;
  }

  if (appState.tasks && Array.isArray(appState.tasks)) {
    const hostTask = appState.tasks.find(t => {
      const a = getTaskAssignee(t);
      return a && cleanKey(a).includes(pClean);
    });
    if (hostTask) {
      const tg = getTaskGroup(hostTask);
      if (tg && tg !== 'Khác') return tg;
    }
  }

  return '';
}

function renderUserStatistics() {
  const container = document.getElementById('stats-user-container');
  if (!container) return;

  const grpFilter = document.getElementById('stats-user-group-filter')?.value || '';
  const grpClean = cleanKey(grpFilter);
  const usrFilter = document.getElementById('stats-user-person-filter')?.value || '';
  const usrClean = cleanKey(usrFilter);

  const userStatsMap = {};

  if (appState.users && Array.isArray(appState.users)) {
    appState.users.forEach(u => {
      const { name, group } = getUserNameAndGroup(u);
      if (name && !userStatsMap[name]) {
        userStatsMap[name] = {
          name: name,
          group: group || 'Chưa phân tổ',
          hostTasks: 0,
          collabTasks: 0,
          total: 0,
          inProgress: 0,
          done: 0,
          overdue: 0
        };
      }
    });
  }

  function findOrCreateUserStat(rawName, taskGroupFallback) {
    const cleanN = cleanKey(rawName);
    let matchedKey = Object.keys(userStatsMap).find(k => cleanKey(k) === cleanN);

    if (!matchedKey) {
      const userTeam = getUserTeamName(rawName) || taskGroupFallback || 'Khác';
      matchedKey = rawName.trim();
      userStatsMap[matchedKey] = {
        name: matchedKey,
        group: userTeam,
        hostTasks: 0,
        collabTasks: 0,
        total: 0,
        inProgress: 0,
        done: 0,
        overdue: 0
      };
    } else {
      const officialTeam = getUserTeamName(matchedKey);
      if (officialTeam) userStatsMap[matchedKey].group = officialTeam;
    }

    return userStatsMap[matchedKey];
  }

  const todayStr = new Date().toISOString().split('T')[0];

  if (appState.tasks && Array.isArray(appState.tasks)) {
    appState.tasks.forEach(t => {
      const assigneeStr = getTaskAssignee(t);
      const collabStr = getTaskCollaborator(t);
      const tg = getTaskGroup(t);
      const st = t['Trạng thái'] || '';
      const endDate = t['Ngày kết thúc'] || t['Hạn hoàn thành'] || '';

      const isDone = (st === 'Hoàn thành');
      const isDoneOverdue = (st === 'Hoàn thành quá hạn');
      const isOverdue = isDoneOverdue || (!isDone && endDate && endDate < todayStr);

      if (assigneeStr && assigneeStr !== 'Chưa gán') {
        assigneeStr.split(',').forEach(rawName => {
          const uName = rawName.trim();
          if (uName) {
            const stat = findOrCreateUserStat(uName, tg);
            stat.hostTasks++;
            stat.total++;
            if (isDone) stat.done++;
            else if (isDoneOverdue) { stat.done++; stat.overdue++; }
            else if (isOverdue) { stat.overdue++; stat.inProgress++; }
            else stat.inProgress++;
          }
        });
      }

      if (collabStr && String(collabStr).trim()) {
        collabStr.split(',').forEach(rawName => {
          const uName = rawName.trim();
          if (uName) {
            const stat = findOrCreateUserStat(uName, tg);
            stat.collabTasks++;
            stat.total++;
            if (isDone) stat.done++;
            else if (isDoneOverdue) { stat.done++; stat.overdue++; }
            else if (isOverdue) { stat.overdue++; stat.inProgress++; }
            else stat.inProgress++;
          }
        });
      }
    });
  }

  let userList = Object.values(userStatsMap).filter(u => {
    const n = String(u.name || '').trim();
    return n !== '' && n !== '0' && n !== 'undefined' && n !== 'null';
  });

  // Re-verify official team for all users
  userList.forEach(u => {
    const officialTeam = getUserTeamName(u.name);
    if (officialTeam) {
      u.group = officialTeam;
    }
  });

  if (grpClean) {
    userList = userList.filter(u => {
      const ckG = cleanKey(u.group);
      return ckG.includes(grpClean) || grpClean.includes(ckG);
    });
  }
  if (usrClean) {
    userList = userList.filter(u => cleanKey(u.name) === usrClean || cleanKey(u.name).includes(usrClean));
  }

  userList.sort((a, b) => a.name.localeCompare(b.name));

  let totalTasksSum = 0, totalInProgressSum = 0, totalDoneSum = 0, totalOverdueSum = 0;
  userList.forEach(u => {
    totalTasksSum += u.total;
    totalInProgressSum += u.inProgress;
    totalDoneSum += u.done;
    totalOverdueSum += u.overdue;
  });

  let html = `
    <div style="overflow-x:auto;">
      <table class="dark-table" style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <thead>
          <tr style="background:#251652; color:#ffffff;">
            <th style="padding:12px 14px; text-align:center; width:50px;">STT</th>
            <th style="padding:12px 14px; text-align:left;">Họ Và Tên Nhân Viên</th>
            <th style="padding:12px 14px; text-align:left;">Tổ Công Tác</th>
            <th style="padding:12px 14px; text-align:center;">Tổng Việc Được Giao</th>
            <th style="padding:12px 14px; text-align:center; color:#38bdf8;">Chủ Trì</th>
            <th style="padding:12px 14px; text-align:center; color:#a78bfa;">Phối Hợp</th>
            <th style="padding:12px 14px; text-align:center; color:#38bdf8;">Đang Làm</th>
            <th style="padding:12px 14px; text-align:center; color:#00c897;">Đã Xong</th>
            <th style="padding:12px 14px; text-align:center; color:#ef4444;">Quá Hạn</th>
            <th style="padding:12px 14px; text-align:center;">Tỷ Lệ Hoàn Thành</th>
            <th style="padding:12px 14px; text-align:center;">Đánh Giá Xếp Loại</th>
          </tr>
        </thead>
        <tbody>
  `;

  if (userList.length === 0) {
    html += `
      <tr>
        <td colspan="11" style="padding:20px; color:#94a3b8;">Không tìm thấy nhân viên nào phù hợp với bộ lọc.</td>
      </tr>
    `;
  } else {
    userList.forEach((u, idx) => {
      const pct = u.total > 0 ? Math.round((u.done / u.total) * 100) : 0;
      let gradeBadge = '';
      if (u.total === 0) {
        gradeBadge = `<span style="color:#94a3b8; font-size:0.78rem;">Chưa giao việc</span>`;
      } else if (pct >= 100 && u.overdue === 0) {
        gradeBadge = `<span class="badge-grade grade-a"><i class="fa-solid fa-star" style="margin-right:4px;"></i>Tốt (A)</span>`;
      } else if (pct >= 100 && u.overdue > 0) {
        gradeBadge = `<span class="badge-grade grade-b"><i class="fa-solid fa-check" style="margin-right:4px;"></i>Hoàn thành (B)</span>`;
      } else if (pct >= 50) {
        gradeBadge = `<span class="badge-grade grade-c"><i class="fa-solid fa-check" style="margin-right:4px;"></i>Hoàn thành (B)</span>`;
      } else {
        gradeBadge = `<span class="badge-grade grade-d"><i class="fa-solid fa-circle-exclamation" style="margin-right:4px;"></i>Chưa đạt (D)</span>`;
      }

      html += `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:10px 14px; font-weight:700; color:#38bdf8;">${idx + 1}</td>
          <td style="padding:10px 14px; text-align:left; font-weight:700; color:#ffffff;">${escapeHtml(u.name)}</td>
          <td style="padding:10px 14px; text-align:left; color:#94a3b8;">${escapeHtml(u.group)}</td>
          <td style="padding:10px 14px;"><span class="number-pill" style="background:rgba(255,255,255,0.1); font-weight:700;">${u.total}</span></td>
          <td style="padding:10px 14px; font-weight:600; color:#38bdf8;">${u.hostTasks}</td>
          <td style="padding:10px 14px; font-weight:600; color:#a78bfa;">${u.collabTasks}</td>
          <td style="padding:10px 14px; font-weight:600; color:#38bdf8;">${u.inProgress}</td>
          <td style="padding:10px 14px; font-weight:600; color:#00c897;">${u.done}</td>
          <td style="padding:10px 14px; font-weight:600; color:${u.overdue > 0 ? '#ef4444' : 'var(--text-sub)'};">${u.overdue > 0 ? `<span style="background:rgba(239,68,68,0.2); color:#ef4444; padding:2px 8px; border-radius:10px; font-weight:700;">${u.overdue}</span>` : '0'}</td>
          <td style="padding:10px 14px;">
            <div style="display:flex; align-items:center; gap:8px; justify-content:center;">
              <div style="width:70px; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
                <div style="height:100%; width:${pct}%; background:var(--emerald-primary);"></div>
              </div>
              <strong style="color:var(--emerald-primary); font-size:0.8rem;">${pct}%</strong>
            </div>
          </td>
          <td style="padding:10px 14px;">${gradeBadge}</td>
        </tr>
      `;
    });
  }

  const grandPct = totalTasksSum > 0 ? Math.round((totalDoneSum / totalTasksSum) * 100) : 0;
  html += `
        </tbody>
        <tfoot>
          <tr style="background:rgba(0,200,151,0.1); font-weight:700; color:#ffffff; border-top:2px solid var(--card-border);">
            <td colspan="3" style="padding:12px 14px; text-align:left; font-size:0.9rem; color:var(--emerald-primary);">TỔNG CỘNG DANH SÁCH (${userList.length} nhân viên)</td>
            <td style="padding:12px 14px;"><span class="number-pill" style="background:var(--emerald-primary); color:#0f172a; font-weight:800;">${totalTasksSum}</span></td>
            <td colspan="2" style="padding:12px 14px; color:var(--text-sub);">--</td>
            <td style="padding:12px 14px; color:#38bdf8; font-size:0.9rem;">${totalInProgressSum}</td>
            <td style="padding:12px 14px; color:#00c897; font-size:0.9rem;">${totalDoneSum}</td>
            <td style="padding:12px 14px; color:#ef4444; font-size:0.9rem;">${totalOverdueSum}</td>
            <td style="padding:12px 14px; color:var(--emerald-primary); font-size:0.9rem;">${grandPct}%</td>
            <td style="padding:12px 14px; color:var(--emerald-primary); font-size:0.9rem;">--</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  container.innerHTML = html;
}

function openTaskModal(taskId = null) {
  try {
    const form = document.getElementById('form-task');
    if (form) form.reset();
    const subContainer = document.getElementById('subtasks-container');
    if (subContainer) subContainer.innerHTML = '';
    
    populateSelects();
    
    // Refresh tovien from Google Sheets in background (ensures latest employee list)
    refreshTovienFromSheet();
    
    if (taskId) {
      let task = appState.tasks.find(t => String(t.ID || t.id) === String(taskId));
      if (!task && appState.totruonggiaoviec && Array.isArray(appState.totruonggiaoviec)) {
        task = appState.totruonggiaoviec.find(t => String(t.ID || t.id) === String(taskId));
      }
      if (task) {
        if (document.getElementById('modal-task-title')) document.getElementById('modal-task-title').innerText = 'Chỉnh Sửa Công Việc #' + taskId;
        if (document.getElementById('task-id')) document.getElementById('task-id').value = task.ID || task.id;
        if (document.getElementById('task-title-input')) document.getElementById('task-title-input').value = task['Tiêu đề công việc'] || task['Tiêu đề'] || '';
        if (document.getElementById('task-desc-input')) document.getElementById('task-desc-input').value = task['Mô tả công việc'] || task['Mô tả'] || '';
        if (document.getElementById('task-priority-input')) document.getElementById('task-priority-input').value = task['Mức độ ưu tiên'] || 'Trung bình';
        if (document.getElementById('task-status-input')) document.getElementById('task-status-input').value = task['Trạng thái'] || 'Đang thực hiện';
        if (document.getElementById('task-start-input')) document.getElementById('task-start-input').value = task['Ngày bắt đầu'] || '';
        if (document.getElementById('task-end-input')) document.getElementById('task-end-input').value = task['Ngày kết thúc'] || task['Hạn hoàn thành'] || '';
        if (document.getElementById('task-kehoach-input')) document.getElementById('task-kehoach-input').value = task['Kế hoạch'] !== undefined ? task['Kế hoạch'] : 1;
        if (document.getElementById('task-thuchien-input')) document.getElementById('task-thuchien-input').value = task['Thực hiện'] !== undefined ? task['Thực hiện'] : 0;
        
        const grp = task['Tổ'] || getTaskGroup(task);
        const toSelect = document.getElementById('task-tochutri-input');
        if (toSelect) toSelect.value = grp;
        handleModalGroupChange(grp);

        // 1. Lãnh đạo
        const lanhdaoInput = document.getElementById('task-lanhdao-input');
        const lanhdaoName = task['Lãnh đạo'] || getTaskLanhDaoName(task) || 'Nguyễn Công Hoan';
        if (lanhdaoInput) lanhdaoInput.value = lanhdaoName;
        const lanhdaoCode = task['Mã LĐ'] || lookupEmpCodeByName(lanhdaoName);
        const lanhdaoCodeDisplay = document.getElementById('task-lanhdao-code-display');
        if (lanhdaoCodeDisplay) {
          if (lanhdaoCode) {
            lanhdaoCodeDisplay.innerHTML = `<span style="color:#00c897; font-weight:600;">Mã NV: ${escapeHtml(lanhdaoCode)}</span>`;
            lanhdaoCodeDisplay.style.display = 'block';
          } else if (lanhdaoName) {
            lanhdaoCodeDisplay.innerHTML = `<span style="color:#f59e0b; font-size:0.78rem;">⚠ Không tìm thấy mã NV</span>`;
            lanhdaoCodeDisplay.style.display = 'block';
          } else {
            lanhdaoCodeDisplay.style.display = 'none';
          }
        }

        // 2. Tên NV (A)
        const leaderAInput = document.getElementById('task-leadera-input');
        const leaderAName = task['Tên NV (A)'] || getTaskLeaderName(task) || '';
        if (leaderAInput) leaderAInput.value = leaderAName;
        const leaderACode = task['Mã NV (A)'] || lookupEmpCodeByName(leaderAName);
        const leaderACodeDisplay = document.getElementById('task-leadera-code-display');
        if (leaderACodeDisplay) {
          if (leaderACode) {
            leaderACodeDisplay.innerHTML = `<span style="color:#00c897; font-weight:600;">Mã NV: ${escapeHtml(leaderACode)}</span>`;
            leaderACodeDisplay.style.display = 'block';
          } else if (leaderAName) {
            leaderACodeDisplay.innerHTML = `<span style="color:#f59e0b; font-size:0.78rem;">⚠ Không tìm thấy mã NV</span>`;
            leaderACodeDisplay.style.display = 'block';
          } else {
            leaderACodeDisplay.style.display = 'none';
          }
        }

        // 3. Tên NV (R)
        const chuTriSelect = document.getElementById('task-chutri-input');
        const assigneeName = getTaskEmpRName(task) || getTaskAssignee(task);
        if (chuTriSelect) {
          chuTriSelect.value = assigneeName;
        }
        const empRCode = task['Mã NV (R)'] || lookupEmpCodeByName(assigneeName);
        const chuTriCodeDisplay = document.getElementById('task-chutri-code-display');
        if (chuTriCodeDisplay) {
          if (empRCode) {
            chuTriCodeDisplay.innerHTML = `<span style="color:#00c897; font-weight:600;">Mã NV: ${escapeHtml(empRCode)}</span>`;
            chuTriCodeDisplay.style.display = 'block';
          } else if (assigneeName) {
            chuTriCodeDisplay.innerHTML = `<span style="color:#f59e0b; font-size:0.78rem;">⚠ Không tìm thấy mã NV</span>`;
            chuTriCodeDisplay.style.display = 'block';
          } else {
            chuTriCodeDisplay.style.display = 'none';
          }
        }

        // 4. Tên NV (C)
        const phoiHopSelect = document.getElementById('task-phoihop-input');
        const collabName = getTaskEmpCName(task) || getTaskCollaborator(task);
        if (phoiHopSelect) {
          phoiHopSelect.value = collabName;
        }
        const empCCode = task['Mã NV (C)'] || lookupEmpCodeByName(collabName);
        const phoiHopCodeDisplay = document.getElementById('task-phoihop-code-display');
        if (phoiHopCodeDisplay) {
          if (empCCode) {
            phoiHopCodeDisplay.innerHTML = `<span style="color:#00c897; font-weight:600;">Mã NV: ${escapeHtml(empCCode)}</span>`;
            phoiHopCodeDisplay.style.display = 'block';
          } else if (collabName) {
            phoiHopCodeDisplay.innerHTML = `<span style="color:#f59e0b; font-size:0.78rem;">⚠ Không tìm thấy mã NV</span>`;
            phoiHopCodeDisplay.style.display = 'block';
          } else {
            phoiHopCodeDisplay.style.display = 'none';
          }
        }

        if (document.getElementById('task-progress-input')) document.getElementById('task-progress-input').value = task['Tiến độ (%)'] || 0;
        if (document.getElementById('progress-val-display')) document.getElementById('progress-val-display').innerText = task['Tiến độ (%)'] || 0;
        if (document.getElementById('task-ghichu-input')) document.getElementById('task-ghichu-input').value = task['Ghi chú'] || '';
        if (document.getElementById('task-attachment-input')) document.getElementById('task-attachment-input').value = task['Tệp đính kèm'] || '';

        if (task.subtasks && Array.isArray(task.subtasks)) {
          task.subtasks.forEach(st => addSubtaskRow(st.title, st.completed));
        }
      }
    } else {
      if (document.getElementById('modal-task-title')) document.getElementById('modal-task-title').innerText = 'Tạo Công Việc Mới';
      if (document.getElementById('task-id')) document.getElementById('task-id').value = '';
      const toSelect = document.getElementById('task-tochutri-input');
      if (toSelect) toSelect.value = '';
      handleModalGroupChange('');
      // Default start date to today
      const today = new Date();
      const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      if (document.getElementById('task-start-input')) document.getElementById('task-start-input').value = todayStr;

      // Default Lãnh đạo
      if (document.getElementById('task-lanhdao-input')) document.getElementById('task-lanhdao-input').value = 'Nguyễn Công Hoan';
      const lanhdaoCode = lookupEmpCodeByName('Nguyễn Công Hoan');
      const lanhdaoCodeDisplay = document.getElementById('task-lanhdao-code-display');
      if (lanhdaoCodeDisplay) {
        if (lanhdaoCode) {
          lanhdaoCodeDisplay.innerHTML = `<span style="color:#00c897; font-weight:600;">Mã NV: ${escapeHtml(lanhdaoCode)}</span>`;
          lanhdaoCodeDisplay.style.display = 'block';
        } else {
          lanhdaoCodeDisplay.style.display = 'none';
        }
      }

      if (document.getElementById('task-leadera-input')) document.getElementById('task-leadera-input').value = '';
      const leaderACodeDisplay = document.getElementById('task-leadera-code-display');
      if (leaderACodeDisplay) { leaderACodeDisplay.style.display = 'none'; leaderACodeDisplay.innerHTML = ''; }

      if (document.getElementById('task-chutri-input')) document.getElementById('task-chutri-input').value = '';
      const chuTriCodeDisplay = document.getElementById('task-chutri-code-display');
      if (chuTriCodeDisplay) { chuTriCodeDisplay.style.display = 'none'; chuTriCodeDisplay.innerHTML = ''; }

      if (document.getElementById('task-phoihop-input')) document.getElementById('task-phoihop-input').value = '';
      const phoiHopCodeDisplay = document.getElementById('task-phoihop-code-display');
      if (phoiHopCodeDisplay) { phoiHopCodeDisplay.style.display = 'none'; phoiHopCodeDisplay.innerHTML = ''; }
    }
  } catch (err) {
    console.error('Error in openTaskModal:', err);
  } finally {
    openModal('modal-task');
  }
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

  const taskId = document.getElementById('task-id')?.value || '';
  const titleVal = document.getElementById('task-title-input')?.value || '';
  const descVal = document.getElementById('task-desc-input')?.value || '';
  const priorityVal = document.getElementById('task-priority-input')?.value || 'Trung bình';
  const statusVal = document.getElementById('task-status-input')?.value || 'Đang thực hiện';
  const startVal = document.getElementById('task-start-input')?.value || '';
  const endVal = document.getElementById('task-end-input')?.value || '';
  const kehoachVal = Number(document.getElementById('task-kehoach-input')?.value || 1);
  const thuchienVal = Number(document.getElementById('task-thuchien-input')?.value || 0);

  const toChuTriInput = document.getElementById('task-tochutri-input')?.value || '';
  const lanhDaoName = document.getElementById('task-lanhdao-input')?.value.trim() || 'Nguyễn Công Hoan';
  const leaderAName = document.getElementById('task-leadera-input')?.value.trim() || '';
  const chuTriName = document.getElementById('task-chutri-input')?.value.trim() || '';
  const phoiHopName = document.getElementById('task-phoihop-input')?.value.trim() || '';

  const lanhDaoCode = lookupEmpCodeByName(lanhDaoName);
  const leaderACode = lookupEmpCodeByName(leaderAName);
  const chuTriCode = lookupEmpCodeByName(chuTriName);
  const phoiHopCode = lookupEmpCodeByName(phoiHopName);

  const isToTruongTab = appState.currentTab === 'totruong' || appState.currentTab === 'totruonggiaoviec';

  if (isToTruongTab) {
    // === SAVE TO totruonggiaoviec sheet ===
    const newId = taskId || ('TT-' + Math.floor(1000 + Math.random() * 9000));

    const payload = {
      id: newId,
      'ID': newId,
      'Tiêu đề': titleVal,
      'Tiêu đề công việc': titleVal,
      'Mô tả': descVal,
      'Mô tả công việc': descVal,
      'Trạng thái': statusVal,
      'Tổ': toChuTriInput,
      'Tổ chủ trì (AR)': toChuTriInput,
      'Lãnh đạo': lanhDaoName,
      'Mã LĐ': lanhDaoCode,
      'Tên NV (A)': leaderAName || lanhDaoName,
      'Mã NV (A)': leaderACode || lanhDaoCode,
      'Tên NV (R)': chuTriName,
      'Mã NV (R)': chuTriCode,
      'Tên NV (C)': phoiHopName,
      'Mã NV (C)': phoiHopCode,
      'Ngày bắt đầu': startVal,
      'Ngày kết thúc': endVal,
      'Hạn hoàn thành': endVal,
      'Kế hoạch': kehoachVal,
      'Thực hiện': thuchienVal,
      'Tiến độ (%)': Number(document.getElementById('task-progress-input')?.value || 0),
      'Ghi chú': document.getElementById('task-ghichu-input')?.value || '',
      'Tệp đính kèm': document.getElementById('task-attachment-input')?.value || ''
    };

    // Update local state (totruonggiaoviec)
    if (!appState.totruonggiaoviec) appState.totruonggiaoviec = [];
    const existingIdx = appState.totruonggiaoviec.findIndex(t => String(t.ID || t.id) === String(newId));
    if (existingIdx >= 0) {
      appState.totruonggiaoviec[existingIdx] = { ...appState.totruonggiaoviec[existingIdx], ...payload };
    } else {
      appState.totruonggiaoviec.unshift(payload);
    }

    try { localStorage.setItem('TTHT_TOTRUONGGIAOVIEC_CACHE', JSON.stringify(appState.totruonggiaoviec)); } catch(e) {}

    clearTaskCaches();
    populateSelects();
    renderActiveTab();
    closeModal('modal-task');
    showToast('Đã lưu công việc tổ trưởng thành công!', 'success');

    callBackend('saveToTruongTask', payload);

  } else {
    // === SAVE TO congviec sheet ===
    const chuTriUser = appState.users.find(u => (u['Tên'] || u.name) === chuTriName);
    const phoiHopUser = appState.users.find(u => (u['Tên'] || u.name) === phoiHopName);
    const finalToChuTri = toChuTriInput || (chuTriUser ? (chuTriUser['Tổ'] || chuTriUser.group) : '');

    const newId = taskId || ('TSK-' + Math.floor(1000 + Math.random() * 9000));

    const payload = {
      id: newId,
      'ID': newId,
      'Tiêu đề': titleVal,
      'Mô tả': descVal,
      'Mức độ ưu tiên': priorityVal,
      'Trạng thái': statusVal,
      'Ngày bắt đầu': startVal,
      'Ngày kết thúc': endVal,
      'Kế hoạch': kehoachVal,
      'Thực hiện': thuchienVal,
      'Lãnh đạo': lanhDaoName,
      'Mã LĐ': lanhDaoCode,
      'Tên NV (A)': leaderAName,
      'Mã NV (A)': leaderACode,
      'Tên NV (R)': chuTriName,
      'Mã NV (R)': chuTriCode,
      'Tên NV (C)': phoiHopName,
      'Mã NV (C)': phoiHopCode,
      'Người chủ trì': chuTriName,
      'Tổ chủ trì': finalToChuTri,
      'Tổ chủ trì (AR)': finalToChuTri,
      'Tổ': finalToChuTri,
      'Người phối hợp': phoiHopName,
      'Tổ phối hợp': phoiHopUser ? (phoiHopUser['Tổ'] || phoiHopUser.group) : '',
      'Người thực hiện': chuTriName,
      'Người phụ trách': chuTriName,
      'Tiến độ (%)': Number(document.getElementById('task-progress-input')?.value || 0),
      'Ghi chú': document.getElementById('task-ghichu-input')?.value || '',
      subtasks: subtasks
    };

    const existingIdx = appState.tasks.findIndex(t => String(t.ID || t.id) === String(newId));
    if (existingIdx >= 0) {
      appState.tasks[existingIdx] = { ...appState.tasks[existingIdx], ...payload };
    } else {
      appState.tasks.unshift(payload);
    }

    try { localStorage.setItem('TTHT_TASKS_CACHE', JSON.stringify(appState.tasks)); } catch(e) {}

    populateSelects();
    renderActiveTab();
    closeModal('modal-task');
    showToast('Đã lưu công việc thành công!', 'success');

    callBackend('saveTask', payload);
  }
}

function confirmDeleteTask(id) {
  if (confirm('Bạn có chắc chắn muốn xóa công việc này?')) {
    appState.tasks = appState.tasks.filter(t => String(t.ID || t.id) !== String(id));
    try { localStorage.setItem('TTHT_TASKS_CACHE', JSON.stringify(appState.tasks)); } catch(e){}
    renderActiveTab();
    showToast('Đã xóa công việc!', 'success');
    callBackend('deleteTask', { id: id });
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
  const lyId = document.getElementById('ly-id')?.value || '';
  const newId = lyId || ('LY-' + Math.floor(1000 + Math.random() * 9000));

  const payload = {
    id: newId,
    'ID': newId,
    'Công việc': document.getElementById('ly-task')?.value || '',
    'Mô tả': document.getElementById('ly-desc')?.value || '',
    'Tổ': document.getElementById('ly-group')?.value || '',
    'Trạng thái': document.getElementById('ly-status')?.value || 'Cần lưu ý',
    'Ngày bắt đầu': document.getElementById('ly-start')?.value || '',
    'Ngày kết thúc': document.getElementById('ly-end')?.value || '',
    'Ghi chú': document.getElementById('ly-note')?.value || ''
  };

  const existingIdx = appState.cvluuy.findIndex(i => String(i.ID || i.id) === String(newId));
  if (existingIdx >= 0) {
    appState.cvluuy[existingIdx] = { ...appState.cvluuy[existingIdx], ...payload };
  } else {
    appState.cvluuy.unshift(payload);
  }

  try {
    localStorage.setItem('TTHT_CVLUUY_CACHE', JSON.stringify(appState.cvluuy));
  } catch (err) {}

  populateSelects();
  renderActiveTab();
  closeModal('modal-cvluuy');
  showToast('Đã lưu lưu ý thành công!', 'success');

  callBackend('saveCvLuuY', payload);
}

function confirmDeleteCvLuuY(id) {
  if (confirm('Xóa mục này?')) {
    appState.cvluuy = appState.cvluuy.filter(i => String(i.ID || i.id) !== String(id));
    try { localStorage.setItem('TTHT_CVLUUY_CACHE', JSON.stringify(appState.cvluuy)); } catch(e){}
    renderActiveTab();
    showToast('Đã xóa lưu ý!', 'success');
    callBackend('deleteCvLuuY', { id: id });
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

function getTovienRowInfo(row) {
  if (!row || typeof row !== 'object') return { group: '', leaderName: '', leaderCode: '', empName: '', empCode: '' };
  if (row._cachedInfo) return row._cachedInfo;

  let group = '';
  let leaderName = '';
  let leaderCode = '';
  let empName = '';
  let empCode = '';

  for (let k in row) {
    if (k.startsWith('_')) continue;
    const ck = cleanKey(k);
    const val = row[k] !== undefined && row[k] !== null ? String(row[k]).trim() : '';
    if (!val) continue;

    if (ck.includes('manvtotruong') || ck.includes('matotruong')) {
      leaderCode = val;
    } else if (ck.includes('tentotruong') || ck === 'totruong') {
      leaderName = val;
    } else if (ck === 'manv' || ck === 'manhanvien') {
      empCode = val;
    } else if (ck === 'tennv' || ck === 'tennhanvien' || ck === 'hovaten') {
      empName = val;
    } else if (ck === 'tohatang' || ck === 'tento' || ck === 'to' || ck === 'tochutri') {
      if (!group) group = val;
    }
  }

  if (!group) {
    for (let k in row) {
      if (k.startsWith('_')) continue;
      const ck = cleanKey(k);
      const val = row[k] !== undefined && row[k] !== null ? String(row[k]).trim() : '';
      if (val && (ck.includes('to') || ck.includes('donvi')) && !ck.includes('truong') && !ck.includes('vien') && !ck.includes('nv')) {
        group = val;
        break;
      }
    }
  }

  if (!empName) {
    for (let k in row) {
      if (k.startsWith('_')) continue;
      const ck = cleanKey(k);
      const val = row[k] !== undefined && row[k] !== null ? String(row[k]).trim() : '';
      if (val && (ck.includes('ten') || ck.includes('nhanvien') || ck.includes('nv')) && !ck.includes('totruong') && !ck.includes('to')) {
        empName = val;
        break;
      }
    }
  }

  const res = { group, leaderName, leaderCode, empName, empCode };
  row._cachedInfo = res;
  return res;
}

function getExactValueByKeyPattern(obj, targetKeys) {
  if (!obj || typeof obj !== 'object') return '';
  const targets = Array.isArray(targetKeys) ? targetKeys : [targetKeys];
  for (let tKey of targets) {
    const cleanT = cleanKey(tKey);
    for (let k in obj) {
      if (cleanKey(k) === cleanT) {
        if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
          return String(obj[k]).trim();
        }
      }
    }
  }
  return '';
}

function getToTruongTaskGroup(task) {
  if (!task || typeof task !== 'object') return '';
  const exact = getExactValueByKeyPattern(task, ['Tổ', 'Tổ chủ trì', 'Tổ chủ trì (AR)', 'Tổ hạ tầng', 'to', 'tochutri', 'tochutriar', 'tohatang']);
  if (exact) return exact;
  return task['Tổ chủ trì (AR)'] || task['Tổ'] || getTaskGroup(task) || '';
}

function getTaskLanhDaoName(t) {
  if (!t || typeof t !== 'object') return '';
  if (t['Lãnh đạo'] !== undefined && t['Lãnh đạo'] !== null && String(t['Lãnh đạo']).trim() !== '') {
    return String(t['Lãnh đạo']).trim();
  }
  return getExactValueByKeyPattern(t, ['Lãnh đạo', 'Lãnh Đạo', 'lanhdao']);
}

function getTaskLanhDaoCode(t) {
  if (!t || typeof t !== 'object') return '';
  if (t['Mã LĐ'] !== undefined && t['Mã LĐ'] !== null && String(t['Mã LĐ']).trim() !== '') {
    return String(t['Mã LĐ']).trim();
  }
  return getExactValueByKeyPattern(t, ['Mã LĐ', 'Mã Lanh dao', 'mald', 'malanhdao']);
}

function getTaskLeaderName(task) {
  if (!task || typeof task !== 'object') return '';
  const exact = getExactValueByKeyPattern(task, ['Tên NV (A)', 'Tên người giao việc', 'Tên tổ trưởng', 'tennva', 'tennguoigiaoviec', 'tentotruong']);
  if (exact) return exact;
  return task['Tên NV (A)'] || task['Tên người giao việc'] || task['Tên tổ trưởng'] || '';
}

function getTaskLeaderCode(task) {
  if (!task || typeof task !== 'object') return '';
  const exact = getExactValueByKeyPattern(task, ['Mã NV (A)', 'Mã người giao việc', 'Mã NV tổ trưởng', 'manva', 'manguoigiaoviec', 'manvtotruong']);
  if (exact) return exact;
  return task['Mã NV (A)'] || task['Mã người giao việc'] || task['Mã NV tổ trưởng'] || '';
}

function getTaskEmpRName(t) {
  if (!t || typeof t !== 'object') return '';
  if (t['Tên NV (R)'] !== undefined && t['Tên NV (R)'] !== null && String(t['Tên NV (R)']).trim() !== '') {
    return String(t['Tên NV (R)']).trim();
  }
  return getExactValueByKeyPattern(t, ['Tên NV (R)', 'Tên NV R', 'tennvr']);
}

function getTaskEmpRCode(t) {
  if (!t || typeof t !== 'object') return '';
  if (t['Mã NV (R)'] !== undefined && t['Mã NV (R)'] !== null && String(t['Mã NV (R)']).trim() !== '') {
    return String(t['Mã NV (R)']).trim();
  }
  return getExactValueByKeyPattern(t, ['Mã NV (R)', 'Mã NV R', 'manvr']);
}

function getTaskEmpCName(t) {
  if (!t || typeof t !== 'object') return '';
  if (t['Tên NV (C)'] !== undefined && t['Tên NV (C)'] !== null && String(t['Tên NV (C)']).trim() !== '') {
    return String(t['Tên NV (C)']).trim();
  }
  return getExactValueByKeyPattern(t, ['Tên NV (C)', 'Tên NV C', 'tennvc']);
}

function getTaskEmpCCode(t) {
  if (!t || typeof t !== 'object') return '';
  if (t['Mã NV (C)'] !== undefined && t['Mã NV (C)'] !== null && String(t['Mã NV (C)']).trim() !== '') {
    return String(t['Mã NV (C)']).trim();
  }
  return getExactValueByKeyPattern(t, ['Mã NV (C)', 'Mã NV C', 'manvc']);
}

function formatEmpNameWithCode(name, code) {
  if (!name || name === 'Chưa gán') {
    return '<span style="color:var(--text-muted); font-size:0.8rem;">-</span>';
  }
  const cleanName = escapeHtml(String(name).trim());
  const cleanCode = code ? escapeHtml(String(code).trim()) : '';

  return `
    <div style="line-height:1.25;">
      <div style="font-weight:600; color:#e2e8f0; font-size:0.84rem;">${cleanName}</div>
      ${cleanCode ? `<div style="font-size:0.73rem; color:#94a3b8; font-weight:400; margin-top:2px;">${cleanCode}</div>` : ''}
    </div>
  `;
}

function formatPhoiHopWithCode(name, code) {
  if (!name || name === '-' || name === 'Chưa có') {
    return '<span style="color:var(--text-muted); font-size:0.8rem;">-</span>';
  }
  const cleanName = escapeHtml(String(name).trim());
  const cleanCode = code ? escapeHtml(String(code).trim()) : '';

  return `
    <div style="line-height:1.25;">
      <div style="font-weight:600; color:#cbd5e1; font-size:0.84rem;">${cleanName}</div>
      ${cleanCode ? `<div style="font-size:0.73rem; color:#94a3b8; font-weight:400; margin-top:2px;">${cleanCode}</div>` : ''}
    </div>
  `;
}

function isLeaderUser(userName) {
  if (!userName) return false;
  const ck = cleanKey(userName);
  if (!ck) return false;

  if (getSubLeaderInfo(userName)) return true;

  if (appState.totruonggiaoviec && Array.isArray(appState.totruonggiaoviec)) {
    for (let i = 0; i < appState.totruonggiaoviec.length; i++) {
      const lName = getTaskLeaderName(appState.totruonggiaoviec[i]);
      if (lName && cleanKey(lName) === ck) return true;
    }
  }

  if (appState.tovien && Array.isArray(appState.tovien)) {
    for (let i = 0; i < appState.tovien.length; i++) {
      const info = getTovienRowInfo(appState.tovien[i]);
      if (info.leaderName && cleanKey(info.leaderName) === ck) return true;
    }
  }

  return false;
}

function getToTruongTasks() {
  // Determine data source
  const hasTTGV = appState.totruonggiaoviec && Array.isArray(appState.totruonggiaoviec) && appState.totruonggiaoviec.length > 0;
  const source = hasTTGV ? appState.totruonggiaoviec : appState.tasks;

  // Show/hide debug banner on the page
  let debugBanner = document.getElementById('totruong-debug-banner');
  if (!debugBanner) {
    debugBanner = document.createElement('div');
    debugBanner.id = 'totruong-debug-banner';
    debugBanner.style.cssText = 'padding:8px 16px; margin:4px 0; border-radius:8px; font-size:0.8rem; font-weight:600;';
    const container = document.getElementById('totruong-task-tbody')?.closest('.dark-card') || document.getElementById('totruong-task-tbody')?.parentElement;
    if (container) container.insertBefore(debugBanner, container.firstChild);
  }
  
  if (hasTTGV) {
    // Data loaded successfully - hide banner
    debugBanner.style.display = 'none';
  } else {
    debugBanner.style.display = 'block';
    debugBanner.style.background = 'rgba(239, 68, 68, 0.15)';
    debugBanner.style.color = '#ef4444';
    debugBanner.innerHTML = `⚠️ totruonggiaoviec TRỐNG — Đang tải dữ liệu... <button onclick="appState._toTruongBackupTriggered=false; loadToTruongBackup(); this.textContent='Đang tải...'" style="background:#ef4444;color:white;border:none;padding:2px 10px;border-radius:4px;cursor:pointer;margin-left:8px;">Tải lại</button>`;
    
    // Auto-trigger backup load if not already loading
    if (!appState._toTruongBackupTriggered) {
      appState._toTruongBackupTriggered = true;
      loadToTruongBackup();
    }
  }

  if (!source || !Array.isArray(source) || source.length === 0) {
    return [];
  }

  console.log('[getToTruongTasks] Using source:', hasTTGV ? 'totruonggiaoviec' : 'congviec(fallback)', 'Records:', source.length);

  // Debug: log raw keys from first record
  if (source.length > 0) {
    const sample = source[0];
    console.log('[getToTruongTasks] FIRST RECORD KEYS:', JSON.stringify(Object.keys(sample)));
  }

  return source.map(t => {
    // Scan ALL keys to find R, C, A, Tổ columns by cleanKey matching
    const allKeys = Object.keys(t);
    
    let rNameKey = '', rCodeKey = '', cNameKey = '', cCodeKey = '';
    let aNameKey = '', aCodeKey = '', toKey = '';
    
    for (const k of allKeys) {
      const ck = cleanKey(k);
      if (ck === 'tennvr') rNameKey = k;
      else if (ck === 'manvr') rCodeKey = k;
      else if (ck === 'tennvc') cNameKey = k;
      else if (ck === 'manvc') cCodeKey = k;
      else if (ck === 'tennva') aNameKey = k;
      else if (ck === 'manva') aCodeKey = k;
      else if (ck === 'to') toKey = k;
    }
    
    const title = t['Tiêu đề'] || t['Tiêu đề công việc'] || '';
    const desc = t['Mô tả'] || t['Mô tả công việc'] || '';

    // A column: leader / tổ trưởng
    const leaderName = aNameKey ? String(t[aNameKey] || '').trim() : getTaskLeaderName(t);
    const leaderCode = aCodeKey ? String(t[aCodeKey] || '').trim() : getTaskLeaderCode(t);

    // R column: ONLY read from totruonggiaoviec data, NEVER from congviec
    const empRName = rNameKey ? String(t[rNameKey] || '').trim() : (hasTTGV ? '' : getTaskAssignee(t));
    const empRCode = rCodeKey ? String(t[rCodeKey] || '').trim() : '';

    // C column: ONLY read from totruonggiaoviec data, NEVER from congviec
    const empCName = cNameKey ? String(t[cNameKey] || '').trim() : '';
    const empCCode = cCodeKey ? String(t[cCodeKey] || '').trim() : '';

    const toChuTri = toKey ? String(t[toKey] || '').trim() : getToTruongTaskGroup(t);

    return {
      ...t,
      'Tiêu đề công việc': title,
      'Tiêu đề': title,
      'Mô tả công việc': desc,
      'Mô tả': desc,
      'Tên NV (A)': leaderName,
      'Mã NV (A)': leaderCode,
      'Tên người giao việc': leaderName,
      'Tên tổ trưởng': leaderName,
      'Mã người giao việc': leaderCode,
      'Mã NV tổ trưởng': leaderCode,
      'Tên NV (R)': empRName,
      'Mã NV (R)': empRCode,
      'Tên NV (C)': empCName,
      'Mã NV (C)': empCCode,
      'Người chủ trì': empRName || leaderName,
      'Người phối hợp': empCName,
      'Tổ chủ trì': toChuTri,
      'Tổ': toChuTri,
      'Hạn hoàn thành': t['Ngày kết thúc'] || t['Hạn hoàn thành'] || '',
      'Ngày kết thúc': t['Ngày kết thúc'] || t['Hạn hoàn thành'] || '',
      'Tiến độ (%)': t['Tiến độ'] !== undefined ? t['Tiến độ'] : (t['Tiến độ (%)'] || 0)
    };
  });
}

/* ==============================================================================
 * TỔ TRƯỞNG GIAO VIỆC ENGINE
 * ============================================================================== */
function populateToTruongFilters() {
  const gSelect = document.getElementById('totruong-group-select');
  if (!gSelect) return;

  const currentGrp = gSelect.value;
  const groups = new Set();

  if (appState.tovien && Array.isArray(appState.tovien)) {
    let lastGroup = '';
    appState.tovien.forEach(row => {
      const info = getTovienRowInfo(row);
      if (info.group) lastGroup = info.group;
      if (lastGroup) groups.add(lastGroup);
    });
  }

  if (appState.users && Array.isArray(appState.users)) {
    appState.users.forEach(u => {
      const { group } = getUserNameAndGroup(u);
      if (group) groups.add(group);
    });
  }

  const toTruongTasks = getToTruongTasks();
  if (toTruongTasks && Array.isArray(toTruongTasks)) {
    toTruongTasks.forEach(t => {
      const tg = getTaskGroup(t);
      if (tg) groups.add(tg);
    });
  }

  const opts = ['<option value="">Tất cả tổ giao việc</option>'];
  Array.from(groups).sort().forEach(g => {
    opts.push(`<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`);
  });
  gSelect.innerHTML = opts.join('');

  if (currentGrp && Array.from(groups).includes(currentGrp)) {
    gSelect.value = currentGrp;
  }

  onToTruongGroupChange();
}

function getSubLeaderInfo(personName) {
  if (!personName) return null;
  const ck = cleanKey(personName);
  if (!ck) return null;

  if (ck.includes('vuthilanphuong') || ck.includes('lanphuong')) {
    return { title: 'Tổ phó', name: 'Vũ Thị Lan Phương', code: 'VNPT018275' };
  }
  if (ck.includes('tongtienmanh') || ck.includes('ngotienmanh') || ck.includes('tienmanh')) {
    return { title: 'Tổ phó', name: personName.trim(), code: 'VNPT018259' };
  }

  return null;
}

function getLeaderDisplayHtml(name, code) {
  if (!name) return '<span style="color:var(--text-muted); font-size:0.8rem;">-</span>';
  const subInfo = getSubLeaderInfo(name);
  if (subInfo) {
    return `<span style="color:#38bdf8; font-weight:600; font-size:0.82rem;"><i class="fa-solid fa-user-tie" style="margin-right:4px; color:#38bdf8;"></i>Tổ phó: ${escapeHtml(subInfo.name)} ${subInfo.code ? `<span style="font-weight:normal; opacity:0.8;">(${escapeHtml(subInfo.code)})</span>` : ''}</span>`;
  }
  return `<span style="color:#00c897; font-weight:600; font-size:0.82rem;"><i class="fa-solid fa-user-tie" style="margin-right:4px; color:#00c897;"></i>Tổ trưởng: ${escapeHtml(name)} ${code ? `<span style="font-weight:normal; opacity:0.8;">(${escapeHtml(code)})</span>` : ''}</span>`;
}

function filterToTruongByLeader(leaderName) {
  const uSelect = document.getElementById('totruong-user-select');
  if (!uSelect) return;

  uSelect.value = leaderName;
  onToTruongGroupChange();
}

function onToTruongGroupChange() {
  const gSelect = document.getElementById('totruong-group-select');
  const uSelect = document.getElementById('totruong-user-select');
  if (!gSelect || !uSelect) return;

  const selGroup = gSelect.value;
  const selGrpClean = cleanKey(selGroup);
  const currentUsr = uSelect.value;
  const teamUsers = new Set();
  const leadersMap = new Map(); // key: cleanKey(name), val: { name, code }

  if (selGrpClean) {
    if (appState.tovien && Array.isArray(appState.tovien)) {
      let lastGroup = '';
      appState.tovien.forEach(row => {
        const info = getTovienRowInfo(row);
        if (info.group) {
          lastGroup = info.group;
        } else if (lastGroup) {
          info.group = lastGroup;
        }

        const ckG = cleanKey(info.group);
        if (ckG && (ckG.includes(selGrpClean) || selGrpClean.includes(ckG))) {
          if (info.empName) teamUsers.add(info.empName);
          if (info.leaderName) {
            teamUsers.add(info.leaderName);
            leadersMap.set(cleanKey(info.leaderName), { name: info.leaderName, code: info.leaderCode });
          }
        }
      });
    }

    if (appState.users && Array.isArray(appState.users)) {
      appState.users.forEach(u => {
        const { name, group } = getUserNameAndGroup(u);
        const ckG = cleanKey(group);
        if (ckG && (ckG.includes(selGrpClean) || selGrpClean.includes(ckG)) && name) {
          teamUsers.add(name);
        }
      });
    }

    const toTruongTasks = getToTruongTasks();
    if (toTruongTasks && Array.isArray(toTruongTasks)) {
      toTruongTasks.forEach(t => {
        const tg = t['Tổ'] || getTaskGroup(t);
        const ckTg = cleanKey(tg);
        if (ckTg && (ckTg.includes(selGrpClean) || selGrpClean.includes(ckTg))) {
          const lName = getTaskLeaderName(t);
          const lCode = getTaskLeaderCode(t);
          if (lName) {
            leadersMap.set(cleanKey(lName), { name: lName, code: lCode });
          }
          const empR = getTaskEmpRName(t);
          if (empR) {
            empR.split(',').forEach(n => { if (n.trim()) teamUsers.add(n.trim()); });
          }
        }
      });
    }
    Array.from(teamUsers).forEach(uName => {
      const sub = getSubLeaderInfo(uName);
      if (sub) {
        leadersMap.set(cleanKey(sub.name), { name: sub.name, code: sub.code });
      }
    });
  } else {
    if (appState.tovien && Array.isArray(appState.tovien)) {
      appState.tovien.forEach(row => {
        const info = getTovienRowInfo(row);
        if (info.empName) teamUsers.add(info.empName);
        if (info.leaderName) teamUsers.add(info.leaderName);
      });
    }
    if (appState.users && Array.isArray(appState.users)) {
      appState.users.forEach(u => {
        const { name } = getUserNameAndGroup(u);
        if (name) teamUsers.add(name);
      });
    }
  }

  const leaderBanner = document.getElementById('totruong-leader-info-banner');
  if (leaderBanner) {
    if (selGroup) {
      leaderBanner.style.display = 'inline-flex';
      let leaderPills = [];

      leadersMap.forEach(l => {
        const sub = getSubLeaderInfo(l.name);
        const roleTitle = sub ? sub.title : 'Tổ trưởng';
        const roleColor = sub ? '#38bdf8' : '#00c897';
        const isSelected = cleanKey(currentUsr) === cleanKey(l.name);

        leaderPills.push(`
          <span class="leader-badge-pill ${isSelected ? 'active-pill' : ''}" 
                onclick="filterToTruongByLeader('${escapeHtml(l.name)}')" 
                style="cursor:pointer; padding:5px 12px; border-radius:20px; background:${isSelected ? (sub ? 'rgba(56, 189, 248, 0.35)' : 'rgba(0, 200, 151, 0.35)') : 'rgba(255,255,255,0.06)'}; border:${isSelected ? `2px solid ${roleColor}` : `1px solid ${roleColor}`}; color:${roleColor}; font-weight:700; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s; user-select:none;"
                title="Bấm để xem các công việc do ${roleTitle} ${escapeHtml(l.name)} giao">
            <i class="fa-solid fa-user-tie"></i> <strong>${roleTitle}:</strong>&nbsp;${escapeHtml(l.name)} ${l.code ? `<span style="font-weight:normal; opacity:0.8;">(${escapeHtml(l.code)})</span>` : ''}
          </span>
        `);
      });

      if (leaderPills.length > 0) {
        leaderBanner.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; width:100%;">
            ${leaderPills.join('')}
            <span style="margin:0 4px; opacity:0.3;">|</span>
            <span style="color:#e2e8f0;"><i class="fa-solid fa-users" style="color:#a78bfa; margin-right:4px;"></i> <strong>Tổng nhân viên trong tổ:</strong>&nbsp;<span style="color:#ffffff; font-weight:700;">${teamUsers.size}</span></span>
          </div>
        `;
      } else {
        leaderBanner.innerHTML = `<i class="fa-solid fa-users" style="color:#a78bfa; margin-right:6px;"></i> <strong>Tổng nhân viên trong tổ:</strong>&nbsp;<span style="color:#ffffff; font-weight:700;">${teamUsers.size}</span>`;
      }
    } else {
      leaderBanner.style.display = 'none';
    }
  }

  const uOpts = ['<option value="">Tất cả nhân viên trong tổ</option>'];
  Array.from(teamUsers).sort().forEach(u => {
    uOpts.push(`<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`);
  });
  uSelect.innerHTML = uOpts.join('');

  if (currentUsr && Array.from(teamUsers).includes(currentUsr)) {
    uSelect.value = currentUsr;
  }

  renderToTruongTaskList();
}

function renderToTruongTaskList() {
  const tbody = document.getElementById('totruong-task-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const selGroup = document.getElementById('totruong-group-select')?.value || '';
  const selUser = document.getElementById('totruong-user-select')?.value || '';
  const searchQuery = (document.getElementById('totruong-search-input')?.value || '').trim().toLowerCase();

  const grpClean = cleanKey(selGroup);
  const usrClean = cleanKey(selUser);

  const currentTeamUsers = new Set();
  if (grpClean) {
    if (appState.tovien && Array.isArray(appState.tovien)) {
      appState.tovien.forEach(row => {
        const info = getTovienRowInfo(row);
        const ckG = cleanKey(info.group);
        if (ckG && (ckG.includes(grpClean) || grpClean.includes(ckG))) {
          if (info.empName) currentTeamUsers.add(cleanKey(info.empName));
          if (info.leaderName) currentTeamUsers.add(cleanKey(info.leaderName));
        }
      });
    }
  }

  const toTruongTasks = getToTruongTasks();
  let filtered = toTruongTasks.filter(t => {
    const chuTri = getTaskAssignee(t);
    const phoiHop = getTaskCollaborator(t);
    const toChuTri = getTaskGroup(t);
    const toPhoiHop = getTaskCollaboratorGroup(t);

    if (searchQuery) {
      const titleMatch = (t['Tiêu đề công việc'] || t['Tiêu đề'] || '').toLowerCase().includes(searchQuery);
      const descMatch = (t['Mô tả công việc'] || t['Mô tả'] || '').toLowerCase().includes(searchQuery);
      const chuTriMatch = chuTri.toLowerCase().includes(searchQuery);
      const phoiHopMatch = phoiHop.toLowerCase().includes(searchQuery);
      if (!titleMatch && !descMatch && !chuTriMatch && !phoiHopMatch) return false;
    }

    if (grpClean) {
      const taskGroup = getToTruongTaskGroup(t);
      const tgClean = cleanKey(taskGroup);
      const rawLeaderName = getTaskLeaderName(t);
      const taskLeaderClean = cleanKey(rawLeaderName);

      let matchGroup = false;
      if (tgClean && (tgClean.includes(grpClean) || grpClean.includes(tgClean))) {
        matchGroup = true;
      }
      if (!matchGroup && taskLeaderClean) {
        if (currentTeamUsers.has(taskLeaderClean) || currentTeamUsers.has(rawLeaderName)) {
          matchGroup = true;
        }
      }
      if (!matchGroup) {
        // If task has no group and no leader, allow if group clean matches fallback
        const fallbackGroup = cleanKey(getTaskGroup(t));
        if (fallbackGroup && (fallbackGroup.includes(grpClean) || grpClean.includes(fallbackGroup))) {
          matchGroup = true;
        }
      }

      if (!matchGroup) return false;
    }

    if (usrClean) {
      const leaderNameClean = cleanKey(getTaskLeaderName(t));
      const leaderCodeClean = cleanKey(getTaskLeaderCode(t));

      const empRNameClean = cleanKey(getTaskEmpRName(t));
      const empRCodeClean = cleanKey(getTaskEmpRCode(t));

      const empCNameClean = cleanKey(getTaskEmpCName(t));
      const empCCodeClean = cleanKey(getTaskEmpCCode(t));

      const subInfo = getSubLeaderInfo(selUser);
      const subCode = subInfo ? cleanKey(subInfo.code) : '';

      let match = false;

      // 1. Leader match (A)
      if (leaderNameClean && (leaderNameClean.includes(usrClean) || usrClean.includes(leaderNameClean))) {
        match = true;
      }
      if (!match && subCode && leaderCodeClean && leaderCodeClean === subCode) {
        match = true;
      }

      // 2. Assignee match (R)
      if (!match && empRNameClean && (empRNameClean.includes(usrClean) || usrClean.includes(empRNameClean))) {
        match = true;
      }
      if (!match && empRCodeClean && (empRCodeClean.includes(usrClean) || usrClean.includes(empRCodeClean))) {
        match = true;
      }

      // 3. Collaborator match (C)
      if (!match && empCNameClean && (empCNameClean.includes(usrClean) || usrClean.includes(empCNameClean))) {
        match = true;
      }
      if (!match && empCCodeClean && (empCCodeClean.includes(usrClean) || usrClean.includes(empCCodeClean))) {
        match = true;
      }

      if (!match) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="15" style="text-align:center; padding:30px; color:var(--text-muted);">Không tìm thấy công việc nào phù hợp với bộ lọc Tổ trưởng.</td>
      </tr>
    `;
    return;
  }

  const rowsHtml = [];
  filtered.forEach((t, idx) => {
    const taskId = t.ID || t.id;
    let status = t['Trạng thái'] || 'Đang thực hiện';

    // Auto-detect overdue: if NGÀY LÀM XONG is empty and today > HẠN HOÀN THÀNH → Quá hạn
    const _nlx = t['Ngày làm xong'] || t['Ngày hoàn thành'] || '';
    const _hht = t['Hạn hoàn thành'] || t['Ngày kết thúc'] || '';
    if (!_nlx && _hht && status !== 'Hoàn thành' && status !== 'Hoàn thành quá hạn') {
      try {
        const deadline = new Date(_hht);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        deadline.setHours(0, 0, 0, 0);
        if (!isNaN(deadline.getTime()) && today > deadline) {
          status = 'Quá hạn';
        }
      } catch(e) {}
    }

    let statusBadge = '';
    if (status === 'Hoàn thành quá hạn') {
      statusBadge = `<span style="color:#f59e0b; font-weight:600; background:rgba(245, 158, 11, 0.15); padding:2px 8px; border-radius:12px; font-size:0.75rem;">Hoàn thành quá hạn</span>`;
    } else if (status === 'Quá hạn') {
      statusBadge = `<span class="tag-status-overdue">Quá hạn</span>`;
    } else if (status === 'Hoàn thành') {
      statusBadge = `<span style="color:#10b981; font-weight:600;">Hoàn thành</span>`;
    } else {
      statusBadge = `<span style="color:#94a3b8; font-size:0.78rem;">${escapeHtml(status)}</span>`;
    }

    const progress = Number(t['Tiến độ (%)'] || 0);
    const keHoach = t['Kế hoạch'] !== undefined && t['Kế hoạch'] !== '' ? t['Kế hoạch'] : 1;
    const thucHien = t['Thực hiện'] !== undefined && t['Thực hiện'] !== '' ? t['Thực hiện'] : 0;
    const tyLe = t['Tỷ lệ'] || (keHoach > 0 ? Math.round((thucHien / keHoach) * 100) + '%' : '0%');
    const ghiChu = t['Ghi chú'] || '';
    const ngayLamXong = t['Ngày làm xong'] || '';
    const empRName = t['Tên NV (R)'] || '';
    const empRCode = t['Mã NV (R)'] || '';
    const empCName = t['Tên NV (C)'] || '';
    const empCCode = t['Mã NV (C)'] || '';

    rowsHtml.push(`
      <tr>
        <td style="text-align:center; font-weight:700; color:#38bdf8;">${idx + 1}</td>
        <td class="col-title-cell"><strong style="color:#ffffff;">${escapeHtml(t['Tiêu đề công việc'] || t['Tiêu đề'] || '')}</strong></td>
        <td class="col-desc-cell">${escapeHtml(t['Mô tả công việc'] || t['Mô tả'] || '')}</td>
        <td class="status-col-cell">${statusBadge}</td>
        <td>${formatEmpNameWithCode(empRName, empRCode)}</td>
        <td>${formatPhoiHopWithCode(empCName, empCCode)}</td>
        <td>${formatDateVN(t['Ngày bắt đầu'])}</td>
        <td>${formatDateVN(t['Ngày kết thúc'] || t['Hạn hoàn thành'])}</td>
        <td>
          <input type="date" class="inline-date-picker" value="${ngayLamXong}" onchange="handleToTruongInlineChange('${taskId}', 'ngayLamXong', this.value, this)">
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
          <input type="number" class="inline-note-input" style="width:50px; text-align:center; padding:3px;" value="${thucHien}" onchange="handleToTruongInlineChange('${taskId}', 'thucHien', this.value, this)" oninput="handleToTruongInlineChange('${taskId}', 'thucHien', this.value, this)">
        </td>
        <td class="ty-le-col-cell"><strong style="color:var(--emerald-primary);">${tyLe}</strong></td>
        <td class="col-note-cell">
          <textarea class="inline-note-textarea" placeholder="Nhập ghi chú..." oninput="autoResizeTextarea(this); handleToTruongInlineChange('${taskId}', 'ghiChu', this.value, this)" onchange="handleToTruongInlineChange('${taskId}', 'ghiChu', this.value, this)">${escapeHtml(ghiChu)}</textarea>
        </td>
        <td style="text-align:center;">
          <div style="display:flex; gap:4px; justify-content:center;">
            <button class="btn-action-edit" title="Sửa công việc" onclick="openTaskModal('${taskId}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-action-delete" title="Xóa công việc" onclick="confirmDeleteTask('${taskId}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `);
  });

  tbody.innerHTML = rowsHtml.join('');

  setTimeout(() => {
    document.querySelectorAll('#totruong-task-tbody .inline-note-textarea').forEach(autoResizeTextarea);
  }, 50);
}

// Manual sync button: force refresh ALL data from Google Sheets
function syncToTruongFromSheet() {
  showToast('Đang đồng bộ dữ liệu từ Google Sheet...', 'info');
  
  // Clear all caches to force fresh data
  try {
    localStorage.removeItem('TTHT_TOTRUONGGIAOVIEC_CACHE');
    localStorage.removeItem('TTHT_TASKS_CACHE');
    localStorage.removeItem('TTHT_USERS_CACHE');
    localStorage.removeItem('TTHT_TOVIEN_CACHE');
    localStorage.removeItem('TTHT_CVLUUY_CACHE');
  } catch(e) {}
  
  // Clear internal caches
  clearTaskCaches();
  if (appState.tovien && Array.isArray(appState.tovien)) {
    appState.tovien.forEach(row => delete row._cachedInfo);
  }
  
  // Force reload from server
  appState.loadData(true, true);
  
  // Also trigger independent backup load for totruonggiaoviec
  appState._toTruongBackupTriggered = false;
  loadToTruongBackup();
}

function openTaskModalForTeamLeader() {
  const selGroup = document.getElementById('totruong-group-select')?.value || '';
  const selUser = document.getElementById('totruong-user-select')?.value || '';

  openTaskModal();

  if (selGroup) {
    const toInput = document.getElementById('task-tochutri-input');
    if (toInput) toInput.value = selGroup;
    handleModalGroupChange(selGroup);
  }

  if (selUser) {
    const userInput = document.getElementById('task-chutri-input');
    if (userInput) userInput.value = selUser;
  }
}

// Inline change handler for totruonggiaoviec tab - saves to totruonggiaoviec sheet ONLY
function handleToTruongInlineChange(taskId, field, value, element) {
  // Find task in totruonggiaoviec data
  const toTruongTasks = getToTruongTasks();
  const task = toTruongTasks.find(t => String(t.ID || t.id) === String(taskId));
  
  // Also find in raw appState.totruonggiaoviec 
  const rawTask = appState.totruonggiaoviec ? appState.totruonggiaoviec.find(t => String(t.ID || t.id) === String(taskId)) : null;
  
  if (!task && !rawTask) {
    console.warn('[handleToTruongInlineChange] Task not found in totruonggiaoviec:', taskId);
    return;
  }

  const payload = { id: taskId };

  if (field === 'ghiChu') {
    if (rawTask) rawTask['Ghi chú'] = value;
    payload.ghiChu = value;
    try { localStorage.setItem('TTHT_TOTRUONGGIAOVIEC_CACHE', JSON.stringify(appState.totruonggiaoviec)); } catch(e) {}

    if (noteDebounceTimers['tt_' + taskId]) clearTimeout(noteDebounceTimers['tt_' + taskId]);
    noteDebounceTimers['tt_' + taskId] = setTimeout(() => {
      callBackendSilent('updateToTruongTaskInline', payload);
    }, 500);
    return;
  }

  if (field === 'ngayLamXong') {
    if (rawTask) rawTask['Ngày làm xong'] = value;
    payload.ngayLamXong = value;

    if (value) {
      if (rawTask) {
        rawTask['Tiến độ (%)'] = 100;
        const endDate = rawTask['Ngày kết thúc'] || rawTask['Hạn hoàn thành'] || '';
        rawTask['Trạng thái'] = (endDate && value > endDate) ? 'Hoàn thành quá hạn' : 'Hoàn thành';
      }
    } else {
      if (rawTask) {
        const kh = Number(rawTask['Kế hoạch'] || 1);
        const th = Number(rawTask['Thực hiện'] || 0);
        rawTask['Tiến độ (%)'] = kh > 0 ? Math.min(100, Math.round((th / kh) * 100)) : 0;
        const endDate = rawTask['Ngày kết thúc'] || rawTask['Hạn hoàn thành'] || '';
        const todayStr = new Date().toISOString().split('T')[0];
        rawTask['Trạng thái'] = (endDate && todayStr > endDate && rawTask['Tiến độ (%)'] < 100) ? 'Quá hạn' : 'Đang thực hiện';
      }
    }

    if (rawTask) {
      payload.progress = rawTask['Tiến độ (%)'];
      payload.status = rawTask['Trạng thái'];
    }

    try { localStorage.setItem('TTHT_TOTRUONGGIAOVIEC_CACHE', JSON.stringify(appState.totruonggiaoviec)); } catch(e) {}

    // Update UI inline
    if (element) {
      const tr = element.closest('tr');
      if (tr) {
        const progressCell = tr.querySelector('.progress-col-cell');
        const pct = rawTask ? rawTask['Tiến độ (%)'] : 0;
        if (progressCell) {
          progressCell.innerHTML = `
            <div style="display:flex; align-items:center; gap:6px; justify-content:center;">
              <div style="width:45px; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:var(--emerald-primary);"></div>
              </div>
              <span style="font-size:0.75rem; color:#94a3b8;">${pct}%</span>
            </div>
          `;
        }
        const statusCell = tr.querySelector('.status-col-cell');
        const st = rawTask ? rawTask['Trạng thái'] : '';
        if (statusCell) {
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

    callBackendSilent('updateToTruongTaskInline', payload);
    return;
  }

  if (field === 'thucHien') {
    const thVal = Number(value || 0);
    if (rawTask) {
      rawTask['Thực hiện'] = thVal;
      const kh = Number(rawTask['Kế hoạch'] || 1);
      const pct = kh > 0 ? Math.min(100, Math.round((thVal / kh) * 100)) : 0;
      rawTask['Tiến độ (%)'] = pct;
    }
    payload.thucHien = thVal;

    try { localStorage.setItem('TTHT_TOTRUONGGIAOVIEC_CACHE', JSON.stringify(appState.totruonggiaoviec)); } catch(e) {}

    if (element) {
      const tr = element.closest('tr');
      if (tr) {
        const progressCell = tr.querySelector('.progress-col-cell');
        const pct = rawTask ? rawTask['Tiến độ (%)'] : 0;
        if (progressCell) {
          progressCell.innerHTML = `
            <div style="display:flex; align-items:center; gap:6px; justify-content:center;">
              <div style="width:45px; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:var(--emerald-primary);"></div>
              </div>
              <span style="font-size:0.75rem; color:#94a3b8;">${pct}%</span>
            </div>
          `;
        }
        const tyLeCell = tr.querySelector('.ty-le-col-cell');
        if (tyLeCell && rawTask) {
          const kh = Number(rawTask['Kế hoạch'] || 1);
          tyLeCell.innerHTML = `<strong style="color:var(--emerald-primary);">${kh > 0 ? Math.round((thVal / kh) * 100) : 0}%</strong>`;
        }
      }
    }

    callBackendSilent('updateToTruongTaskInline', payload);
    return;
  }
}
