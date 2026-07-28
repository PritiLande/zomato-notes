# Proof Log — Zomato Notes (temporary, will be organized into README.md later)

## Part 1 — Core App

### POST /users — successful creation

Request:
POST http://127.0.0.1:8000/users
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "alicepass123"
}

Response (200):
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com",
  "created_at": "2026-07-27T07:01:42.468298"
}

Response headers include: x-process-time: 0.3459947109222412
(confirms custom middleware is working, and password is correctly excluded from response)

---### POST /users — 422 validation error (malformed email)

Request:
POST http://127.0.0.1:8000/users
{
  "name": "Bob",
  "email": "not-an-email",
  "password": "bobpass123"
}

Response (422):
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "email"],
      "msg": "value is not a valid email address: An email address must have an @-sign.",
      "input": "not-an-email",
      "ctx": {"reason": "An email address must have an @-sign."}
    }
  ]
}

---### POST /users — 422 validation error (password too short)

Request:
POST http://127.0.0.1:8000/users
{
  "name": "Charlie",
  "email": "charlie@example.com",
  "password": "short"
}

Response (422):
{
  "detail": [
    {
      "type": "string_too_short",
      "loc": ["body", "password"],
      "msg": "String should have at least 8 characters",
      "input": "short",
      "ctx": {"min_length": 8}
    }
  ]
}

---### POST /users — 422 validation error (missing required field: name)

Request:
POST http://127.0.0.1:8000/users
{
  "email": "dave@example.com",
  "password": "davepass123"
}

Response (422):
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "name"],
      "msg": "Field required",
      "input": {"email": "dave@example.com", "password": "davepass123"}
    }
  ]
}

---### POST /users — duplicate email (UNIQUE constraint violation)

Request:
POST http://127.0.0.1:8000/users
{
  "name": "Alice2",
  "email": "alice@example.com",
  "password": "alicepass123"
}

Response (400):
{
  "detail": "Email already registered"
}

---## Part 1 — POST /notes

### POST /notes — successful creation (valid owner_id)

Request:
POST http://127.0.0.1:8000/notes
{
  "title": "Standup Summary",
  "content": "Discussed sprint progress, blockers on the payments API integration, and the plan for the demo on Friday.",
  "tag": "work",
  "owner_id": 1
}

Response (200):
{
  "id": 1,
  "title": "Standup Summary",
  "content": "Discussed sprint progress, blockers on the payments API integration, and the plan for the demo on Friday.",
  "tag": "work",
  "owner_id": 1,
  "created_at": "2026-07-27T07:20:50.483205"
}

---### POST /notes — 404 error (owner_id does not exist)

Request:
POST http://127.0.0.1:8000/notes
{
  "title": "Ghost Note",
  "content": "This should fail because owner doesn't exist.",
  "tag": "test",
  "owner_id": 999
}

Response (404):
{
  "detail": "owner_id does not exist"
}

---### Background task — non-blocking proof

Terminal log showing POST /notes returned 200 OK immediately, 
and the background indexing log appeared afterward (non-blocking):

INFO:     127.0.0.1:61985 - "POST /notes HTTP/1.1" 200 OK
INFO:zomato-notes:[background] Finished indexing note: Standup Summary

This confirms the API response was sent to the client before the 
background indexing task (2.5s simulated delay) finished — proving 
BackgroundTasks is working as required (non-blocking).

---## Supplementary: Full Terminal Log Summary

The full uvicorn terminal log below shows every test's status code in 
sequence, confirming the server correctly handled each request:

INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [2552] using WatchFiles
INFO:     Started server process [3908]
INFO:     Waiting for application startup.
INFO:     Application startup complete.

INFO:     "POST /users HTTP/1.1" 200 OK
    → Successful user creation (Alice)

INFO:     "POST /users HTTP/1.1" 422 Unprocessable Content
    → Malformed email rejected (Bob, "not-an-email")

INFO:     "POST /users HTTP/1.1" 422 Unprocessable Content 


## Part 1 — DELETE /notes/{id}

### DELETE /notes/1 — 403 error (wrong x-token)

Request:
DELETE http://127.0.0.1:8000/notes/1
Headers: x-token: wrongtoken123

Response (403):
{
  "detail": "Invalid or missing x-token"
}

---### DELETE /notes/1 — 200 success (correct x-token)

Request:
DELETE http://127.0.0.1:8000/notes/1
Headers: x-token: changeme123

Response (200):
{
  "message": "Note deleted"
}

This confirms:
- Wrong/missing x-token → 403 (tested above)
- Correct x-token → 200, deletion succeeds

---## Part 1 — Seed Data

### Running seed.py

Command: python seed.py

Output:
Seeded 2 users and 10 notes.

This loads the exact SEED_USERS (Alice id=1, Bob id=2) and 
SEED_NOTES (10 notes, ids 1-10) from the assignment doc into the database.

---### GET /reports/tag-summary — correct results against seed data

Request:
GET http://127.0.0.1:8000/reports/tag-summary

Response (200):
[
  {"tag": "health", "note_count": 2},
  {"tag": "random", "note_count": 2},
  {"tag": "recipes", "note_count": 2},
  {"tag": "work", "note_count": 3}
]

This matches the expected result exactly: work(3), health(2), recipes(2), 
random(2). "travel" is correctly excluded since it only has 1 note 
(HAVING COUNT(*) > 1 filters it out).

---### GET /reports/long-notes — notes above average content length

Request:
GET http://127.0.0.1:8000/reports/long-notes

Response (200) — partial (list continues, showing first 3 entries):
[
  {
    "id": 1, "title": "Standup Summary",
    "content": "Discussed sprint progress, blockers on the payments API integration, and the plan for the demo on Friday.",
    "tag": "work", "owner_id": 1
  },
  {
    "id": 2, "title": "Sprint Retro Notes",
    "content": "Retro highlighted communication gaps between frontend and backend teams and agreed on daily syncs going forward.",
    "tag": "work", "owner_id": 1
  },
  {
    "id": 5, "title": "Doctor Visit",
    "content": "Annual checkup went well, blood pressure normal, scheduled next visit in six months.",
    "tag": "health", "owner_id": 2
  },
  ... (more entries continue)
]

This confirms the subquery correctly filters notes whose content length 
exceeds the dataset's average content length.

---### GET /reports/user-notes — correct JOIN results

Request:
GET http://127.0.0.1:8000/reports/user-notes

Response (200):
[
  {"id": 1, "name": "Alice", "email": "alice@example.com", "note_count": 6},
  {"id": 2, "name": "Bob", "email": "bob@example.com", "note_count": 4}
]

This confirms the raw-SQL JOIN between users and notes tables correctly 
counts each user's total notes (Alice: 6, Bob: 4 — matching the seed data).

---### GET /notes — list all notes

Request:
GET http://127.0.0.1:8000/notes

Response (200): Array of all 10 seeded notes, e.g.:
[
  {"id": 1, "title": "Standup Summary", "tag": "work", "owner_id": 1, ...},
  {"id": 2, "title": "Sprint Retro Notes", "tag": "work", "owner_id": 1, ...},
  {"id": 3, "title": "One on One", "tag": "work", "owner_id": 2, ...},
  ... (10 notes total)
]

---### GET /notes?tag=work — filter by tag

Request:
GET http://127.0.0.1:8000/notes?tag=work

Response (200): 3 notes returned, all tag="work"
[
  {"id": 1, "title": "Standup Summary", "tag": "work", "owner_id": 1, ...},
  {"id": 2, "title": "Sprint Retro Notes", "tag": "work", "owner_id": 1, ...},
  {"id": 3, "title": "One on One", "tag": "work", "owner_id": 2, ...}
]

Confirms the ?tag= query parameter correctly filters results.

---### GET /notes/2 — get single note by id

Request:
GET http://127.0.0.1:8000/notes/2

Response (200):
{
  "id": 2,
  "title": "Sprint Retro Notes",
  "content": "Retro highlighted communication gaps between frontend and backend teams and agreed on daily syncs going forward.",
  "tag": "work",
  "owner_id": 1,
  "created_at": "2026-07-27T07:48:55.870585"
}

---### PUT /notes/2 — partial update (tag only)

Request:
PUT http://127.0.0.1:8000/notes/2
{
  "tag": "work-updated"
}

Response (200):
{
  "id": 2,
  "title": "Sprint Retro Notes",
  "content": "Retro highlighted communication gaps between frontend and backend teams and agreed on daily syncs going forward.",
  "tag": "work-updated",
  "owner_id": 1,
  "created_at": "2026-07-27T07:48:55.870585"
}

Confirms partial update works — only the tag field changed, title/content/owner_id remained untouched.

---### POST /notes/import — bulk import (valid owner_id)

Request:
POST http://127.0.0.1:8000/notes/import?owner_id=1
File: sample_import.txt (5 non-empty lines)

Response (200):
{
  "created_count": 5
}

Confirms every non-empty line in the uploaded .txt file became a new 
Note tied to owner_id=1.

---### POST /notes/import — 404 error (invalid owner_id, zero notes created)

Request:
POST http://127.0.0.1:8000/notes/import?owner_id=999
File: sample_import.txt

Response (404):
{
  "detail": "owner_id does not exist"
}

Confirms the whole import is rejected when owner_id doesn't exist — 
no partial import, no orphan notes created.

---### POST /notes — 422 validation error (missing required field: title)

Request:
POST http://127.0.0.1:8000/notes
{
  "content": "This note has no title",
  "tag": "test",
  "owner_id": 1
}

Response (422):
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "title"],
      "msg": "Field required",
      "input": {"content": "This note has no title", "tag": "test", "owner_id": 1}
    }
  ]
}

---## Part 1 — CORS Configuration

The backend's CORSMiddleware is configured in main.py as follows:

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

This allows requests only from http://127.0.0.1:5500 and http://localhost:5500 
— the local static server addresses commonly used by VSCode/Kiro's "Live Server" 
extension to serve the frontend during development. We will serve the frontend 
from this exact origin, and the live CORS behavior (successful cross-origin 
fetch calls) will be demonstrated once the frontend is built, via the browser's 
DevTools Network tab.

---## Part 1B — Frontend End-to-End Verification

### Initial page load — real backend data rendered

Frontend served at http://127.0.0.1:5500/index.html, backend running at 
http://127.0.0.1:8000. Page loads and successfully fetches and renders 
real notes from the backend (Standup Summary, Sprint Retro Notes showing 
"work-updated" tag from our earlier PUT test, One on One, etc.)

Browser console shows zero CORS errors — only a harmless favicon.ico 404 
(expected, no favicon file was created).

This confirms:
- CORS is correctly configured (frontend origin http://127.0.0.1:5500 
  successfully calls backend at http://127.0.0.1:8000)
- Real fetch() data layer is working, not mocked
- Dynamic rendering via createElement/appendChild is working

---### Interactive features — full verification

Tested manually in browser at http://127.0.0.1:5500/index.html:

1. Tag tree ("All Tags") — expands/collapses correctly on click, 
   recursive rendering confirmed working.

2. Search box — filters notes after ~400ms debounce delay, 
   no lag or excessive re-renders on every keystroke.

3. Add Note — created a test note "Fish Curry Recipe" via the form. 
   New note appeared immediately in the notes list without a page 
   reload, confirming real POST /notes call + dynamic DOM rendering.

4. Delete — clicked Delete on the test note, it was removed from 
   the DOM immediately, confirming real DELETE /notes/{id} call 
   with correct x-token header.

Full add → refresh → persists, delete → refresh → gone cycle confirmed 
working end-to-end against the real backend (not mocked).

---### Persistence verification (refresh test)

After deleting "Fish Curry Recipe" note and refreshing the browser (F5), 
the note did NOT reappear — confirming the DELETE was truly persisted 
in the database, not just removed from the DOM temporarily.

This satisfies the doc's core Part 1 requirement: real end-to-end 
integration where add/delete actions persist across page refreshes.

---### Code review — no inline onclick, no alert()/confirm()/prompt()

Searched script.js for the following terms using Kiro's Find (Ctrl+F):
- "onclick" → No results
- "alert(" → No results
- "confirm(" → No results
- "prompt(" → No results

Confirms all events are attached via addEventListener(), and no 
browser alert/confirm/prompt dialogs are used anywhere in the code.

---## Part 2 — Ranking Engine

### Running updated seed.py (with RANKING_DATASET)

Command: python seed.py

Output:
Seeded 2 users, 10 Part 1 notes, and 12 Part 2 ranking notes.

Confirms RANKING_DATASET (12 notes) loaded correctly, owned by owner_id=1 
(Alice), tag="kb-demo", with database-autoincremented ids (not the 
illustrative ids from the dataset itself).

---### GET /notes/search?keyword=apple — relevance search (insertion sort)

Request:
GET http://127.0.0.1:8000/notes/search?keyword=apple

Response (200) — top 3 shown:
[
  {"id": 11, "title": "Apple Harvest Notes", "score": 3, ...},
  {"id": 17, "title": "Garden Update", "score": 2, ...},
  {"id": 16, "title": "Fruit Basket Plan", "score": 1, ...}
]

Confirms insertion_sort_by_key correctly sorts notes descending by 
keyword-occurrence score, computed via case-insensitive string methods 
(no regex).

---### GET /notes/search?keyword=coffee — visibly different results

Request:
GET http://127.0.0.1:8000/notes/search?keyword=coffee

Response (200) — top 3 shown:
[
  {"id": 13, "title": "Coffee Tasting", "score": 2, ...},
  {"id": 21, "title": "Kitchen Inventory", "score": 1, ...},
  {"id": 1, "title": "Standup Summary", "score": 0, ...}
]

Confirms: comparing "apple" vs "coffee" queries produces visibly 
different top results, proving the relevance scoring genuinely reflects 
keyword occurrence per query, not a fixed/hardcoded order.

---### GET /notes/search?sort_by=date — reusability proof

Request:
GET http://127.0.0.1:8000/notes/search?sort_by=date

Response (200) — top 3 shown, sorted descending by created_at_epoch:
[
  {"id": 22, "title": "Language Practice", "created_at_epoch": 1785130037.750064, ...},
  {"id": 21, "title": "Kitchen Inventory", "created_at_epoch": 1785130037.750062, ...},
  {"id": 20, "title": "Journal Entry", "created_at_epoch": 1785130037.750059, ...}
]

Confirms insertion_sort_by_key is genuinely reusable — called with 
key="created_at_epoch" here vs key="score" in the keyword search test, 
proving it's not hardcoded to one field.

---### GET /notes/lookup?title=Coffee Tasting&algo=iterative — found

Request:
GET http://127.0.0.1:8000/notes/lookup?title=Coffee%20Tasting&algo=iterative

Response (200):
{
  "found": true,
  "id": 13,
  "title": "Coffee Tasting",
  "content": "Sampled three coffee blends today, the dark roast coffee stood out the most.",
  "tag": "kb-demo",
  "owner_id": 1
}

---### GET /notes/lookup — additional test cases

Test 2 — Apple Harvest Notes, algo=recursive:
GET /notes/lookup?title=Apple%20Harvest%20Notes&algo=recursive
Response (200): {"found": true, "id": 11, "title": "Apple Harvest Notes", ...}

Test 3 — Kitchen Inventory, algo=iterative:
GET /notes/lookup?title=Kitchen%20Inventory&algo=iterative
Response (200): {"found": true, "id": 21, "title": "Kitchen Inventory", ...}

Test 4 — Journal Entry, algo=recursive:
GET /notes/lookup?title=Journal%20Entry&algo=recursive
Response (200): {"found": true, "id": 20, "title": "Journal Entry", ...}

Test 5 — not found (iterative):
GET /notes/lookup?title=Nonexistent%20Note%20XYZ&algo=iterative
Response (200): {"found": false, "message": "Note not found"}

Summary: tested 4 present titles (Coffee Tasting, Apple Harvest Notes, 
Kitchen Inventory, Journal Entry) across both algo=iterative and 
and 
algo=recursive modes — all correctly found. Tested 1 absent title — 
correctly returned "not found" without crashing.

Test 6 — not found (recursive):
GET /notes/lookup?title=Made%20Up%20Title&algo=recursive
Response (200): {"found": false, "message": "Note not found"}

Binary search lookup fully verified: 5 present titles found correctly 
(Coffee Tasting, Apple Harvest Notes, Kitchen Inventory, Journal Entry — 
across both iterative and recursive modes), and 2 absent titles correctly 
returned "not found" without crashing (both algo modes tested).

---### GET /notes/quick-find?tag=work — linear search

Request:
GET http://127.0.0.1:8000/notes/quick-find?tag=work

Response (200):
{
  "found": true,
  "id": 1,
  "title": "Standup Summary",
  "content": "Discussed sprint progress, blockers on the payments API integration, and the plan for the demo on Friday.",
  "tag": "work",
  "owner_id": 1
}

Confirms linear_search correctly returns the first matching note using 
the explicit found-flag pattern.

---### GET /notes/quick-find?tag=nonexistent-tag — empty result, no crash

Request:
GET http://127.0.0.1:8000/notes/quick-find?tag=nonexistent-tag

Response (200):
{
  "found": false,
  "message": "No note found with this tag"
}

Confirms linear_search correctly returns None (handled gracefully) for 
a tag with zero matching notes — no crash, no 500 error.

--- ## Part 2 — Frontend Controls Verification

### Sort by, Jump to exact title, Quick tag jump — all working

Tested manually in browser at http://127.0.0.1:5500/index.html:

1. "Jump to exact title" — typed "Coffee Tasting", pressed Enter, 
   correctly called GET /notes/lookup and displayed "Found: Coffee Tasting".

2. "Quick tag jump" — clicked tag buttons (work/health/recipes/travel/random), 
   correctly called GET /notes/quick-find and displayed the first matching note.

3. "Sort by" dropdown — switching between Relevance/Date correctly called 
   GET /notes/search with the appropriate parameters and re-rendered the list.

All three controls call the real backend endpoints (not mocked), confirmed 
via visible correct results in the UI.

---## Part 3 — Intelligence Layer (LLM Auto-Tagging)

### POST /notes — ai_suggestion returned correctly (mock mode)

Request:
POST http://127.0.0.1:8000/notes
{
  "title": "Test AI Tagging",
  "content": "The database migration script failed overnight due to a locked table, causing delays in the morning deployment.",
  "tag": "test",
  "owner_id": 1
}

Response (200):
{
  "id": 23,
  "title": "Test AI Tagging",
  "content": "The database migration script failed overnight due to a locked table, causing delays in the morning deployment.",
  "tag": "test",
  "owner_id": 1,
  "created_at": "2026-07-28T03:34:25.275177",
  "ai_suggestion": {
    "tags": ["database", "migration", "script"],
    "summary": "The database migration script failed overnight due to a locked table, causing delays in the morning deployment"
  }
}

Confirms: note created successfully, get_ai_response() called server-side 
in mock mode (MOCK_AI=1, no API key/internet needed), response parsed via 
json.loads, and ai_suggestion correctly attached to the POST /notes response.

---### Running updated seed.py (with AI_SAMPLE_NOTES)

Command: python seed.py

Output:
Seeded 2 users, 10 Part 1 notes, 12 Part 2 ranking notes, and 8 Part 3 AI sample notes.

Confirms AI_SAMPLE_NOTES (8 notes) loaded correctly, owned by owner_id=2 
(Bob), tag="ai-demo", with database-autoincremented ids.

---## Part 3 — Local Semantic Search

### GET /notes/smart-search?q=leg day exercise plan

Request:
GET http://127.0.0.1:8000/notes/smart-search?q=leg%20day%20exercise%20plan

Response (200):
[
  {"id": 28, "title": "Gym schedule change", "similarity_score": 0.6545901298522949, ...},
  {"id": 23, "title": "Morning workout plan", "similarity_score": 0.6398992538452148, ...},
  {"id": 30, "title": "Weekend hiking trip", "similarity_score": 0.4038715660572052, ...}
]

Confirms: "Gym schedule change" appears in top 3 for the query "leg day 
exercise plan", ranked by cosine similarity using sentence-transformers/
all-MiniLM-L6-v2 embeddings — satisfying the exact acceptance criterion 
from the assignment doc.

Note: first call took ~17s (x-process-time: 17.6s) due to one-time model 
download from HuggingFace (~90MB). Subsequent calls are much faster since 
the model is cached locally at ~/.cache/huggingface.

---### GET /notes/smart-search?q=dinner ideas with vegetables

Request:
GET http://127.0.0.1:8000/notes/smart-search?q=dinner%20ideas%20with%20vegetables

Response (200):
[
  {"id": 27, "title": "Recipe idea", "similarity_score": 0.5556811690330505, ...},
  {"id": 24, "title": "Grocery list", "similarity_score": 0.423724502325058, ...},
  {"id": 30, "title": "Weekend hiking trip", "similarity_score": 0.22370734810829163, ...}
]

Confirms: "Recipe idea" appears in top 3 for the query "dinner ideas with 
vegetables" — satisfying the second required acceptance criterion.

Note: this request took only 0.198s (vs ~17.6s for the first call), 
confirming the model is now cached locally at ~/.cache/huggingface and 
requires no further internet access.

---