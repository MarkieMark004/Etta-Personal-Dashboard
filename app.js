// ---------- TradingView BTC/NZD Embed ----------
function loadTradingViewChart() {
  const container = document.querySelector("#tv-advanced-chart");
  if (!container) return;

  // Clear old widget (important when reloading for theme sync)
  container.innerHTML = "";

  const theme = document.body.classList.contains("light") ? "light" : "dark";

  const script = document.createElement("script");
  script.src =
    "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  script.async = true;

  // TradingView widget config (BTC/NZD + theme sync)
  script.innerHTML = JSON.stringify({
    autosize: true,
    symbol: "BTCUSD",
    interval: "D",
    timezone: "Pacific/Auckland",
    theme: theme,
    style: "1",
    locale: "en",
    allow_symbol_change: false,
    hide_side_toolbar: true,
    hide_top_toolbar: false,
    withdateranges: true,
    save_image: false,
    calendar: false,
    support_host: "https://www.tradingview.com",
  });

  container.appendChild(script);
}

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);

const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

// ---------- Clock + Date + Greeting ----------
const clockEl = $("#clock");
const dateEl = $("#date");
const greetingEl = $("#greeting");

function pad(n) {
  return String(n).padStart(2, "0");
}

function updateTime() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();

  clockEl.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;

  const dateFmt = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  dateEl.textContent = dateFmt.format(now);

  let part = "Hello";
  if (h >= 5 && h < 12) part = "Good morning";
  else if (h >= 12 && h < 17) part = "Good afternoon";
  else if (h >= 17 && h < 22) part = "Good evening";
  else part = "Good night";

  greetingEl.textContent = `${part} 👋`;
}

setInterval(updateTime, 250);
updateTime();

// ---------- Theme ----------
const themeBtn = $("#themeBtn");
const savedTheme = storage.get("theme", "dark");

if (savedTheme === "light") document.body.classList.add("light");
themeBtn.textContent = document.body.classList.contains("light") ? "☀️" : "🌙";

themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  themeBtn.textContent = isLight ? "☀️" : "🌙";
  storage.set("theme", isLight ? "light" : "dark");

  loadTradingViewChart();
});

// ---------- Focus ----------
const focusInput = $("#focusInput");
const focusSaved = $("#focusSaved");

function loadFocus() {
  const focus = storage.get("focus", "");
  focusInput.value = focus;
  focusSaved.textContent = focus ? `Saved: ${focus}` : "";
}

focusInput.addEventListener("input", () => {
  const val = focusInput.value.trim();
  storage.set("focus", val);
  focusSaved.textContent = val ? `Saved: ${val}` : "";
});

loadFocus();

// ---------- Notes ----------
const notesEl = $("#notes");
const clearNotesBtn = $("#clearNotesBtn");

notesEl.value = storage.get("notes", "");

let notesTimer = null;
notesEl.addEventListener("input", () => {
  clearTimeout(notesTimer);
  notesTimer = setTimeout(() => {
    storage.set("notes", notesEl.value);
  }, 250);
});

clearNotesBtn.addEventListener("click", () => {
  notesEl.value = "";
  storage.set("notes", "");
});

// ---------- Todo ----------
const todoForm = $("#todoForm");
const todoInput = $("#todoInput");
const todoList = $("#todoList");
const todoEmpty = $("#todoEmpty");
const clearDoneBtn = $("#clearDoneBtn");

let todos = storage.get("todos", []);

function renderTodos() {
  todoList.innerHTML = "";

  if (!todos.length) {
    todoEmpty.style.display = "block";
    return;
  }
  todoEmpty.style.display = "none";

  for (const t of todos) {
    const li = document.createElement("li");
    li.className = `item ${t.done ? "done" : ""}`;

    const left = document.createElement("div");
    left.className = "left";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = t.done;
    cb.addEventListener("change", () => {
      t.done = cb.checked;
      persist();
      renderTodos();
    });

    const text = document.createElement("div");
    text.className = "text";
    text.textContent = t.text;

    left.appendChild(cb);
    left.appendChild(text);

    const del = document.createElement("button");
    del.className = "icon-btn";
    del.type = "button";
    del.title = "Delete";
    del.textContent = "🗑️";
    del.addEventListener("click", () => {
      todos = todos.filter((x) => x.id !== t.id);
      persist();
      renderTodos();
    });

    li.appendChild(left);
    li.appendChild(del);
    todoList.appendChild(li);
  }
}

function persist() {
  storage.set("todos", todos);
}

todoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (!text) return;

  todos.unshift({
    id: crypto.randomUUID(),
    text,
    done: false,
    createdAt: Date.now(),
  });

  todoInput.value = "";
  persist();
  renderTodos();
});

clearDoneBtn.addEventListener("click", () => {
  todos = todos.filter((t) => !t.done);
  persist();
  renderTodos();
});

renderTodos();
loadTradingViewChart();
