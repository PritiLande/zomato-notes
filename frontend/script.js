// ---------- Configuration ----------
const API_BASE = "http://127.0.0.1:8000";
const DELETE_TOKEN = "changeme123"; // matches backend/.env DELETE_AUTH_TOKEN

// ---------- Data layer (real fetch calls to the backend) ----------

async function fetchNotes(tag) {
  const url = tag ? `${API_BASE}/notes?tag=${encodeURIComponent(tag)}` : `${API_BASE}/notes`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch notes: ${response.status}`);
  }
  return response.json();
}

async function createNote(noteData) {
  const response = await fetch(`${API_BASE}/notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(noteData),
  });
  if (!response.ok) {
    throw new Error(`Failed to create note: ${response.status}`);
  }
  return response.json();
}

async function deleteNote(id) {
  const response = await fetch(`${API_BASE}/notes/${id}`, {
    method: "DELETE",
    headers: {
      "x-token": DELETE_TOKEN,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to delete note: ${response.status}`);
  }
  return response.json();
}

// ---------- State ----------

let allNotes = [];

// ---------- Rendering ----------

function renderNotes(notes) {
  const notesList = document.getElementById("notes-list");
  notesList.innerHTML = ""; // clear previous render

  notes.forEach((note) => {
    const card = document.createElement("div");
    card.className = "note-card";

    const title = document.createElement("h3");
    title.textContent = note.title;

    const tag = document.createElement("span");
    tag.className = "note-tag";
    tag.textContent = note.tag || "untagged";

    const content = document.createElement("p");
    content.className = "note-content";
    content.textContent = note.content;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => handleDelete(note.id, card));

    card.appendChild(title);
    card.appendChild(tag);
    card.appendChild(content);

    // Part 3 will render note.ai_suggestion here if present
    if (note.ai_suggestion) {
      card.appendChild(renderAiSuggestion(note));
    }

    card.appendChild(deleteBtn);
    notesList.appendChild(card);
  });
}

function renderAiSuggestion(note) {
  const panel = document.createElement("div");
  panel.className = "ai-suggests";

  const label = document.createElement("strong");
  label.textContent = "AI Suggests: ";
  panel.appendChild(label);

  const tagsText = document.createElement("span");
  tagsText.textContent = `Tags: ${note.ai_suggestion.tags.join(", ")} — `;
  panel.appendChild(tagsText);

  const summaryText = document.createElement("span");
  summaryText.textContent = note.ai_suggestion.summary;
  panel.appendChild(summaryText);

  const applyBtn = document.createElement("button");
  applyBtn.textContent = "Apply as tag";
  applyBtn.addEventListener("click", () => applyAiTag(note.id, note.ai_suggestion.tags[0]));
  panel.appendChild(document.createElement("br"));
  panel.appendChild(applyBtn);

  return panel;
}

async function applyAiTag(noteId, tag) {
  try {
    await fetch(`${API_BASE}/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag }),
    });
    await loadAndRenderNotes();
  } catch (err) {
    showError("Failed to apply AI tag.");
  }
}

// ---------- Loading / Error states ----------

function showLoading() {
  document.getElementById("loading-message").hidden = false;
}

function hideLoading() {
  document.getElementById("loading-message").hidden = true;
}

function showError(message) {
  const errorEl = document.getElementById("error-message");
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function hideError() {
  const errorEl = document.getElementById("error-message");
  errorEl.hidden = true;
}

// ---------- Load notes on page start ----------

async function loadAndRenderNotes(tag) {
  showLoading();
  hideError();
  try {
    const notes = await fetchNotes(tag);
    allNotes = notes;
    renderNotes(notes);
  } catch (err) {
    showError("Could not load notes. Please check the backend is running.");
  } finally {
    hideLoading();
  }
}

// ---------- Delete handler ----------

async function handleDelete(id, cardElement) {
  try {
    await deleteNote(id);
    cardElement.remove();
  } catch (err) {
    showError("Failed to delete note.");
  }
}

// ---------- Add note form ----------

function showFormError(message) {
  const el = document.getElementById("form-error");
  el.textContent = message;
  el.hidden = false;
}

function hideFormError() {
  document.getElementById("form-error").hidden = true;
}

document.getElementById("add-note-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideFormError();

  const title = document.getElementById("note-title").value.trim();
  const content = document.getElementById("note-content").value.trim();
  const tag = document.getElementById("note-tag").value.trim();

  if (!title || !content) {
    showFormError("Title and content are required.");
    return;
  }

  try {
    const newNote = await createNote({ title, content, tag, owner_id: 1 });
    allNotes.push(newNote);
    renderNotes(allNotes);
    e.target.reset();
  } catch (err) {
    showFormError("Failed to add note. Please try again.");
  }
});

// ---------- Debounced search ----------

let debounceTimer = null;

document.getElementById("search-box").addEventListener("input", (e) => {
  clearTimeout(debounceTimer);
  const query = e.target.value.trim().toLowerCase();

  debounceTimer = setTimeout(() => {
    const filtered = allNotes.filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        (note.tag && note.tag.toLowerCase().includes(query))
    );
    renderNotes(filtered);
  }, 400);
});

// ---------- Recursive nested tag tree ----------

const CATEGORY_TREE = {
  name: "All Tags",
  children: [
    { name: "Work", children: [
      { name: "Standups", children: [] },
      { name: "Retros", children: [] },
    ]},
    { name: "Personal", children: [
      { name: "Health", children: [
        { name: "Fitness", children: [] },
      ]},
      { name: "Recipes", children: [] },
    ]},
    { name: "Travel", children: [] },
  ],
};

function renderTagTree(node) {
  const li = document.createElement("li");
  const label = document.createElement("span");
  label.textContent = node.name;
  li.appendChild(label);

  if (node.children && node.children.length > 0) {
    const ul = document.createElement("ul");
    node.children.forEach((child) => {
      ul.appendChild(renderTagTree(child));
    });
    li.appendChild(ul);
    li.classList.add("collapsed");

    label.addEventListener("click", () => {
      li.classList.toggle("collapsed");
    });
  }

  return li;
}

function initTagTree() {
  const container = document.getElementById("tag-tree");
  const rootUl = document.createElement("ul");
  rootUl.appendChild(renderTagTree(CATEGORY_TREE));
  container.appendChild(rootUl);
}

// ---------- Init ----------

document.addEventListener("DOMContentLoaded", () => {
  loadAndRenderNotes();
  initTagTree();
});