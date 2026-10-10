// main.js
const STORAGE_KEY = "studyTaskData";
let data = { tasks: [], days: {} };
let currentDate = null;
let runningTimerId = null;
let runningSessionSeconds = 0;
let runningBaseSeconds = 0;
let runningTaskId = null;
let confirmActionResolver = null;

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${y}/${m}/${day} (${w})`;
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { tasks: [], days: {} };
    }
  }
  if (!data.tasks) data.tasks = [];
  if (!data.days) data.days = {};
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function showConfirmation(message) {
  const overlay = document.getElementById("confirmOverlay");
  document.getElementById("confirmMessage").textContent = message;
  overlay.classList.remove("hidden");
  document.getElementById("confirmCancelBtn").focus();
  return new Promise(resolve => {
    confirmActionResolver = resolve;
  });
}

function resolveConfirmation(confirmed) {
  if (!confirmActionResolver) return;
  const resolve = confirmActionResolver;
  confirmActionResolver = null;
  document.getElementById("confirmOverlay").classList.add("hidden");
  resolve(confirmed);
}

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ensureDay(dateStr) {
  if (!data.days[dateStr]) {
    data.days[dateStr] = [];
  }
}

function renderDateList() {
  const listEl = document.getElementById("dateList");
  listEl.innerHTML = "";
  const dates = Object.keys(data.days).sort();
  dates.forEach(dateStr => {
    const li = document.createElement("li");
    li.className = "date-item";
    if (dateStr === currentDate) {
      li.classList.add("active");
    }
    const spanLabel = document.createElement("span");
    spanLabel.textContent = formatDateLabel(dateStr);
    li.appendChild(spanLabel);
    li.onclick = () => {
      currentDate = dateStr;
      renderDateList();
      renderTaskList();
    };
    listEl.appendChild(li);
  });
}

function renderTaskMasterList() {
  const dl = document.getElementById("taskMasterList");
  dl.innerHTML = "";
  const uniqueNames = Array.from(new Set(data.tasks));
  uniqueNames.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    dl.appendChild(opt);
  });
}

function getTaskDurationSeconds(task, property) {
  const minutes = task[property];
  return Number.isFinite(minutes) ? Math.max(0, Math.round(minutes * 60)) : null;
}

function createDurationControls(totalSeconds, onChange, allowEmpty = false) {
  const controls = document.createElement("div");
  controls.className = "duration-controls";

  const minutesSelect = document.createElement("select");
  minutesSelect.className = "duration-select";
  const secondsSelect = document.createElement("select");
  secondsSelect.className = "duration-select";

  if (allowEmpty) {
    [minutesSelect, secondsSelect].forEach(select => {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "";
      select.appendChild(option);
    });
  }

  const selectedMinutes = totalSeconds == null ? null : Math.floor(totalSeconds / 60);
  const selectedSeconds = totalSeconds == null ? null : totalSeconds % 60;
  const minuteLimit = Math.max(180, selectedMinutes || 0);
  for (let minute = 0; minute <= minuteLimit; minute += 1) {
    const option = document.createElement("option");
    option.value = String(minute);
    option.textContent = String(minute);
    minutesSelect.appendChild(option);
  }
  for (let second = 0; second < 60; second += 1) {
    const option = document.createElement("option");
    option.value = String(second);
    option.textContent = String(second);
    secondsSelect.appendChild(option);
  }

  if (totalSeconds == null) {
    minutesSelect.value = "";
    secondsSelect.value = "";
  } else {
    minutesSelect.value = String(selectedMinutes);
    secondsSelect.value = String(selectedSeconds);
  }

  const handleChange = () => {
    const minutes = parseInt(minutesSelect.value || "0", 10);
    const seconds = parseInt(secondsSelect.value || "0", 10);
    minutesSelect.value = String(minutes);
    secondsSelect.value = String(seconds);
    onChange(minutes * 60 + seconds);
  };
  minutesSelect.onchange = handleChange;
  secondsSelect.onchange = handleChange;

  controls.appendChild(minutesSelect);
  const minuteLabel = document.createElement("span");
  minuteLabel.className = "duration-unit";
  minuteLabel.textContent = "分";
  controls.appendChild(minuteLabel);
  controls.appendChild(secondsSelect);
  const secondLabel = document.createElement("span");
  secondLabel.className = "duration-unit";
  secondLabel.textContent = "秒";
  controls.appendChild(secondLabel);
  return controls;
}

function createTaskRow(task, index) {
  const tr = document.createElement("tr");
  const tdCheck = document.createElement("td");
  tdCheck.className = "checkbox-cell";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!task.completed;
  cb.onchange = () => {
    task.completed = cb.checked;
    saveData();
  };
  tdCheck.appendChild(cb);
  tr.appendChild(tdCheck);
  const tdName = document.createElement("td");
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "task-name-input";
  nameInput.setAttribute("list", "taskMasterList");
  nameInput.value = task.name || "";
  nameInput.onchange = () => {
    task.name = nameInput.value.trim();
    if (task.name) {
      data.tasks.push(task.name);
      renderTaskMasterList();
    }
    saveData();
  };
  tdName.appendChild(nameInput);
  tr.appendChild(tdName);
  const tdPlanned = document.createElement("td");
  const plannedSeconds = getTaskDurationSeconds(task, "plannedMinutes");
  tdPlanned.appendChild(createDurationControls(
    plannedSeconds == null ? 30 * 60 : plannedSeconds,
    totalSeconds => {
      task.plannedMinutes = totalSeconds / 60;
      saveData();
    }
  ));
  tr.appendChild(tdPlanned);
  const tdActual = document.createElement("td");
  tdActual.appendChild(createDurationControls(
    getTaskDurationSeconds(task, "actualMinutes"),
    totalSeconds => {
      task.actualMinutes = totalSeconds / 60;
      saveData();
    },
    true
  ));
  tr.appendChild(tdActual);
  const tdAction = document.createElement("td");
  tdAction.className = "action-buttons";
  const startBtn = document.createElement("button");
  startBtn.textContent = "進める";
  startBtn.onclick = () => {
    openOverlayForTask(task);
  };
  tdAction.appendChild(startBtn);
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-task-btn";
  deleteBtn.textContent = "削除";
  deleteBtn.setAttribute("aria-label", `${task.name || "選択されたタスク"}を削除`);
  deleteBtn.onclick = async () => {
    const taskName = task.name || "(タスク名未入力)";
    if (!await showConfirmation(`選択されたタスク\n\n${taskName}\n\nを削除しますか？`)) return;
    if (runningTaskId === task.id) closeOverlay();
    data.days[currentDate].splice(index, 1);
    saveData();
    renderTaskList();
  };
  tdAction.appendChild(deleteBtn);
  tr.appendChild(tdAction);
  return tr;
}

function renderTaskList() {
  const titleEl = document.getElementById("taskListTitle");
  if (currentDate) {
    titleEl.textContent = `タスク一覧: ${formatDateLabel(currentDate)}`;
  } else {
    titleEl.textContent = "タスク一覧";
  }
  const tbody = document.getElementById("taskTableBody");
  tbody.innerHTML = "";
  if (!currentDate) return;
  ensureDay(currentDate);
  const tasks = data.days[currentDate];
  tasks.forEach((task, index) => {
    const tr = createTaskRow(task, index);
    tbody.appendChild(tr);
  });
}

function addTaskToCurrentDate() {
  if (!currentDate) return;
  ensureDay(currentDate);
  const newTask = {
    id: Date.now() + "_" + Math.random().toString(16).slice(2),
    name: "",
    plannedMinutes: 30,
    actualMinutes: null,
    completed: false
  };
  data.days[currentDate].push(newTask);
  saveData();
  renderTaskList();
}

function openOverlayForTask(task) {
  const overlay = document.getElementById("overlay");
  const nameEl = document.getElementById("overlayTaskName");
  const dateEl = document.getElementById("overlayDate");
  const timerEl = document.getElementById("overlayTimer");
  nameEl.textContent = task.name || "(タスク名未入力)";
  dateEl.textContent = formatDateLabel(currentDate);
  runningTaskId = task.id;
  runningBaseSeconds = getTaskDurationSeconds(task, "actualMinutes") || 0;
  runningSessionSeconds = 0;
  timerEl.textContent = "00:00";
  const startBtn = document.getElementById("overlayStartBtn");
  const pauseBtn = document.getElementById("overlayPauseBtn");
  const finishBtn = document.getElementById("overlayFinishBtn");
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  finishBtn.disabled = false;
  overlay.classList.remove("hidden");
}

function closeOverlay() {
  const overlay = document.getElementById("overlay");
  overlay.classList.add("hidden");
  stopTimer();
  runningTaskId = null;
  runningSessionSeconds = 0;
  runningBaseSeconds = 0;
}

function updateOverlayTimerDisplay() {
  const timerEl = document.getElementById("overlayTimer");
  const totalSeconds = runningSessionSeconds;
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  timerEl.textContent = `${m}:${s}`;
}

function startTimer() {
  if (runningTimerId) return;
  const startBtn = document.getElementById("overlayStartBtn");
  const pauseBtn = document.getElementById("overlayPauseBtn");
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  runningTimerId = setInterval(() => {
    runningSessionSeconds += 1;
    updateOverlayTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (runningTimerId) {
    clearInterval(runningTimerId);
    runningTimerId = null;
  }
  const startBtn = document.getElementById("overlayStartBtn");
  const pauseBtn = document.getElementById("overlayPauseBtn");
  if (startBtn && pauseBtn) {
    startBtn.disabled = false;
    pauseBtn.disabled = true;
  }
}

function applySessionToTask(markCompleted) {
  if (!currentDate || !runningTaskId) return;
  ensureDay(currentDate);
  const tasks = data.days[currentDate];
  const task = tasks.find(t => t.id === runningTaskId);
  if (!task) return;
  task.actualMinutes = (runningBaseSeconds + runningSessionSeconds) / 60;
  if (markCompleted) {
    task.completed = true;
  }
  saveData();
  renderTaskList();
}

function init() {
  loadData();
  const todayStr = getTodayStr();
  document.getElementById("todayText").textContent = formatDateLabel(todayStr);
  const datePicker = document.getElementById("datePicker");
  datePicker.value = todayStr;
  if (!data.days[todayStr]) {
    data.days[todayStr] = [];
    saveData();
  }
  currentDate = todayStr;
  renderDateList();
  renderTaskMasterList();
  renderTaskList();
  document.getElementById("addDateBtn").onclick = () => {
    const selected = datePicker.value;
    if (!selected) return;
    ensureDay(selected);
    currentDate = selected;
    saveData();
    renderDateList();
    renderTaskList();
  };
  document.getElementById("addTaskBtn").onclick = () => {
    addTaskToCurrentDate();
  };
  document.getElementById("clearTasksBtn").onclick = async () => {
    if (!currentDate) return;
    const dateLabel = formatDateLabel(currentDate);
    if (!await showConfirmation(`${dateLabel}の\nすべてのタスクを削除しますか？`)) return;
    if (data.days[currentDate].some(task => task.id === runningTaskId)) closeOverlay();
    data.days[currentDate] = [];
    saveData();
    renderTaskList();
  };
  document.getElementById("confirmAcceptBtn").onclick = () => {
    resolveConfirmation(true);
  };
  document.getElementById("confirmCancelBtn").onclick = () => {
    resolveConfirmation(false);
  };
  document.getElementById("confirmOverlay").onkeydown = event => {
    if (event.key === "Escape") resolveConfirmation(false);
  };
  document.getElementById("overlayStartBtn").onclick = () => {
    startTimer();
  };
  document.getElementById("overlayPauseBtn").onclick = () => {
    stopTimer();
    applySessionToTask(false);
    const task = data.days[currentDate].find(t => t.id === runningTaskId);
    runningBaseSeconds = task ? getTaskDurationSeconds(task, "actualMinutes") || 0 : 0;
    runningSessionSeconds = 0;
    document.getElementById("overlayTimer").textContent = "00:00";
  };
  document.getElementById("overlayFinishBtn").onclick = () => {
    stopTimer();
    applySessionToTask(true);
    closeOverlay();
  };
  document.getElementById("overlayCloseBtn").onclick = () => {
    closeOverlay();
  };
}

document.addEventListener("DOMContentLoaded", init);
