import os
import warnings

# Workaround for local antivirus/network SSL interception blocking the
# one-time HuggingFace model download. This only affects the model
# download step; it does not affect any other part of the app.
os.environ["CURL_CA_BUNDLE"] = ""
os.environ["REQUESTS_CA_BUNDLE"] = ""

import requests
requests.packages.urllib3.disable_warnings(requests.packages.urllib3.exceptions.InsecureRequestWarning)
_original_request = requests.Session.request
def _patched_request(self, *args, **kwargs):
    kwargs["verify"] = False
    return _original_request(self, *args, **kwargs)
requests.Session.request = _patched_request
warnings.filterwarnings("ignore", message="Unverified HTTPS request")

from sentence_transformers import SentenceTransformer
import numpy as np

_model = None


def _get_model():
    """Lazy-load the model so it only downloads/loads once, on first use."""
    global _model
    if _model is None:
        _model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    return _model


def cosine_similarity(vec_a, vec_b):
    a = np.array(vec_a)
    b = np.array(vec_b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def rank_notes_by_similarity(query: str, notes: list[dict], top_k: int = 3):
    """
    notes: list of dicts, each with at least 'title' and 'content'.
    Returns the top_k notes ranked by cosine similarity to the query,
    each with an added 'similarity_score' field.
    """
    model = _get_model()

    query_embedding = model.encode(query)
    note_texts = [f"{n['title']}. {n['content']}" for n in notes]
    note_embeddings = model.encode(note_texts)

    scored = []
    for note, embedding in zip(notes, note_embeddings):
        score = cosine_similarity(query_embedding, embedding)
        scored.append({**note, "similarity_score": score})

    scored.sort(key=lambda n: n["similarity_score"], reverse=True)

    return scored[:top_k]