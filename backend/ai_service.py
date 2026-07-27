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
    Sends a chat-completion request to an LLM API using the standard
    system/user/assistant message format, and returns the text reply.

    If MOCK_AI is set (default), returns a deterministic rule-based
    canned response instead of making any network call — this requires
    no API key, no signup, and no internet connection.
    """
    if MOCK_AI:
        return _mock_ai_response(user_message)

    # Optional real path (not required for grading) — Groq free tier example.
    # Requires GROQ_API_KEY to be set in .env.
    try:
        from groq import Groq
        api_key = os.getenv("GROQ_API_KEY")
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.warning(f"Real AI path failed, falling back to mock: {e}")
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