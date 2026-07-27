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

---