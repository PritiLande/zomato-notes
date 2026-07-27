import os
import time
import logging
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, Header, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv

import models
import schemas
import crud
from database import engine, get_db

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zomato-notes")

# Create all tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Zomato Notes API")

DELETE_AUTH_TOKEN = os.getenv("DELETE_AUTH_TOKEN", "changeme123")

# ---------- CORS ----------
# Allow only the local frontend origin (adjust if you serve frontend differently)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Custom middleware: X-Process-Time ----------
@app.middleware("http")
async def add_process_time_header(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# ---------- Auth dependency for DELETE ----------
def verify_delete_token(x_token: str = Header(...)):
    if x_token != DELETE_AUTH_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid or missing x-token")
    return True


# ---------- Background task ----------
def simulate_indexing(note_title: str):
    time.sleep(2.5)
    logger.info(f"[background] Finished indexing note: {note_title}")


# ---------- User endpoints ----------

@app.post("/users", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db, user)


# ---------- Note endpoints ----------

@app.post("/notes", response_model=schemas.NoteResponse)
def create_note(note: schemas.NoteCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    owner = crud.get_user(db, note.owner_id)
    if not owner:
        raise HTTPException(status_code=404, detail="owner_id does not exist")
    db_note = crud.create_note(db, note)
    background_tasks.add_task(simulate_indexing, db_note.title)
    return db_note


@app.get("/notes", response_model=list[schemas.NoteResponse])
def list_notes(tag: str | None = None, db: Session = Depends(get_db)):
    return crud.get_notes(db, tag=tag)


@app.get("/notes/{note_id}", response_model=schemas.NoteResponse)
def get_note(note_id: int, db: Session = Depends(get_db)):
    note = crud.get_note(db, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@app.put("/notes/{note_id}", response_model=schemas.NoteResponse)
def update_note(note_id: int, note_update: schemas.NoteUpdate, db: Session = Depends(get_db)):
    updated = crud.update_note(db, note_id, note_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Note not found")
    return updated


@app.delete("/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db), _: bool = Depends(verify_delete_token)):
    success = crud.delete_note(db, note_id)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted"}


# ---------- Bulk import ----------

@app.post("/notes/import")
async def import_notes(owner_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    owner = crud.get_user(db, owner_id)
    if not owner:
        raise HTTPException(status_code=404, detail="owner_id does not exist")

    content = await file.read()
    lines = [line.strip() for line in content.decode("utf-8").splitlines() if line.strip()]

    created_notes = []
    for line in lines:
        note = schemas.NoteCreate(title=line[:120], content=line, tag="imported", owner_id=owner_id)
        db_note = crud.create_note(db, note)
        created_notes.append(db_note)

    return {"created_count": len(created_notes)}


# ---------- Reports ----------

@app.get("/reports/tag-summary")
def tag_summary(db: Session = Depends(get_db)):
    return crud.get_tag_summary(db)


@app.get("/reports/long-notes")
def long_notes(db: Session = Depends(get_db)):
    return crud.get_long_notes(db)


@app.get("/reports/user-notes")
def user_notes(db: Session = Depends(get_db)):
    return crud.get_user_notes_report(db)