document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "notes";
  const NOTES_COLLECTION = "notebookNotes";

  // --- DOM elements ---
  const newNoteBtn = document.querySelector(".new-note-btn");
  const noteModal = document.querySelector(".note-modal");
  const noteTitleInput = document.querySelector(".note-modal-title");
  const noteTextarea = document.querySelector(".note-modal-textarea");
  const noteCreatedAtSpan = document.getElementById("noteCreatedAt");
  const saveBtn = document.querySelector(".note-modal-save");
  const noteExpandBtn = document.querySelector(".note-modal-expand-btn");
  const noteModalDialog = document.querySelector(".note-modal-dialog");

  const pagesList = document.querySelector(".pages-list");
  const notesGrid = document.querySelector(".notes-grid");

  const contextMenu = document.querySelector(".note-context-menu");
  const contextEditBtn = document.querySelector(".context-edit");
  const contextFavoriteBtn = document.querySelector(".context-favorite");
  const contextDeleteBtn = document.querySelector(".context-delete");

  const searchInput = document.querySelector(".pages-search-input");

  const themeBtn = document.querySelector("#themeBtn");
  const sidebar = document.querySelector(".sidebar");
  const sidebarToggle = document.querySelector(".sidebar-toggle");
  const sidebarMobileActions = document.querySelector(
    ".sidebar-mobile-actions"
  );
  const pagesActions = document.querySelector(".pages-actions");
  const topbarRight = document.querySelector(".topbar-right");

  // Templates
  const pageTemplate =
    pagesList && pagesList.querySelector('[data-template="page-item"]');
  const cardTemplate =
    notesGrid && notesGrid.querySelector('[data-template="note-card"]');

  let currentNoteId = null;
  let currentCreatedAt = "";
  let auth = null;
  let db = null;
  let currentUser = null;
  let unsubscribeNotes = null;
  let notesCache = [];

  // ---------- Mobile sidebar ----------
  if (sidebar && sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      const isOpen = sidebar.classList.toggle("is-open");
      sidebarToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    const navLinks = sidebar.querySelectorAll(".nav-link");
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 980px)").matches) {
          sidebar.classList.remove("is-open");
          sidebarToggle.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  const actionsMedia = window.matchMedia("(max-width: 980px)");

  function syncNotebookActions(event) {
    if (!sidebarMobileActions || !topbarRight) return;

    const isMobile = event ? event.matches : actionsMedia.matches;

    if (isMobile) {
      sidebarMobileActions.appendChild(topbarRight);
      sidebarMobileActions.setAttribute("aria-hidden", "false");
      if (pagesActions) pagesActions.setAttribute("aria-hidden", "true");
    } else {
      if (pagesActions && topbarRight.parentElement !== pagesActions) {
        pagesActions.appendChild(topbarRight);
        pagesActions.setAttribute("aria-hidden", "false");
      }
      sidebarMobileActions.setAttribute("aria-hidden", "true");
    }
  }

  syncNotebookActions();
  if (actionsMedia.addEventListener) {
    actionsMedia.addEventListener("change", syncNotebookActions);
  } else {
    actionsMedia.addListener(syncNotebookActions);
  }

  // ---------- Helpers: storage ----------

  function formatDateForDisplay(date) {
    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    };
    return date.toLocaleString(undefined, options);
  }

  function loadNotesFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn("Could not parse notes from storage", e);
      return [];
    }
  }

  function saveNotesToStorage(notes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  function getId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeNotesList(notes) {
    if (!Array.isArray(notes)) return [];
    return notes.map((note) => {
      if (typeof note.favorite !== "boolean") {
        return { ...note, favorite: false };
      }
      return note;
    });
  }

  function getNotesCollection() {
    if (!db || !currentUser) return null;
    return db
      .collection("users")
      .doc(currentUser.uid)
      .collection(NOTES_COLLECTION);
  }

  function getNotesList() {
    if (currentUser) return notesCache;
    return normalizeNotesList(loadNotesFromStorage());
  }

  function getSnippetFromContent(content) {
    if (!content) return "";
    const firstLine = content.split("\n")[0].trim();
    if (!firstLine) return "";
    const words = firstLine.split(/\s+/);
    const maxWords = 8;
    const snippetWords = words.slice(0, maxWords);
    let snippet = snippetWords.join(" ");
    if (words.length > maxWords) snippet += " …";
    return snippet;
  }

  // ---------- Helpers: DOM rendering ----------

  function renderPageItem(note) {
    if (!pageTemplate) return;

    const pageBtn = pageTemplate.cloneNode(true);
    pageBtn.classList.remove("is-hidden");
    pageBtn.removeAttribute("data-template");
    pageBtn.dataset.id = note.id;

    const pageTitleEl = pageBtn.querySelector(".page-item-title");
    const pageSnippetEl = pageBtn.querySelector(".page-item-snippet");

    if (pageTitleEl) {
      pageTitleEl.textContent =
        (note.favorite ? "⭐ " : "") + (note.title || "Untitled");
    }

    if (pageSnippetEl) {
      pageSnippetEl.textContent = getSnippetFromContent(note.content || "");
    }

    pagesList.appendChild(pageBtn);
  }

  function renderNoteCard(note) {
    if (!cardTemplate) return;

    const card = cardTemplate.cloneNode(true);
    card.classList.remove("is-hidden");
    card.removeAttribute("data-template");
    card.dataset.id = note.id;

    const previewEl = card.querySelector(".note-preview");
    const titleEl = card.querySelector(".note-title");

    if (titleEl) {
      titleEl.textContent =
        (note.favorite ? "⭐ " : "") + (note.title || "Untitled");
    }

    if (previewEl) {
      const previewText = (note.content || "").split("\n")[0];
      previewEl.textContent = previewText || "First Lines of Text Here ...";
    }

    notesGrid.appendChild(card);
  }

  // Render both page-item + (if favorite) card
  function renderNote(note) {
    renderPageItem(note);

    if (note.favorite === true) {
      renderNoteCard(note);
    }
  }

  function clearRenderedNotes() {
    if (pagesList) {
      const pageItems = pagesList.querySelectorAll(".page-item");
      pageItems.forEach((item) => {
        if (!item.hasAttribute("data-template")) {
          item.remove();
        }
      });
    }

    if (notesGrid) {
      const cards = notesGrid.querySelectorAll(".note-card");
      cards.forEach((card) => {
        if (!card.hasAttribute("data-template")) {
          card.remove();
        }
      });
    }
  }

  function renderAllNotes(notes) {
    clearRenderedNotes();
    normalizeNotesList(notes).forEach(renderNote);
  }

  function updateRenderedNote(note) {
    const pageBtn = document.querySelector(`.page-item[data-id="${note.id}"]`);
    const card = document.querySelector(`.note-card[data-id="${note.id}"]`);

    // --- Update page item (left) ---
    if (pageBtn) {
      const pageTitleEl = pageBtn.querySelector(".page-item-title");
      const pageSnippetEl = pageBtn.querySelector(".page-item-snippet");

      if (pageTitleEl) {
        pageTitleEl.textContent =
          (note.favorite ? "⭐ " : "") + (note.title || "Untitled");
      }

      if (pageSnippetEl) {
        pageSnippetEl.textContent = getSnippetFromContent(note.content || "");
      }
    }

    // --- Update note card (right) IF it exists ---
    if (card) {
      const titleEl = card.querySelector(".note-title");
      const previewEl = card.querySelector(".note-preview");

      if (titleEl) {
        titleEl.textContent =
          (note.favorite ? "⭐ " : "") + (note.title || "Untitled");
      }

      if (previewEl) {
        const previewText = (note.content || "").split("\n")[0];
        previewEl.textContent = previewText || "First Lines of Text Here ...";
      }
    }
  }

  async function createNote(note) {
    if (db && currentUser) {
      const collection = getNotesCollection();
      if (collection) {
        await collection.doc(note.id).set(note);
      }
      return note;
    }

    const notes = loadNotesFromStorage();
    notes.push(note);
    saveNotesToStorage(notes);
    return note;
  }

  async function updateNote(noteId, updates) {
    if (!noteId) return null;

    if (db && currentUser) {
      const collection = getNotesCollection();
      if (collection) {
        await collection.doc(noteId).set(updates, { merge: true });
      }
      return { id: noteId, ...updates };
    }

    const notes = loadNotesFromStorage();
    const index = notes.findIndex((n) => n.id === noteId);
    if (index === -1) return null;

    notes[index] = { ...notes[index], ...updates };
    saveNotesToStorage(notes);
    return notes[index];
  }

  async function removeNote(noteId) {
    if (!noteId) return;

    if (db && currentUser) {
      const collection = getNotesCollection();
      if (collection) {
        await collection.doc(noteId).delete();
      }
      return;
    }

    const notes = loadNotesFromStorage();
    const updated = notes.filter((n) => n.id !== noteId);
    saveNotesToStorage(updated);
  }

  function deleteNoteById(noteId) {
    if (!noteId) return;

    removeNote(noteId);

    const pageBtn = document.querySelector(`.page-item[data-id="${noteId}"]`);
    const card = document.querySelector(`.note-card[data-id="${noteId}"]`);

    if (pageBtn) pageBtn.remove();
    if (card) card.remove();

    if (currentNoteId === noteId) {
      currentNoteId = null;
      closeModal();
    }
  }

  function getNoteCardFromEvent(event) {
    const card = event.target.closest(".note-card");
    if (!card) return null;
    if (card.hasAttribute("data-template")) return null;
    return card;
  }

  // ---------- Context menu helpers ----------

  function showContextMenu(event, noteId) {
    if (!contextMenu) return;

    contextMenu.dataset.noteId = noteId;

    // Set Favorite / Remove Favorite label
    if (contextFavoriteBtn) {
      const notes = getNotesList();
      const note = notes.find((n) => n.id === noteId);
      if (note && note.favorite) {
        contextFavoriteBtn.textContent = "Remove Favorite";
      } else {
        contextFavoriteBtn.textContent = "⭐ Favorite";
      }
    }

    const x = event.clientX;
    const y = event.clientY;

    contextMenu.style.left = x + "px";
    contextMenu.style.top = y + "px";
    contextMenu.classList.remove("is-hidden");
  }

  function hideContextMenu() {
    if (!contextMenu) return;
    contextMenu.classList.add("is-hidden");
    delete contextMenu.dataset.noteId;
  }

  // ---------- Modal logic (new + edit) ----------

  function openModalForNewNote() {
    const now = new Date();
    currentCreatedAt = formatDateForDisplay(now);

    const newNote = {
      id: getId(),
      title: "",
      content: "",
      createdAt: currentCreatedAt,
      createdAtMs: now.getTime(),
      favorite: false,
    };

    createNote(newNote);

    // Only create page-item for new note
    renderPageItem(newNote);

    currentNoteId = newNote.id;

    if (noteCreatedAtSpan) {
      noteCreatedAtSpan.textContent = currentCreatedAt;
    }

    if (noteTitleInput) noteTitleInput.value = newNote.title;
    if (noteTextarea) noteTextarea.value = newNote.content;

    if (noteModal) {
      noteModal.classList.remove("is-hidden");
    }
    if (noteTitleInput) noteTitleInput.focus();
  }

  function openNoteForEdit(noteId) {
    const notes = getNotesList();
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    currentNoteId = note.id;
    currentCreatedAt = note.createdAt || formatDateForDisplay(new Date());

    if (noteCreatedAtSpan) {
      noteCreatedAtSpan.textContent = currentCreatedAt;
    }

    if (noteTitleInput) {
      noteTitleInput.value = note.title || "";
    }

    if (noteTextarea) {
      noteTextarea.value = note.content || "";
    }

    if (noteModal) {
      noteModal.classList.remove("is-hidden");
    }

    if (noteTitleInput) {
      noteTitleInput.focus();
    }

    hideContextMenu();
  }

  function closeModal() {
    if (!noteModal) return;
    if (!noteModal.classList.contains("is-hidden")) {
      noteModal.classList.add("is-hidden");
    }
    noteModal.classList.remove("is-expanded");
    if (noteExpandBtn) noteExpandBtn.setAttribute("aria-expanded", "false");
  }

  function initNotebookAuth() {
    if (!window.initFirebase) {
      renderAllNotes(getNotesList());
      return;
    }

    const app = window.initFirebase();
    if (!app || !window.firebase || !window.firebase.auth) {
      renderAllNotes(getNotesList());
      return;
    }

    auth = window.firebase.auth();
    db = window.firebase.firestore ? window.firebase.firestore() : null;

    if (unsubscribeNotes) {
      unsubscribeNotes();
      unsubscribeNotes = null;
    }

    auth.onAuthStateChanged((user) => {
      currentUser = user || null;

      if (user && db) {
        const collection = getNotesCollection();
        if (!collection) return;

        unsubscribeNotes = collection
          .orderBy("createdAtMs", "desc")
          .onSnapshot((snap) => {
            notesCache = normalizeNotesList(
              snap.docs.map((doc) => doc.data())
            );
            renderAllNotes(notesCache);
          });
      } else {
        window.location.href = "../login.html";
      }
    });
  }

  // ---------- Event wiring ----------

  // New note button
  if (newNoteBtn) {
    newNoteBtn.addEventListener("click", () => {
      hideContextMenu();
      openModalForNewNote();
    });
  }

  // Click outside modal closes it
  if (noteModal) {
    noteModal.addEventListener("click", (event) => {
      if (event.target === noteModal) {
        closeModal();
      }
    });
  }

  // Left-click: page-item -> edit
  if (pagesList) {
    pagesList.addEventListener("click", (event) => {
      const pageBtn = event.target.closest(".page-item");
      if (!pageBtn) return;
      if (pageBtn.hasAttribute("data-template")) return;

      const noteId = pageBtn.dataset.id;
      if (!noteId) return;

      openNoteForEdit(noteId);
    });

    // Right-click: page-item -> context menu
    pagesList.addEventListener("contextmenu", (event) => {
      const pageBtn = event.target.closest(".page-item");
      if (!pageBtn) return;
      if (pageBtn.hasAttribute("data-template")) return;

      event.preventDefault();
      event.stopPropagation();

      const noteId = pageBtn.dataset.id;
      if (!noteId) return;

      showContextMenu(event, noteId);
    });
  }

  // Left-click: note-card -> edit
  if (notesGrid) {
    notesGrid.addEventListener("click", (event) => {
      const card = getNoteCardFromEvent(event);
      if (!card) return;

      const noteId = card.dataset.id;
      if (!noteId) return;

      openNoteForEdit(noteId);
    });

    // Right-click: note-card -> context menu
    notesGrid.addEventListener("contextmenu", (event) => {
      const card = getNoteCardFromEvent(event);
      if (!card) return;

      event.preventDefault();
      event.stopPropagation();

      const noteId = card.dataset.id;
      if (!noteId) return;

      showContextMenu(event, noteId);
    });
  }

  // Context menu: Edit
  if (contextEditBtn) {
    contextEditBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!contextMenu) return;

      const noteId = contextMenu.dataset.noteId;
      if (!noteId) return;

      openNoteForEdit(noteId);
    });
  }

  // Context menu: Favorite / Remove Favorite
  if (contextFavoriteBtn) {
    contextFavoriteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!contextMenu) return;

      const noteId = contextMenu.dataset.noteId;
      if (!noteId) return;

      const notes = getNotesList();
      const index = notes.findIndex((n) => n.id === noteId);
      if (index === -1) return;

      const note = notes[index];
      const nextFavorite = !note.favorite;

      updateNote(noteId, { favorite: nextFavorite });

      const updatedNote = { ...note, favorite: nextFavorite };

      // Update page-item + any existing card title/snippet
      updateRenderedNote(updatedNote);

      // Show/hide card based on favorite state
      const existingCard = document.querySelector(
        `.note-card[data-id="${updatedNote.id}"]`
      );

      if (updatedNote.favorite) {
        if (!existingCard) {
          renderNoteCard(updatedNote);
        }
      } else {
        if (existingCard) {
          existingCard.remove();
        }
      }

      hideContextMenu();
    });
  }

  // Context menu: Delete
  if (contextDeleteBtn) {
    contextDeleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!contextMenu) return;

      const noteId = contextMenu.dataset.noteId;
      if (noteId) {
        deleteNoteById(noteId);
      }

      hideContextMenu();
    });
  }

  // Click anywhere else hides context menu
  document.addEventListener("click", (event) => {
    if (!contextMenu) return;
    if (!contextMenu.contains(event.target)) {
      hideContextMenu();
    }
  });

  // ESC: close modal + context menu
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideContextMenu();
      closeModal();
    }
  });

  // Save button: update note in storage + UI, then close
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (!currentNoteId) {
        closeModal();
        return;
      }

      const title = (noteTitleInput?.value || "").trim();
      const content = (noteTextarea?.value || "").trim();

      const notes = getNotesList();
      const index = notes.findIndex((n) => n.id === currentNoteId);
      if (index === -1) {
        closeModal();
        return;
      }

      // Only update title/content — keep id, createdAt, favorite
      updateNote(currentNoteId, { title, content });

      const updatedNote = { ...notes[index], title, content };
      updateRenderedNote(updatedNote);

      closeModal();
    });
  }

  // Expand modal to full screen
  if (noteExpandBtn && noteModal && noteModalDialog) {
    noteExpandBtn.addEventListener("click", () => {
      const isExpanded = noteModal.classList.toggle("is-expanded");
      noteExpandBtn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    });
  }

  // Pages search: filter page-items
  if (searchInput && pagesList) {
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.toLowerCase().trim();
      const pageItems = pagesList.querySelectorAll(".page-item");

      pageItems.forEach((pageBtn) => {
        if (pageBtn.hasAttribute("data-template")) return;

        const titleEl = pageBtn.querySelector(".page-item-title");
        const snippetEl = pageBtn.querySelector(".page-item-snippet");

        const titleText = (titleEl?.textContent || "").toLowerCase();
        const snippetText = (snippetEl?.textContent || "").toLowerCase();
        const haystack = `${titleText} ${snippetText}`.trim();

        if (!query) {
          pageBtn.classList.remove("is-filtered");
          return;
        }

        if (haystack.includes(query)) {
          pageBtn.classList.remove("is-filtered");
        } else {
          pageBtn.classList.add("is-filtered");
        }
      });
    });
  }

  // --- Theme toggle ---

  if (themeBtn) {
    const savedTheme = localStorage.getItem("theme")
      ? JSON.parse(localStorage.getItem("theme"))
      : "dark";

    if (savedTheme === "light") {
      document.body.classList.add("light");
    }

    themeBtn.textContent = document.body.classList.contains("light")
      ? "☀️"
      : "🌙";

    themeBtn.addEventListener("click", () => {
      document.body.classList.toggle("light");
      const isLight = document.body.classList.contains("light");
      themeBtn.textContent = isLight ? "☀️" : "🌙";
      localStorage.setItem("theme", JSON.stringify(isLight ? "light" : "dark"));
    });
  }

  // ---------- Initial load ----------
  initNotebookAuth();
});
