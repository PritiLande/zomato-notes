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

// Part 2: Ranking Engine data layer

async function searchNotes({ keyword, sortBy }) {
  const params = new URLSearchParams();
  if (keyword) params.set("keyword", keyword);
  if (sortBy) params.set("sort_by", sortBy);
  const response = await fetch(`${API_BASE}/notes/search?${params.toString()}`);
  if (!response.ok) throw new Error(`Search failed: ${response.status}`);
  return response.json();
}

async function lookupNoteByTitle(title, algo) {
  const params = new URLSearchParams({ title, algo });
  const response = await fetch(`${API_BASE}/notes/lookup?${params.toString()}`);
  if (!response.ok) throw new Error(`Lookup failed: ${response.status}`);
  return response.json();
}

async function quickFindByTag(tag) {
  const params = new URLSearchParams({ tag });
  const response = await fetch(`${API_BASE}/notes/quick-find?${params.toString()}`);
  if (!response.ok) throw new Error(`Quick-find failed: ${response.status}`);
  return response.json();
}

// Part 3: Smart Search (semantic) data layer

async function smartSearch(query) {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`${API_BASE}/notes/smart-search?${params.toString()}`);
  if (!response.ok) throw new Error(`Smart search failed: ${response.status}`);
  return response.json();
}

// ---------- State ----------

let allNotes = [];

// ---------- Rendering ----------

function renderNotes(notes) {
  const notesList = document.getElementById("notes-list");
  notesList.innerHTML = "";

  notes.forEach((note) => {
    const card = document.createElement("div");
    card.className = "note-card";
    card.id = `note-card-${note.id}`;

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

// ---------- Debounced search (Part 1 plain search) ----------

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

// ---------- Part 2: Sort by Relevance / Date ----------

document.getElementById("sort-select").addEventListener("change", async (e) => {
  const sortBy = e.target.value;
  try {
    let results;
    if (sortBy === "date") {
      results = await searchNotes({ sortBy: "date" });
    } else {
      const keyword = document.getElementById("search-box").value.trim() || "the";
      results = await searchNotes({ keyword });
    }
    renderNotes(results);
  } catch (err) {
    showError("Failed to sort notes.");
  }
});

// ---------- Part 2: Jump to exact title (binary search) ----------

document.getElementById("exact-title-input").addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  const title = e.target.value.trim();
  if (!title) return;
  const algo = document.getElementById("algo-select").value;

  try {
    const result = await lookupNoteByTitle(title, algo);
    renderLookupResult(result);
  } catch (err) {
    showError("Lookup failed.");
  }
});

function renderLookupResult(result) {
  const container = document.getElementById("lookup-result");
  container.innerHTML = "";

  if (!result.found) {
    const notFoundDiv = document.createElement("div");
    notFoundDiv.className = "not-found";
    notFoundDiv.textContent = result.message || "Note not found.";
    container.appendChild(notFoundDiv);
    return;
  }

  const foundDiv = document.createElement("div");
  foundDiv.className = "found-note";
  foundDiv.textContent = `Found: "${result.title}" (tag: ${result.tag})`;
  container.appendChild(foundDiv);

  const card = document.getElementById(`note-card-${result.id}`);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("highlighted");
    setTimeout(() => card.classList.remove("highlighted"), 2000);
  }
}

// ---------- Part 2: Quick tag jump (linear search) ----------

document.getElementById("quick-tag-buttons").addEventListener("click", async (e) => {
  if (e.target.tagName !== "BUTTON") return;
  const tag = e.target.dataset.tag;

  try {
    const result = await quickFindByTag(tag);
    renderLookupResult(result);
  } catch (err) {
    showError("Quick tag jump failed.");
  }
});

// ---------- Part 3: Smart Search (AI, semantic) ----------

let smartSearchDebounceTimer = null;

document.getElementById("smart-search-input").addEventListener("input", (e) => {
  clearTimeout(smartSearchDebounceTimer);
  const query = e.target.value.trim();
  const resultsContainer = document.getElementById("smart-search-results");

  if (!query) {
    resultsContainer.innerHTML = "";
    return;
  }

  smartSearchDebounceTimer = setTimeout(async () => {
    try {
      const results = await smartSearch(query);
      renderSmartSearchResults(results);
    } catch (err) {
      showError("Smart search failed.");
    }
  }, 500);
});

function renderSmartSearchResults(results) {
  const container = document.getElementById("smart-search-results");
  container.innerHTML = "";

  if (results.length === 0) {
    container.textContent = "No matches found.";
    return;
  }

  results.forEach((note) => {
    const div = document.createElement("div");
    div.className = "smart-result";

    const titleEl = document.createElement("strong");
    titleEl.textContent = note.title;

    const scoreEl = document.createElement("span");
    scoreEl.className = "score";
    scoreEl.textContent = ` (similarity: ${note.similarity_score.toFixed(3)})`;

    const contentEl = document.createElement("p");
    contentEl.textContent = note.content;

    div.appendChild(titleEl);
    div.appendChild(scoreEl);
    div.appendChild(contentEl);
    container.appendChild(div);
  });
}

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