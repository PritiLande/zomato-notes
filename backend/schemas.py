from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------- User schemas ----------

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("name cannot be empty or whitespace only")
        return v


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True  # allows returning SQLAlchemy model objects directly


# ---------- Note schemas ----------

class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1)
    tag: Optional[str] = None
    owner_id: int


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    content: Optional[str] = Field(default=None, min_length=1)
    tag: Optional[str] = None


class NoteResponse(BaseModel):
    id: int
    title: str
    content: str
    tag: Optional[str]
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True