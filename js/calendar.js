const HOLIDAYS_BY_YEAR = {
  2025: [
    {
      startDate: "2025-12-25",
      endDate: "2025-12-25",
      title: "Christmas Day",
      isHoliday: true,
    },
    {
      startDate: "2025-12-26",
      endDate: "2025-12-26",
      title: "Boxing Day",
      isHoliday: true,
    },
  ],
  2026: [
    {
      startDate: "2026-01-01",
      endDate: "2026-01-01",
      title: "New Year's Day",
      isHoliday: true,
    },
    {
      startDate: "2026-01-02",
      endDate: "2026-01-02",
      title: "Day after New Year's Day",
      isHoliday: true,
    },

    {
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      title: "Waitangi Day",
      isHoliday: true,
    },

    {
      startDate: "2026-04-03",
      endDate: "2026-04-03",
      title: "Good Friday",
      isHoliday: true,
    },
    {
      startDate: "2026-04-06",
      endDate: "2026-04-06",
      title: "Easter Monday",
      isHoliday: true,
    },
    {
      startDate: "2026-04-27",
      endDate: "2026-04-27",
      title: "ANZAC Day (observed)",
      isHoliday: true,
    }, // adjust if needed

    {
      startDate: "2026-06-01",
      endDate: "2026-06-01",
      title: "King's Birthday",
      isHoliday: true,
    },

    {
      startDate: "2026-10-26",
      endDate: "2026-10-26",
      title: "Labour Day",
      isHoliday: true,
    },

    {
      startDate: "2026-12-25",
      endDate: "2026-12-25",
      title: "Christmas Day",
      isHoliday: true,
    },
    {
      startDate: "2026-12-28",
      endDate: "2026-12-28",
      title: "Boxing Day (observed)",
      isHoliday: true,
    },
  ],
};

let clickTimer = null;
const CLICK_DELAY = 220; // ms
const MOBILE_DOUBLE_TAP_DELAY = 280;

// Calendar with localStorage events + theme toggle sync
let isDragging = false;
let dragStartISO = null;
let dragEndISO = null;

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

function getId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

let auth = null;
let db = null;
let currentUser = null;
let unsubscribeEvents = null;
let events = storage.get("calendarEvents_v1", []);

// ---------- Mobile sidebar ----------
function setupSidebarToggle() {
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.querySelector(".sidebar-toggle");
  if (!sidebar || !toggle) return;

  toggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  const navLinks = sidebar.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 980px)").matches) {
        sidebar.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  });
}

setupSidebarToggle();

const EVENTS_KEY = "calendarEvents_v1";

let viewDate = new Date();
let selectedDateISO = null;
let editingEventId = null;

const monthLabel = $("#monthLabel");
const calGrid = $("#calGrid");

const selectedDayLabel = $("#selectedDayLabel");
const dayEvents = $("#dayEvents");

const prevMonthBtn = $("#prevMonth");
const nextMonthBtn = $("#nextMonth");
const todayBtn = $("#todayBtn");
const addEventBtn = $("#addEventBtn");

// modal
const modal = $("#eventModal");
const backdrop = $("#modalBackdrop");
const closeModalBtn = $("#closeModalBtn");
const cancelBtn = $("#cancelBtn");
const saveBtn = $("#saveBtn");
const deleteBtn = $("#deleteBtn");

const eventStartDate = $("#eventStartDate");
const eventEndDate = $("#eventEndDate");
const eventTitle = $("#eventTitle");
const eventStart = $("#eventStart");
const eventEnd = $("#eventEnd");
const eventNotes = $("#eventNotes");
const calendarCard = $("#calendarCard");
const eventColor = $("#eventColor");
const colorSwatches = document.querySelectorAll(".color-swatch");
let modalBackHandlerBound = false;
const isMobile = window.matchMedia("(max-width: 980px)").matches;

if (isMobile && document.activeElement) {
  document.activeElement.blur();
}

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function initCalendarAuth() {
  if (!window.initFirebase) return;
  const app = window.initFirebase();
  if (!app || !window.firebase || !window.firebase.auth) return;

  auth = window.firebase.auth();
  db = window.firebase.firestore ? window.firebase.firestore() : null;

  if (unsubscribeEvents) {
    unsubscribeEvents();
    unsubscribeEvents = null;
  }

  auth.onAuthStateChanged((user) => {
    currentUser = user || null;
    if (user && db) {
      sessionStorage.setItem("etta-auth", "1");
      document.body.classList.remove("auth-pending");
      unsubscribeEvents = db
        .collection("users")
        .doc(user.uid)
        .collection("events")
        .orderBy("createdAt", "desc")
        .onSnapshot((snap) => {
          events = snap.docs.map((doc) => ({
            ...doc.data(),
            _docId: doc.id,
          }));
          render();
        });
    } else {
      sessionStorage.removeItem("etta-auth");
      window.location.href = "../login.html";
    }
  });
}

initCalendarAuth();

function getEvents() {
  return events;
}

function setEvents(next) {
  events = next;
  storage.set("calendarEvents_v1", next);
}function yearFromISO(iso) {
  return Number(iso.slice(0, 4));
}

function getHolidaysForYear(year) {
  return HOLIDAYS_BY_YEAR[year] ? [...HOLIDAYS_BY_YEAR[year]] : [];
}

function getAllEventsForView() {
  const year = viewDate.getFullYear();
  return [...getEvents(), ...getHolidaysForYear(year)];
}

function eventsForDate(iso) {
  const year = yearFromISO(iso);

  const all = [...getEvents(), ...getHolidaysForYear(year)];

  return all
    .filter((e) => {
      const start = e.startDate || e.date;
      const end = e.endDate || e.date;
      return iso >= start && iso <= end;
    })
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
}

function formatMonthLabel(d) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(d);
}

function openModalWithRange(startISO, endISO) {
  editingEventId = null;
  eventStartDate.value = startISO;
  eventEndDate.value = endISO;

  eventTitle.value = "";
  eventStart.value = "";
  eventEnd.value = "";
  eventColor.value = "#00b5d9";
  eventNotes.value = "";
  syncSwatchSelection(eventColor.value);

  backdrop.classList.add("show");
  modal.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  modal.setAttribute("aria-hidden", "false");
  if (deleteBtn) deleteBtn.style.display = "none";

  if (!window.matchMedia("(max-width: 980px)").matches) {
    setTimeout(() => eventTitle.focus(), 0);
  }
  setupModalBackClose();
}

function openModalForEdit(eventData) {
  if (!eventData) return;

  editingEventId = eventData.id || null;
  eventStartDate.value = eventData.startDate || "";
  eventEndDate.value = eventData.endDate || eventData.startDate || "";
  eventTitle.value = eventData.title || "";
  eventStart.value = eventData.start || "";
  eventEnd.value = eventData.end || "";
  eventColor.value = eventData.color || "#00b5d9";
  eventNotes.value = eventData.notes || "";
  syncSwatchSelection(eventColor.value);

  backdrop.classList.add("show");
  modal.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  modal.setAttribute("aria-hidden", "false");
  if (deleteBtn) deleteBtn.style.display = "inline-flex";

  if (!window.matchMedia("(max-width: 980px)").matches) {
    setTimeout(() => eventTitle.focus(), 0);
  }
  setupModalBackClose();
}

function syncSwatchSelection(color) {
  colorSwatches.forEach((swatch) => {
    const isMatch = swatch.dataset.color === color;
    swatch.classList.toggle("is-selected", isMatch);
    if (!swatch.style.backgroundColor) {
      swatch.style.backgroundColor = swatch.dataset.color;
    }
  });
}

function closeModal() {
  backdrop.classList.remove("show");
  modal.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
  modal.setAttribute("aria-hidden", "true");
  if (deleteBtn) deleteBtn.style.display = "none";

  clearRangeHighlight();
  teardownModalBackClose();
}

function setupModalBackClose() {
  if (!window.matchMedia("(max-width: 980px)").matches) return;
  if (modalBackHandlerBound) return;

  modalBackHandlerBound = true;
  history.pushState({ calendarModal: true }, "");

  const onPopState = () => {
    if (modal.classList.contains("show")) {
      closeModal();
    }
  };

  window.addEventListener("popstate", onPopState, { once: true });
}

function teardownModalBackClose() {
  if (!window.matchMedia("(max-width: 980px)").matches) return;
  if (!modalBackHandlerBound) return;
  modalBackHandlerBound = false;

  if (history.state && history.state.calendarModal) {
    history.back();
  }
}

function render() {
  monthLabel.textContent = formatMonthLabel(viewDate);
  calGrid.innerHTML = "";

  const start = startOfMonth(viewDate);
  const end = endOfMonth(viewDate);

  // Calendar grid starts on Sunday (0)
  const startDay = start.getDay();

  // We render 42 cells (6 weeks) for consistent layout
  const firstCellDate = new Date(start);
  firstCellDate.setDate(start.getDate() - startDay);

  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(firstCellDate);
    cellDate.setDate(firstCellDate.getDate() + i);

    const iso = toISODate(cellDate);
    const isOutside = cellDate.getMonth() !== viewDate.getMonth();
    const isSelected = iso === selectedDateISO;
    const isToday = iso === toISODate(new Date());

    const cell = document.createElement("div");
    cell.className = `day ${isOutside ? "outside" : ""} ${
      isSelected ? "selected" : ""
    } ${isToday ? "today" : ""}`;
    cell.dataset.date = iso;

    const num = document.createElement("div");
    num.className = "day-num";
    num.textContent = cellDate.getDate();

    const pills = document.createElement("div");
    pills.className = "pills";

    const evs = eventsForDate(iso);
    const show = evs.slice(0, 2);
    for (const e of show) {
      const pill = document.createElement("div");
      pill.className = e.isHoliday ? "pill holiday" : "pill";

      pill.textContent = e.start ? `${e.start} ${e.title}` : e.title;
      pill.title = pill.textContent;

      // Apply color only for non-holiday events
      if (!e.isHoliday && e.color) {
        pill.style.borderColor = e.color;
        pill.style.backgroundColor = e.color;
        pill.style.color = "#fff";
      }

      if (!e.isHoliday && e.id) {
        pill.dataset.eventId = e.id;
        pill.addEventListener("dblclick", (event) => {
          event.stopPropagation();
          openModalForEdit(e);
        });

        if (window.matchMedia("(max-width: 980px)").matches) {
          pill.addEventListener("click", (event) => {
            event.stopPropagation();
            openModalForEdit(e);
          });
        }
      }

      pill.title = pill.textContent;
      pills.appendChild(pill);
    }
    if (evs.length > 2) {
      const more = document.createElement("div");
      more.className = "pill";
      more.textContent = `+${evs.length - 2} more`;
      pills.appendChild(more);
    }

    cell.appendChild(num);
    cell.appendChild(pills);

    cell.addEventListener("pointerdown", () => {
      isDragging = false;
      dragStartISO = iso;
      dragEndISO = iso;

      clearRangeHighlight();
    });

    cell.addEventListener("pointerenter", () => {
      if (dragStartISO) {
        isDragging = true;
        dragEndISO = iso;
        clearRangeHighlight();
        highlightRange(dragStartISO, dragEndISO);
      }
    });

    cell.addEventListener("pointerup", () => {
      if (isDragging) {
        const [start, end] = normalizeRange(dragStartISO, dragEndISO);
        openModalWithRange(start, end);
        clearRangeHighlight();
      }

      dragStartISO = null;
      dragEndISO = null;
      isDragging = false;
    });

    cell.addEventListener("click", () => {
      if (isDragging) return;

      const isMobile = window.matchMedia("(max-width: 980px)").matches;
      if (isMobile) {
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
          selectedDateISO = iso;
          render();
        }, MOBILE_DOUBLE_TAP_DELAY + 20);
        return;
      }

      selectedDateISO = iso;
      render();

      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {}, 0);
    });

    cell.addEventListener("dblclick", () => {
      clearTimeout(clickTimer);
      selectedDateISO = iso;
      render();
      openModalWithRange(iso, iso);
    });

    if (window.matchMedia("(max-width: 980px)").matches) {
      let lastTap = 0;
      cell.addEventListener("touchend", () => {
        const now = Date.now();
        if (now - lastTap <= MOBILE_DOUBLE_TAP_DELAY) {
          clearTimeout(clickTimer);
          selectedDateISO = iso;
          render();
          openModalWithRange(iso, iso);
          lastTap = 0;
          return;
        }
        lastTap = now;
      });
    }

    calGrid.appendChild(cell);
  }

  renderSelectedDay();
}
function renderSelectedDay() {
  if (!selectedDateISO) {
    selectedDayLabel.textContent = "None";
    dayEvents.textContent = "Click a day to view events.";
    dayEvents.classList.add("muted");
    return;
  }

  selectedDayLabel.textContent = selectedDateISO;

  const evs = eventsForDate(selectedDateISO);
  dayEvents.innerHTML = "";
  dayEvents.classList.remove("muted");

  if (!evs.length) {
    dayEvents.textContent =
      "No events for this day. Click “+ Add Event” to create one.";
    dayEvents.classList.add("muted");
    return;
  }

  for (const e of evs) {
    const row = document.createElement("div");
    row.className = "event-row";

    const left = document.createElement("div");
    left.className = "event-left";

    const title = document.createElement("div");
    title.className = "event-title";
    title.textContent = e.title;

    const meta = document.createElement("div");
    meta.className = "event-meta";

    const time =
      e.start || e.end
        ? `${e.start || ""}${e.start && e.end ? " - " : ""}${e.end || ""}`
        : "No time";

    const range =
      e.startDate === e.endDate ? e.startDate : `${e.startDate} → ${e.endDate}`;

    meta.textContent = `${range} • ${time}${e.notes ? " • " + e.notes : ""}`;

    left.appendChild(title);
    left.appendChild(meta);
    row.appendChild(left);

    if (!e.isHoliday && e.color) {
      row.style.borderColor = e.color;
    }

    if (!e.isHoliday && e.color) {
      const dot = document.createElement("span");
      dot.style.width = "10px";
      dot.style.height = "10px";
      dot.style.borderRadius = "999px";
      dot.style.background = e.color;
      dot.style.display = "inline-block";
      dot.style.flex = "0 0 auto";
      row.appendChild(dot);
    }

    if (!e.isHoliday) {
      const del = document.createElement("button");
      del.className = "icon-btn";
      del.type = "button";
      del.textContent = "🗑️";
      del.title = "Delete event";
      del.addEventListener("click", () => {
        if (db && currentUser) {
          const docId = e._docId || e.id;
          if (docId) {
            db.collection("users")
              .doc(currentUser.uid)
              .collection("events")
              .doc(docId)
              .delete();
          }
        } else {
          const next = getEvents().filter((x) => x.id !== e.id);
          setEvents(next);
          render();
        }
      });

      row.appendChild(del);
    }

    dayEvents.appendChild(row);
  }
}

function normalizeRange(a, b) {
  return a <= b ? [a, b] : [b, a];
}

function clearRangeHighlight() {
  document
    .querySelectorAll(".day.in-range")
    .forEach((d) => d.classList.remove("in-range"));
}

function highlightRange(startISO, endISO) {
  const [start, end] = normalizeRange(startISO, endISO);

  document.querySelectorAll(".day").forEach((day) => {
    const d = day.dataset.date;
    if (d >= start && d <= end) {
      day.classList.add("in-range");
    }
  });
}

// Navigation
prevMonthBtn.addEventListener("click", () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  render();
});

nextMonthBtn.addEventListener("click", () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  render();
});

todayBtn.addEventListener("click", () => {
  const now = new Date();
  viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
  selectedDateISO = toISODate(now);
  render();
});

addEventBtn.addEventListener("click", () => {
  const iso = selectedDateISO || toISODate(new Date());
  openModalWithRange(iso, iso);
});

// Modal controls
closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);
backdrop.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  e.stopPropagation();
});

function saveEventFromModal() {
  const startDate = eventStartDate.value;
  const endDate = eventEndDate.value || startDate;
  const title = eventTitle.value.trim();

  if (!startDate || !title) {
    alert("Please enter a start date and a title.");
    return;
  }

  if (endDate < startDate) {
    alert("End date cannot be before start date.");
    return;
  }

  const existing = editingEventId
    ? getEvents().find((ev) => ev.id === editingEventId)
    : null;
  const eventId = editingEventId || getId();
  const createdAt = existing?.createdAt || Date.now();

  const newEvent = {
    id: eventId,
    startDate,
    endDate,
    title,
    start: eventStart.value || "",
    end: eventEnd.value || "",
    notes: eventNotes.value.trim(),
    color: eventColor.value || "#00b5d9",
    createdAt,
  };

  if (db && currentUser) {
    db.collection("users")
      .doc(currentUser.uid)
      .collection("events")
      .doc(newEvent.id)
      .set(newEvent, { merge: true });
  } else {
    const next = getEvents();
    const index = next.findIndex((ev) => ev.id === eventId);
    if (index === -1) {
      next.push(newEvent);
    } else {
      next[index] = { ...next[index], ...newEvent };
    }
    setEvents(next);
  }

  selectedDateISO = startDate;
  closeModal();
  render();
}

saveBtn.addEventListener("click", saveEventFromModal);

colorSwatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    const color = swatch.dataset.color;
    if (!color) return;
    eventColor.value = color;
    syncSwatchSelection(color);
  });
});

if (eventColor) {
  eventColor.addEventListener("input", () => {
    syncSwatchSelection(eventColor.value);
  });
}

if (deleteBtn) {
  deleteBtn.addEventListener("click", () => {
    if (!editingEventId) {
      closeModal();
      return;
    }

    if (db && currentUser) {
      db.collection("users")
        .doc(currentUser.uid)
        .collection("events")
        .doc(editingEventId)
        .delete();
    } else {
      const next = getEvents().filter((ev) => ev.id !== editingEventId);
      setEvents(next);
    }

    closeModal();
    render();
  });
}

document.addEventListener("keydown", (e) => {
  // Only when modal is open
  if (!modal.classList.contains("show")) return;

  // Enter saves (but allow Enter inside textarea for new lines)
  if (e.key === "Enter") {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === "textarea") return;

    e.preventDefault();
    saveEventFromModal();
  }
});

// Theme toggle (same behavior as dashboard)
const themeBtn = $("#themeBtn");
const savedTheme = storage.get("theme", "dark");
if (savedTheme === "light") document.body.classList.add("light");
themeBtn.textContent = document.body.classList.contains("light") ? "☀️" : "🌙";

themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  themeBtn.textContent = isLight ? "☀️" : "🌙";
  storage.set("theme", isLight ? "light" : "dark");
});

// Initial
selectedDateISO = toISODate(new Date());
render();

// ---------- Wheel scroll: change months ----------
let wheelCooldown = false;

function goPrevMonth() {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  render();
}

function goNextMonth() {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  render();
}

if (calendarCard) {
  calendarCard.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || wheelCooldown) return;

      // prevent page scroll
      e.preventDefault();

      if (e.deltaY > 0) {
        goNextMonth();
      } else {
        goPrevMonth();
      }

      // cooldown to prevent rapid-fire month changes
      wheelCooldown = true;
      setTimeout(() => {
        wheelCooldown = false;
      }, 280);
    },
    { passive: false }
  );
}



