"""Extract text from PDFs and images using pdfplumber, PyMuPDF, and Tesseract OCR fallback."""

from __future__ import annotations

import io
import re
from pathlib import Path
from typing import Optional

import pdfplumber


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"[ \t]+", " ", text).strip()


def extract_with_pdfplumber(path: Path) -> str:
    parts: list[str] = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            t = page.extract_text() or ""
            if t.strip():
                parts.append(t)
    return _normalize_whitespace("\n".join(parts))


def extract_with_pymupdf(path: Path) -> str:
    try:
        import fitz  # PyMuPDF
    except ImportError:
        return ""
    doc = fitz.open(str(path))
    parts: list[str] = []
    for page in doc:
        parts.append(page.get_text("text") or "")
    doc.close()
    return _normalize_whitespace("\n".join(parts))


def _needs_ocr(text: str, min_chars: int = 40) -> bool:
    alnum = sum(1 for c in text if c.isalnum())
    return alnum < min_chars


def ocr_pdf_pages(path: Path, max_pages: int = 8) -> str:
    try:
        import pytesseract
        from pdf2image import convert_from_path
    except Exception:
        return ""

    try:
        images = convert_from_path(str(path), first_page=1, last_page=max_pages)
    except Exception:
        return ""

    parts: list[str] = []
    for img in images:
        try:
            parts.append(pytesseract.image_to_string(img) or "")
        except Exception:
            continue
    return _normalize_whitespace("\n".join(parts))


def ocr_image(path: Path) -> str:
    try:
        import pytesseract
        from PIL import Image
    except Exception:
        return ""
    try:
        img = Image.open(str(path))
        return _normalize_whitespace(pytesseract.image_to_string(img) or "")
    except Exception:
        return ""


def parse_document(path: str | Path) -> str:
    p = Path(path)
    if not p.exists():
        return ""

    suffix = p.suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"}:
        return ocr_image(p) or ""

    if suffix != ".pdf":
        return ""

    text = extract_with_pdfplumber(p)
    if not text or _needs_ocr(text):
        alt = extract_with_pymupdf(p)
        if len(alt) > len(text):
            text = alt
    if _needs_ocr(text):
        ocr_text = ocr_pdf_pages(p)
        if len(ocr_text) > len(text):
            text = ocr_text
    return text
