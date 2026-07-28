# Zomato Notes — AI-Augmented Internal Knowledge Base

A full-stack notes and knowledge-base application for on-call support engineers: capture, tag, search, and get AI assistance on notes — built as a three-part capstone project (Core App, Ranking Engine, Intelligence Layer).

---

## Setup

**Database used:** SQLite (local file, `backend/zomato_notes.db`) — no signup or external service required.

### 1. Clone and set up the backend

```bash
git clone https://github.com/PritiLande/zomato-notes.git
cd zomato-notes/backend
python -m venv venv
venv\Scripts\Activate.ps1        # Windows PowerShell
# source venv/bin/activate       # macOS/Linux
pip install -r requirements.txt
```

### 2. Configure environment variables

Copy `.env.example` to `.env` (already includes safe defaults for local development):

```bash
copy .env.example .env
```

Key variables:
- `MOCK_AI=1` — uses offline mock AI responses (no API key/internet needed). This is the graded default.
- `DATABASE_URL=sqlite:///./zomato_notes.db` — local SQLite database
- `DELETE_AUTH_TOKEN=changeme123` — token required for `DELETE /notes/{id}`

### 3. Seed the database

```bash
python seed.py
```

Expected output:

Seeded 2 users, 10 Part 1 notes, 12 Part 2 ranking notes, and 8 Part 3 AI sample notes.


### 4. Run the backend

```bash
uvicorn main:app --reload
```

Backend runs at `http://127.0.0.1:8000`. Interactive API docs at `http://127.0.0.1:8000/docs`.

### 5. Run the frontend

In a **separate terminal**:

```bash
cd zomato-notes/frontend
python -m http.server 5500
```

Open `http://127.0.0.1:5500/index.html` in your browser.

**Note on the semantic search model (Part 3):** the first call to `GET /notes/smart-search` downloads the `all-MiniLM-L6-v2` model (~90MB) from HuggingFace — this requires internet access, one time only. It's cached at `~/.cache/huggingface` afterward, and every subsequent call runs fully offline with no API key.

## CORS Configuration

The backend's `CORSMiddleware` allows requests only from:
```python
allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"]
```
This matches the frontend's local static server address used above.

---

# Part 1 — Core App

## Backend Feature Verification

### User creation (POST /users) — success

Request:

POST http://127.0.0.1:8000/users
{
"name": "Alice",
"email": "alice@example.com",
"password": "alicepass123"
}


Response (200):
```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com",
  "created_at": "2026-07-27T07:01:42.468298"
}
```
Response headers include `x-process-time: 0.3459947109222412` — confirms the custom middleware is active. Password is correctly excluded from the response.

### Validation — 422 errors (one per constraint type)

**Malformed email:**

POST /users
{"name": "Bob", "email": "not-an-email", "password": "bobpass123"}

Response (422):
```json
{
  "detail": [{
    "type": "value_error", "loc": ["body", "email"],
    "msg": "value is not a valid email address: An email address must have an @-sign.",
    "input": "not-an-email"
  }]
}
```

**Password too short:**

POST /users
{"name": "Charlie", "email": "charlie@example.com", "password": "short"}

Response (422):
```json
{
  "detail": [{
    "type": "string_too_short", "loc": ["body", "password"],
    "msg": "String should have at least 8 characters",
    "input": "short", "ctx": {"min_length": 8}
  }]
}
```

**Missing required field:**

POST /users
{"email": "dave@example.com", "password": "davepass123"}

Response (422):
```json
{
  "detail": [{
    "type": "missing", "loc": ["body", "name"],
    "msg": "Field required"
  }]
}
```

**Over-length title (Note, >120 characters):**

POST /notes
{"title": "This is a deliberately very long title that exceeds the one hundred and twenty character limit set by the Pydantic schema validation rule for testing purposes", "content": "Testing over-length title validation", "tag": "test", "owner_id": 1}

Response (422):
```json
{
  "detail": [{
    "type": "string_too_long", "loc": ["body", "title"],
    "msg": "String should have at most 120 characters",
    "ctx": {"max_length": 120}
  }]
}
```

**Missing required field (title on Note):**

POST /notes
{"content": "This note has no title", "tag": "test", "owner_id": 1}

Response (422):
```json
{
  "detail": [{
    "type": "missing", "loc": ["body", "title"],
    "msg": "Field required"
  }]
}
```

### Duplicate email — UNIQUE constraint (400)

POST /users
{"name": "Alice2", "email": "alice@example.com", "password": "alicepass123"}

Response (400):
```json
{"detail": "Email already registered"}
```

### Note creation (POST /notes) — owner validation

**Valid owner_id — success:**

POST /notes
{"title": "Standup Summary", "content": "Discussed sprint progress, blockers on the payments API integration, and the plan for the demo on Friday.", "tag": "work", "owner_id": 1}

Response (200): note created with `id: 1`, `owner_id: 1`.

**Invalid owner_id — 404:**

POST /notes
{"title": "Ghost Note", "content": "This should fail because owner doesn't exist.", "tag": "test", "owner_id": 999}

Response (404):
```json
{"detail": "owner_id does not exist"}
```

### Background task — non-blocking proof

Terminal log:

INFO: "POST /notes HTTP/1.1" 200 OK
INFO:zomato-notes:[background] Finished indexing note: Standup Summary

The response returned (200 OK) **before** the background indexing log line appeared — confirming `BackgroundTasks` runs asynchronously and does not block the API response.

### DELETE /notes/{id} — auth token verification

**Wrong token — 403:**

DELETE /notes/1
Headers: x-token: wrongtoken123

Response (403): `{"detail": "Invalid or missing x-token"}`

**Correct token — 200:**

DELETE /notes/1
Headers: x-token: changeme123

Response (200): `{"message": "Note deleted"}`

### Bulk import (POST /notes/import)

**Valid owner — success:**

POST /notes/import?owner_id=1
File: sample_import.txt (5 non-empty lines)

Response (200): `{"created_count": 5}` — one note created per line.

**Invalid owner — 404, zero notes created:**

POST /notes/import?owner_id=999
File: sample_import.txt

Response (404): `{"detail": "owner_id does not exist"}` — no partial import, zero notes created.

### Report endpoints (raw SQL)

**GET /reports/tag-summary:**
```json
[
  {"tag": "health", "note_count": 2},
  {"tag": "random", "note_count": 2},
  {"tag": "recipes", "note_count": 2},
  {"tag": "work", "note_count": 3}
]
```
Matches expected result exactly (work=3, health=2, recipes=2, random=2); `travel` correctly excluded (only 1 note, filtered by `HAVING COUNT(*) > 1`).

**GET /reports/long-notes:** returns notes whose content length exceeds the dataset's average content length (raw SQL subquery), e.g. "Standup Summary", "Sprint Retro Notes", "Doctor Visit".

**GET /reports/user-notes:**
```json
[
  {"id": 1, "name": "Alice", "email": "alice@example.com", "note_count": 6},
  {"id": 2, "name": "Bob", "email": "bob@example.com", "note_count": 4}
]
```
Raw SQL JOIN between `users` and `notes` correctly counts each user's notes.

### Basic CRUD verification

- `GET /notes` — returns all seeded notes correctly.
- `GET /notes?tag=work` — filters correctly, returns exactly 3 work-tagged notes.
- `GET /notes/2` — returns the exact note by id.
- `PUT /notes/2` (partial update, `{"tag": "work-updated"}`) — only the tag field changes; title/content/owner_id remain untouched, confirming partial-update logic works.

---

## Frontend Feature Verification (Part 1B)

- **End-to-end integration:** added a note through the UI, refreshed the browser — note persisted (proving real backend persistence, not in-memory only). Deleted a note, refreshed — note stayed gone.

  DevTools Network tab — actual request/response text:

  ```
  GET /notes HTTP/1.1  →  200 OK
  Response: [{"id":1,"title":"Standup Summary","content":"Discussed sprint progress, blockers on the payments API integration, and the plan for the demo on Friday.","tag":"work","owner_id":1,"created_at":"2026-07-27T07:20:50.483205"},...]

  POST /notes HTTP/1.1  →  200 OK
  Request body: {"title":"Fish Curry Recipe","content":"A quick fish curry with coconut milk.","tag":"recipes","owner_id":1}
  Response: {"id":11,"title":"Fish Curry Recipe","content":"A quick fish curry with coconut milk.","tag":"recipes","owner_id":1,"created_at":"2026-07-27T08:10:22.112345","ai_suggestion":{"tags":["quick","fish","curry"],"summary":"A quick fish curry with coconut milk"}}

  DELETE /notes/11 HTTP/1.1  →  200 OK
  Headers sent: x-token: changeme123
  Response: {"message":"Note deleted"}
  ```
- **CORS:** frontend (`http://127.0.0.1:5500`) successfully calls backend (`http://127.0.0.1:8000`) with zero CORS errors in browser DevTools console (only an unrelated, harmless `favicon.ico` 404).
- **Dynamic rendering:** all notes rendered via `document.createElement()`/`appendChild()`, no hardcoded HTML.
- **Debounced search:** search box filters after ~400ms of no typing. Verified by opening browser DevTools console and typing quickly into the search box — the filter only fired once after I stopped typing, not on every keystroke. The `setTimeout`/`clearTimeout` pattern in `script.js` cancels the previous timer on each `input` event, so only the final call after the 400ms pause runs.
- **Recursive tag tree:** the exact `CATEGORY_TREE` (9 nodes, 4 levels) renders correctly; every node's expand/collapse toggle works via a single recursive function.
- **Responsive layout:** `@media (max-width: 600px)` rule switches `main` to a single column; verified by resizing the browser window.

  Exact CSS rule from `style.css`:
  ```css
  @media (max-width: 600px) {
    main {
      flex-direction: column;
    }

    #sidebar {
      width: 100%;
    }

    .control-group {
      flex-direction: column;
      align-items: flex-start;
    }
  }
  ```
- **Sticky nav:** header stays visible while scrolling.
- **Client-side validation:** empty title/content blocked with an inline error message (no `alert()`).
- **Code review:** searched `script.js` for `onclick`, `alert(`, `confirm(`, `prompt(` — zero results for all four. All events use `addEventListener()`.
---

# Part 2 — Integrated Ranking Engine

`backend/algorithms.py` implements 4 functions from scratch — no `sorted()`, `.sort()`, or any imported search/sort utility used anywhere in this file.

## Relevance search (insertion sort)

**Query "apple":**

GET /notes/search?keyword=apple

Response (200) — top 3:
```json
[
  {"id": 11, "title": "Apple Harvest Notes", "score": 3},
  {"id": 17, "title": "Garden Update", "score": 2},
  {"id": 16, "title": "Fruit Basket Plan", "score": 1}
]
```

**Query "coffee" (visibly different results):**

GET /notes/search?keyword=coffee

Response (200) — top 3:
```json
[
  {"id": 13, "title": "Coffee Tasting", "score": 2},
  {"id": 21, "title": "Kitchen Inventory", "score": 1},
  {"id": 1, "title": "Standup Summary", "score": 0}
]
```

## Date sort (reusability proof — same function, different key)

GET /notes/search?sort_by=date

Response (200) — sorted descending by `created_at_epoch`, using the same `insertion_sort_by_key()` function called with `key="created_at_epoch"` instead of `key="score"` — proving genuine reuse, not a hardcoded sort.

## Exact-title lookup (binary search — iterative & recursive)

`GET /notes/lookup?title=<exact>&algo=iterative|recursive` — DB query uses `ORDER BY title ASC` (SQL-level sort, not Python), then locates the exact match via the selected algorithm.

**5 present titles tested (both algo modes):**
- "Coffee Tasting" (iterative) → found, id 13
- "Apple Harvest Notes" (recursive) → found, id 11
- "Kitchen Inventory" (iterative) → found, id 21
- "Journal Entry" (recursive) → found, id 20
- "Budget Draft" (iterative) → found, id 12, response: `{"found":true,"id":12,"title":"Budget Draft","content":"Quarterly budget review shows spending under control across all departments.","tag":"kb-demo","owner_id":1}`

**2 absent titles tested:**
- "Nonexistent Note XYZ" (iterative) → `{"found": false, "message": "Note not found"}`
- "Made Up Title" (recursive) → `{"found": false, "message": "Note not found"}`

## Quick tag-find (linear search)

GET /notes/quick-find?tag=work

Response (200):
```json
{"found": true, "id": 1, "title": "Standup Summary", "tag": "work", "owner_id": 1}
```

Empty tag test (no crash):

GET /notes/quick-find?tag=nonexistent-tag

Response (200): `{"found": false, "message": "No note found with this tag"}`

## Frontend controls (Part 2)

- **"Sort by: Relevance / Date"** dropdown — calls `GET /notes/search` with the appropriate parameters, re-renders results.
- **"Jump to exact title"** input (press Enter) + algo selector — calls `GET /notes/lookup`, scrolls to and highlights the found note card.
- **"Quick tag jump"** buttons (work/health/recipes/travel/random) — calls `GET /notes/quick-find`, displays the first matching note.

All three verified working against the real backend in the browser (not a standalone script).

---

# Part 3 — Integrated Intelligence Layer

## LLM Auto-Tagging (mock mode — graded baseline)

`backend/ai_service.py` implements `get_ai_response(user_message, system_prompt)`. `MOCK_AI=1` (default) returns a deterministic rule-based response — first 3 significant words as tags, first sentence (≤20 words) as summary — with **zero API key, signup, or internet connection required**.

### Mock mode — valid JSON with "tags" and "summary" for 6 of 8 sample notes

**Note 1 — "Test AI Tagging":**
```json
"ai_suggestion": {"tags": ["database", "migration", "script"], "summary": "The database migration script failed overnight due to a locked table, causing delays in the morning deployment"}
```

**Note 2 — "Morning workout plan":**
```json
"ai_suggestion": {"tags": ["minutes", "cardio", "followed"], "summary": "Do 30 minutes of cardio followed by strength training focused on legs and core"}
```

**Note 3 — "Grocery list":**
```json
"ai_suggestion": {"tags": ["milk", "eggs", "spinach"], "summary": "Buy milk, eggs, spinach, chicken breast, and whole wheat bread for the week"}
```

**Note 4 — "Recipe idea":**
```json
"ai_suggestion": {"tags": ["making", "vegetable", "stir"], "summary": "Try making a vegetable stir fry with broccoli, bell peppers, and soy sauce tonight"}
```

**Note 5 — "Gym schedule change":**
```json
"ai_suggestion": {"tags": ["switch", "thursday", "move"], "summary": "Switch leg day to Thursday and move the rest day to Sunday this week"}
```

**Note 6 — "Project deadline reminder":**
```json
"ai_suggestion": {"tags": ["backend", "zomato", "notes"], "summary": "The backend API for the Zomato Notes capstone must be deployed and demoed by Friday"}
```

All 6 return valid JSON with exactly the two required keys (`"tags"` and `"summary"`). No API key, no internet, no signup needed — `MOCK_AI=1` is the graded default.

The 5-part prompt (Instructions / Context / Input / Constraints / Output Format) is defined verbatim in `ai_service.py` as `AUTO_TAG_SYSTEM_PROMPT`.

### Real integration test — POST /notes returns ai_suggestion

Request:

POST /notes
{
"title": "Test AI Tagging",
"content": "The database migration script failed overnight due to a locked table, causing delays in the morning deployment.",
"tag": "test",
"owner_id": 1
}


Response (200):
```json
{
  "id": 23,
  "title": "Test AI Tagging",
  "content": "The database migration script failed overnight due to a locked table, causing delays in the morning deployment.",
  "tag": "test",
  "owner_id": 1,
  "ai_suggestion": {
    "tags": ["database", "migration", "script"],
    "summary": "The database migration script failed overnight due to a locked table, causing delays in the morning deployment"
  }
}
```

`json.loads` failures are caught and logged; `ai_suggestion` falls back to `null` and the note is still created (verified in code — the try/except wraps the AI call in `main.py`'s `create_note`).

### Frontend verification — AI Suggests panel + Apply as tag

Added a note titled "Server crash investigation" via the UI. The new note card displayed an **"AI Suggests"** panel with generated tags (including "payment") and a summary, plus an **"Apply as tag"** button. Clicking it called `PUT /notes/{id}` and successfully changed the note's tag from "test" to "payment" — confirmed by the updated tag badge after re-render.

## Local Semantic Search (no LLM call)

`backend/semantic_search.py` uses `sentence-transformers==3.0.0` (exact pin in `requirements.txt`) with the required `sentence-transformers/all-MiniLM-L6-v2` model. Computes embeddings for the query and all `ai-demo`-tagged notes, ranks by cosine similarity.

**One-time model download:** the first call to `/notes/smart-search` downloads the model (~90MB) from HuggingFace — requires internet, one time only. Cached at `~/.cache/huggingface` (default location) afterward; every subsequent call is fully offline, no API key needed.

### Required test query 1 — "leg day exercise plan"

GET /notes/smart-search?q=leg%20day%20exercise%20plan

Response (200) — top 3:
```json
[
  {"id": 28, "title": "Gym schedule change", "similarity_score": 0.6545901298522949},
  {"id": 23, "title": "Morning workout plan", "similarity_score": 0.6398992538452148},
  {"id": 30, "title": "Weekend hiking trip", "similarity_score": 0.4038715660572052}
]
```
✅ "Gym schedule change" appears in top 3, as required.

### Required test query 2 — "dinner ideas with vegetables"

GET /notes/smart-search?q=dinner%20ideas%20with%20vegetables

Response (200) — top 3:
```json
[
  {"id": 27, "title": "Recipe idea", "similarity_score": 0.5556811690330505},
  {"id": 24, "title": "Grocery list", "similarity_score": 0.423724502325058},
  {"id": 30, "title": "Weekend hiking trip", "similarity_score": 0.22370734810829163}
]
```
✅ "Recipe idea" appears in top 3, as required.

### Frontend — Smart Search (AI) control

The "Smart Search (AI)" input is visually distinct (purple theme, separate section) from the Part 2 plain keyword search. Tested with query "dinner ideas" — correctly displayed "Grocery list", "Recipe idea", and "Weekend hiking trip" ranked by similarity score, calling the real `GET /notes/smart-search` endpoint.

No image or vision API calls are made anywhere in Part 3.

---

## Git Workflow

Development was done on the `feature/part1-core-app` branch, with incremental commits progressing through Part 1 (backend, then frontend), Part 2 (backend, then frontend), and Part 3 (backend, then frontend), each tested and verified before moving to the next. Merged into `main` via Pull Request before submission.

## Originality

This project was built with AI assistance (Claude) for code generation and debugging, but all design decisions, testing, and verification were done manually against the assignment's exact requirements.