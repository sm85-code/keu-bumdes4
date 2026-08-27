"""Iteration 3 - Backend hardening: readonly roles (pengawas/penasihat)
cannot POST /transactions and POST /mitra. Also verifies write-capable roles still work.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"

DEFAULTS = {
    "admin": ("admin", "admin123"),
    "direktur": ("budianto", "direktur123"),
    "bendahara": ("riska", "bendahara123"),
}

_tokens = {}


def _login(u, p):
    return requests.post(f"{API}/auth/login", json={"username": u, "password": p}, timeout=15)


def _tok(role):
    if role in _tokens:
        return _tokens[role]
    r = _login(*DEFAULTS[role])
    assert r.status_code == 200, r.text
    _tokens[role] = r.json()["access_token"]
    return _tokens[role]


def _h(role):
    return {"Authorization": f"Bearer {_tok(role)}"}


# ---------- fixtures: create readonly users, and a pengelola for regression ----------
@pytest.fixture(scope="module")
def readonly_users():
    """Create TEST_pengawas_it3 and TEST_penasihat_it3 users via admin, return tokens."""
    out = {}
    for role in ("pengawas", "penasihat"):
        uname = f"TEST_{role}_it3"
        pwd = "pass123"
        r = _login(uname, pwd)
        if r.status_code != 200:
            payload = {
                "email": f"{uname}@bumdes.id", "username": uname,
                "name": f"Test {role}", "role": role, "password": pwd,
            }
            rr = requests.post(f"{API}/auth/register", json=payload, headers=_h("admin"))
            assert rr.status_code == 200, rr.text
            r = _login(uname, pwd)
            assert r.status_code == 200
        out[role] = r.json()["access_token"]
    yield out
    # cleanup
    r = requests.get(f"{API}/users", headers=_h("admin"))
    for u in r.json():
        if u["username"].startswith("TEST_") and u["username"].endswith("_it3"):
            requests.delete(f"{API}/users/{u['id']}", headers=_h("admin"))


@pytest.fixture(scope="module")
def a_unit_id():
    units = requests.get(f"{API}/unit-usaha", headers=_h("admin")).json()
    assert units, "No unit-usaha seeded"
    return units[0]["id"]


@pytest.fixture(scope="module")
def an_account_debit():
    accs = requests.get(f"{API}/accounts", headers=_h("admin")).json()
    assert len(accs) >= 2
    return accs[0]["code"], accs[1]["code"]


def _tx_payload(unit_id, debit_code, credit_code):
    return {
        "date": "2025-03-15",
        "unit_usaha_id": unit_id,
        "transaction_type": "beban_operasional",
        "description": f"TEST_it3_tx_{uuid.uuid4().hex[:6]}",
        "amount": 1000,
        "debit_account_code": debit_code,
        "credit_account_code": credit_code,
    }


def _mitra_payload(unit_id):
    return {
        "unit_usaha_id": unit_id,
        "name": f"TEST_it3_mitra_{uuid.uuid4().hex[:6]}",
        "mitra_type": "supplier",
    }


# ==================== READONLY roles: POST must 403 ====================
class TestReadonlyBlockedFromPost:
    @pytest.mark.parametrize("role", ["pengawas", "penasihat"])
    def test_post_transaction_forbidden(self, role, readonly_users, a_unit_id, an_account_debit):
        d, k = an_account_debit
        h = {"Authorization": f"Bearer {readonly_users[role]}"}
        r = requests.post(f"{API}/transactions", json=_tx_payload(a_unit_id, d, k), headers=h)
        assert r.status_code == 403, f"{role} POST /transactions -> {r.status_code} {r.text}"
        assert "membaca" in r.json().get("detail", "").lower() or "read" in r.json().get("detail", "").lower()

    @pytest.mark.parametrize("role", ["pengawas", "penasihat"])
    def test_post_mitra_forbidden(self, role, readonly_users, a_unit_id):
        h = {"Authorization": f"Bearer {readonly_users[role]}"}
        r = requests.post(f"{API}/mitra", json=_mitra_payload(a_unit_id), headers=h)
        assert r.status_code == 403, f"{role} POST /mitra -> {r.status_code} {r.text}"

    @pytest.mark.parametrize("role", ["pengawas", "penasihat"])
    def test_reports_still_readable(self, role, readonly_users):
        h = {"Authorization": f"Bearer {readonly_users[role]}"}
        r = requests.get(f"{API}/reports/dashboard", headers=h)
        assert r.status_code == 200
        r = requests.get(f"{API}/reports/laba-rugi",
                         params={"start_date": "2025-01-01", "end_date": "2025-12-31"}, headers=h)
        assert r.status_code == 200


# ==================== Write-capable roles: POST must succeed ====================
class TestWriteRolesCanStillPost:
    @pytest.mark.parametrize("role", ["admin", "direktur", "bendahara"])
    def test_post_transaction_ok(self, role, a_unit_id, an_account_debit):
        d, k = an_account_debit
        r = requests.post(f"{API}/transactions", json=_tx_payload(a_unit_id, d, k), headers=_h(role))
        assert r.status_code == 200, f"{role} POST /transactions -> {r.status_code} {r.text}"
        tx = r.json()
        assert "id" in tx
        # cleanup
        requests.delete(f"{API}/transactions/{tx['id']}", headers=_h("admin"))

    @pytest.mark.parametrize("role", ["admin", "direktur", "bendahara"])
    def test_post_mitra_ok(self, role, a_unit_id):
        r = requests.post(f"{API}/mitra", json=_mitra_payload(a_unit_id), headers=_h(role))
        assert r.status_code == 200, f"{role} POST /mitra -> {r.status_code} {r.text}"
        mid = r.json().get("id")
        assert mid
        # verify persisted
        gr = requests.get(f"{API}/mitra", headers=_h("admin"))
        assert any(m["id"] == mid for m in gr.json())
        # cleanup
        requests.delete(f"{API}/mitra/{mid}", headers=_h("admin"))
