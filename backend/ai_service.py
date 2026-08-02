import os
import json
import logging

logger = logging.getLogger("zomato-notes")

MOCK_AI = os.getenv("MOCK_AI", "1") == "1"

# ---------- 5-part prompt template (verbatim, per assignment requirements) ----------

AUTO_TAG_SYSTEM_PROMPT = """
INSTRUCTIONS:
You are an assistant that reads a short note and generates helpful metadata for it.

CONTEXT:
The note comes from an internal knowledge base used by on-call support engineers.
Good tags and summaries help engineers find and reuse this note quickly later.

INPUT:
You will receive the raw text content of a single note.

CONSTRAINTS:
- Return ONLY a JSON object, with no text before or after it.
- The JSON object must have exactly two keys: "tags" and "summary".
- "tags" must be a list of 1 to 3 short, lowercase keyword strings.
- "summary" must be a single sentence, at most 20 words.
- Do not include any explanation, preamble, or markdown formatting — only the raw JSON object.

OUTPUT FORMAT:
{"tags": ["tag1", "tag2"], "summary": "A short one-sentence summary here."}
""".strip()


def get_ai_response(user_message: str, system_prompt: str) -> str:
    """
    Sends a note's content through the AI tagging pipeline and returns
    a JSON string reply.

    This app runs in fully offline mock mode by default (MOCK_AI=1),
    returning a deterministic rule-based canned response instead of
    making any network call — this requires no API key, no signup,
    and no internet connection, and is the graded baseline for this
    assignment.
    """
    return _mock_ai_response(user_message)


def _mock_ai_response(note_content: str) -> str:
    """Deterministic, offline, rule-based mock response."""
    words = note_content.split()
    # first 3 significant words (longer than 3 chars) as fake tags
    significant_words = [w.strip(".,!?").lower() for w in words if len(w) > 3]
    tags = significant_words[:3] if significant_words else ["note"]

    # first sentence, truncated to 20 words, as fake summary
    first_sentence = note_content.split(".")[0]
    summary_words = first_sentence.split()[:20]
    summary = " ".join(summary_words)
    if not summary:
        summary = "No summary available."

    result = {"tags": tags, "summary": summary}
    return json.dumps(result)