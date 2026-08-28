"""Iteration 5 - Logo BUMDES integration checks.
- All 6 PDF endpoints return valid PDF with size > 300KB (embedded logo).
- PDF text still contains 'KARYA RAHARJA', 'Direktur BUMDES', 'Bendahara BUMDES', 'Pangandaran'.
- PDF text has NO literal '<b>' tag.
- Static assets served: /logo-bumdes.webp (via frontend public path is a frontend concern; here we verify backend png exists).
- Login flow still works for admin.
- Dashboard endpoint still returns KPI + role greeting works via login (frontend concern).
"""

import io
import os
import pathlib
import pytest
import requests
from pypdf import PdfReader

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def hdr(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# -- Backend static asset check for PDF logo --
def test_backend_logo_png_exists():
    p = pathlib.Path("/app/backend/logo-bumdes.png")
    assert p.exists() and p.stat().st_size > 100_000, "Backend PNG logo missing or too small"


# -- Login smoke (all 3 seeded roles) --
@pytest.mark.parametrize("u,p", [("admin", "admin123"), ("budianto", "direktur123"), ("riska", "bendahara123")])
def test_login_all_roles(u, p):
    r = requests.post(f"{BASE}/auth/login", json={"username": u, "password": p}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data and "user" in data
    assert data["user"]["role"] in ("admin", "direktur", "bendahara")


# -- Dashboard non-regression --
def test_dashboard(hdr):
    r = requests.get(f"{BASE}/reports/dashboard", headers=hdr, timeout=30)
    assert r.status_code == 200
    d = r.json()
    # Basic KPI keys sanity
    assert isinstance(d, dict) and len(d) > 0


def _extract_pdf_text(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    parts = []
    for pg in reader.pages:
        parts.append(pg.extract_text() or "")
    return "\n".join(parts)


PDF_ENDPOINTS = [
    ("laba-rugi", {"start_date": "2025-01-01", "end_date": "2025-12-31"}),
    ("neraca", {"as_of_date": "2025-12-31"}),
    ("arus-kas", {"start_date": "2025-01-01", "end_date": "2025-12-31"}),
    ("perubahan-ekuitas", {"start_date": "2025-01-01", "end_date": "2025-12-31"}),
    ("per-unit", {"start_date": "2025-01-01", "end_date": "2025-12-31"}),
    ("calk", {"start_date": "2025-01-01", "end_date": "2025-12-31"}),
]


@pytest.mark.parametrize("endpoint,params", PDF_ENDPOINTS)
def test_pdf_endpoint(hdr, endpoint, params):
    r = requests.get(f"{BASE}/reports/{endpoint}/pdf", headers=hdr, params=params, timeout=60)
    assert r.status_code == 200, f"{endpoint}: {r.status_code} {r.text[:200]}"
    content = r.content
    assert content.startswith(b"%PDF"), f"{endpoint}: not a valid PDF"
    # Logo embedded -> size should be larger. Logo PNG is 900KB; ReportLab embeds raw or compresses.
    # Requirement: > 300KB
    assert len(content) > 300_000, f"{endpoint}: PDF size {len(content)} bytes < 300KB (logo may not be embedded)"

    text = _extract_pdf_text(content)
    assert "KARYA RAHARJA" in text.upper(), f"{endpoint}: missing 'KARYA RAHARJA'"
    assert "Pangandaran" in text or "PANGANDARAN" in text.upper(), f"{endpoint}: missing 'Pangandaran'"
    assert "Direktur BUMDES" in text or "DIREKTUR BUMDES" in text.upper(), f"{endpoint}: missing 'Direktur BUMDES'"
    assert "Bendahara BUMDES" in text or "BENDAHARA BUMDES" in text.upper(), f"{endpoint}: missing 'Bendahara BUMDES'"
    assert "<b>" not in text, f"{endpoint}: literal '<b>' leaked into text"


# -- Non-regression: core listing endpoints --
def test_list_accounts(hdr):
    r = requests.get(f"{BASE}/accounts", headers=hdr, timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list) and len(r.json()) > 0


def test_list_transactions(hdr):
    r = requests.get(f"{BASE}/transactions", headers=hdr, timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_list_users(hdr):
    r = requests.get(f"{BASE}/users", headers=hdr, timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_list_transaction_types(hdr):
    r = requests.get(f"{BASE}/transaction-types", headers=hdr, timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list) and len(r.json()) > 0
