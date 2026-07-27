from sqlalchemy.orm import Session
from sqlalchemy import text

import models
import schemas


# ---------- User CRUD ----------

def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    db_user = models.User(
        name=user.name,
        email=user.email,
        password=user.password,  # plaintext for this demo only — never do this in production
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user(db: Session, user_id: int) -> models.User | None:
    return db.query(models.User).filter(models.User.id == user_id).first()


# ---------- Note CRUD ----------

def create_note(db: Session, note: schemas.NoteCreate) -> models.Note:
    db_note = models.Note(
        title=note.title,
        content=note.content,
        tag=note.tag,
        owner_id=note.owner_id,
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note


def get_notes(db: Session, tag: str | None = None) -> list[models.Note]:
    query = db.query(models.Note)
    if tag:
        query = query.filter(models.Note.tag == tag)
    return query.all()


def get_note(db: Session, note_id: int) -> models.Note | None:
    return db.query(models.Note).filter(models.Note.id == note_id).first()


def update_note(db: Session, note_id: int, note_update: schemas.NoteUpdate) -> models.Note | None:
    db_note = get_note(db, note_id)
    if not db_note:
        return None
    update_data = note_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_note, field, value)
    db.commit()
    db.refresh(db_note)
    return db_note


def delete_note(db: Session, note_id: int) -> bool:
    db_note = get_note(db, note_id)
    if not db_note:
        return False
    db.delete(db_note)
    db.commit()
    return True


# ---------- Raw SQL Reports ----------

def get_tag_summary(db: Session):
    result = db.execute(text("""
        SELECT tag, COUNT(*) as note_count
        FROM notes
        GROUP BY tag
        HAVING COUNT(*) > 1
    """))
    return [{"tag": row[0], "note_count": row[1]} for row in result]


def get_long_notes(db: Session):
    result = db.execute(text("""
        SELECT id, title, content, tag, owner_id, created_at
        FROM notes
        WHERE LENGTH(content) > (SELECT AVG(LENGTH(content)) FROM notes)
    """))
    return [dict(row._mapping) for row in result]


def get_user_notes_report(db: Session):
    result = db.execute(text("""
        SELECT users.id, users.name, users.email, COUNT(notes.id) as note_count
        FROM users
        LEFT JOIN notes ON users.id = notes.owner_id
        GROUP BY users.id, users.name, users.email
    """))
    return [{"id": row[0], "name": row[1], "email": row[2], "note_count": row[3]} for row in result]