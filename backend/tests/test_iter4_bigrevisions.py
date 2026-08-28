"""Iteration 4 - 7 big revisions test suite:
- Excel import for transactions
- PUT /transactions/{id} RBAC
- PUT/DELETE /accounts admin-only + delete blocked when used
- Transaction-types CRUD admin-only + unit_codes support
- Arus-kas sorted by date ASC
- Per-unit sorted by code ASC
- PDF exports contain signature block + no literal <b> + KARYA RAHARJA
- Dashboard start_date/end_date filter
- Seed data unit_codes backfill
"""
import io
import os
import uuid
import pytest
import requests
from openpyxl import Workbook
from pypdf import PdfReader

def _load_url():
    if "REACT_APP_BACKEND_URL" in os.environ:
        return os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not found")


BASE = _load_url()
API = f"{BASE}/api"


# ---------- helpers ----------
def _login(u, p):
    r = requests.post(f"{API}/auth/login", json={"username": u, "password": p})
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"]


@pytest.fixture(scope="module")
def admin():
    tok, u = _login("admin", "admin123")
    return {"h": {"Authorization": f"Bearer {tok}"}, "u": u}


@pytest.fixture(scope="module")
def direktur():
    tok, u = _login("budianto", "direktur123")
    return {"h": {"Authorization": f"Bearer {tok}"}, "u": u}


@pytest.fixture(scope="module")
def bendahara():
    tok, u = _login("riska", "bendahara123")
    return {"h": {"Authorization": f"Bearer {tok}"}, "u": u}


@pytest.fixture(scope="module")
def pengelola(admin):
    # create pengelola for UU02 for testing
    uname = f"TEST_pengelola_{uuid.uuid4().hex[:6]}"
    units = requests.get(f"{API}/unit-usaha", headers=admin["h"]).json()
    uu02 = next(u for u in units if u["code"] == "UU02")
    payload = {
        "email": f"{uname}@test.id", "username": uname, "name": "TEST Pengelola",
        "password": "pass1234", "role": "pengelola", "unit_usaha_id": uu02["id"],
    }
    r = requests.post(f"{API}/auth/register", json=payload, headers=admin["h"])
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    tok, u = _login(uname, "pass1234")
    yield {"h": {"Authorization": f"Bearer {tok}"}, "u": u, "unit_id": uu02["id"], "unit_code": "UU02"}
    requests.delete(f"{API}/users/{uid}", headers=admin["h"])


# ---------- Excel Import ----------
def _make_xlsx(rows):
    wb = Workbook()
    ws = wb.active
    ws.append(["tanggal", "jenis_transaksi", "nominal", "keterangan"])
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf); buf.seek(0)
    return buf


class TestExcelImport:
    def test_bendahara_import_ok(self, bendahara):
        buf = _make_xlsx([["2025-06-01", "penerimaan_bagi_hasil_domba", 500000, "TEST import"]])
        files = {"file": ("t.xlsx", buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = requests.post(f"{API}/transactions/import", headers=bendahara["h"], files=files)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["inserted"] >= 1
        assert d["errors"] == []

    def test_import_bad_type(self, admin):
        buf = _make_xlsx([["2025-06-01", "invalid_code_xxx", 100, "bad"]])
        files = {"file": ("t.xlsx", buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = requests.post(f"{API}/transactions/import", headers=admin["h"], files=files)
        assert r.status_code == 200
        d = r.json()
        assert d["inserted"] == 0
        assert len(d["errors"]) == 1


# ---------- PUT /transactions/{id} ----------
class TestUpdateTransaction:
    def test_admin_can_edit(self, admin):
        # create
        payload = {"date": "2025-06-15", "unit_usaha_id": None,
                   "transaction_type": "modal_masuk",
                   "description": "TEST update", "amount": 100000,
                   "debit_account_code": "1-1101", "credit_account_code": "3-1101"}
        r = requests.post(f"{API}/transactions", headers=admin["h"], json=payload)
        assert r.status_code == 200
        tx_id = r.json()["id"]
        payload["amount"] = 200000
        r2 = requests.put(f"{API}/transactions/{tx_id}", headers=admin["h"], json=payload)
        assert r2.status_code == 200
        assert r2.json()["amount"] == 200000
        requests.delete(f"{API}/transactions/{tx_id}", headers=admin["h"])

    def test_pengelola_cant_edit_other_unit(self, admin, pengelola):
        # admin creates tx for UU01
        units = requests.get(f"{API}/unit-usaha", headers=admin["h"]).json()
        uu01 = next(u for u in units if u["code"] == "UU01")
        payload = {"date": "2025-06-16", "unit_usaha_id": uu01["id"],
                   "transaction_type": "penerimaan_bagi_hasil_domba",
                   "description": "TEST other unit", "amount": 50000,
                   "debit_account_code": "1-1101", "credit_account_code": "4-1101"}
        r = requests.post(f"{API}/transactions", headers=admin["h"], json=payload)
        tx_id = r.json()["id"]
        # pengelola from UU02 attempts edit
        r2 = requests.put(f"{API}/transactions/{tx_id}", headers=pengelola["h"], json=payload)
        assert r2.status_code == 403
        requests.delete(f"{API}/transactions/{tx_id}", headers=admin["h"])


# ---------- Accounts admin-only ----------
class TestAccountsRBAC:
    def test_put_delete_admin_only(self, admin, direktur, bendahara):
        code = f"9-{uuid.uuid4().hex[:4].upper()}"
        r = requests.post(f"{API}/accounts", headers=admin["h"],
                          json={"code": code, "name": "TEST Acc", "category": "aset",
                                "subcategory": "aset_lancar", "normal_balance": "debit"})
        assert r.status_code == 200
        # direktur / bendahara can't PUT
        r_d = requests.put(f"{API}/accounts/{code}", headers=direktur["h"],
                           json={"code": code, "name": "x", "category": "aset",
                                 "subcategory": "aset_lancar", "normal_balance": "debit"})
        assert r_d.status_code == 403
        r_b = requests.delete(f"{API}/accounts/{code}", headers=bendahara["h"])
        assert r_b.status_code == 403
        # admin can update + delete
        r_ok = requests.put(f"{API}/accounts/{code}", headers=admin["h"],
                            json={"code": code, "name": "TEST renamed", "category": "aset",
                                  "subcategory": "aset_lancar", "normal_balance": "debit"})
        assert r_ok.status_code == 200
        assert r_ok.json()["name"] == "TEST renamed"
        r_del = requests.delete(f"{API}/accounts/{code}", headers=admin["h"])
        assert r_del.status_code == 200

    def test_delete_fails_if_used(self, admin):
        r = requests.delete(f"{API}/accounts/1-1101", headers=admin["h"])
        # may be 400 (used) or 200 (if no tx); we accept 400 preferable
        # ensure at least one tx uses it
        assert r.status_code in (400,), r.text


# ---------- Transaction types CRUD ----------
class TestTxTypesCRUD:
    def test_admin_crud(self, admin, bendahara):
        code = f"test_tt_{uuid.uuid4().hex[:6]}"
        payload = {"code": code, "name": "TEST TT", "debit": "1-1101",
                   "credit": "4-2101", "unit_codes": ["UU01", "UU02"]}
        # bendahara forbidden
        r_b = requests.post(f"{API}/transaction-types", headers=bendahara["h"], json=payload)
        assert r_b.status_code == 403
        # admin ok
        r = requests.post(f"{API}/transaction-types", headers=admin["h"], json=payload)
        assert r.status_code == 200
        assert r.json()["unit_codes"] == ["UU01", "UU02"]
        # list contains it and unit_codes field
        lst = requests.get(f"{API}/transaction-types", headers=admin["h"]).json()
        assert all("unit_codes" in t for t in lst)
        # update
        r2 = requests.put(f"{API}/transaction-types/{code}", headers=admin["h"],
                          json={"name": "TEST TT edited", "unit_codes": ["UU03"]})
        assert r2.status_code == 200
        assert r2.json()["name"] == "TEST TT edited"
        assert r2.json()["unit_codes"] == ["UU03"]
        # delete
        r3 = requests.delete(f"{API}/transaction-types/{code}", headers=admin["h"])
        assert r3.status_code == 200

    def test_seed_has_unit_codes(self, admin):
        lst = requests.get(f"{API}/transaction-types", headers=admin["h"]).json()
        by_code = {t["code"]: t for t in lst}
        assert "unit_codes" in by_code["penerimaan_setoran_ikan"]
        assert by_code["penerimaan_setoran_ikan"]["unit_codes"] == ["UU02"]
        assert set(by_code["setoran_pengelola_ke_bumdes"]["unit_codes"]) == {
            "UU01", "UU02", "UU03", "UU04", "UU05", "UU06"}


# ---------- Reports sorting ----------
class TestReportsSorting:
    def test_arus_kas_sorted(self, admin):
        r = requests.get(f"{API}/reports/arus-kas",
                         params={"start_date": "1900-01-01", "end_date": "2099-12-31"},
                         headers=admin["h"])
        assert r.status_code == 200
        d = r.json()
        for lst in (d["kas_masuk"], d["kas_keluar"]):
            dates = [x["date"] for x in lst]
            assert dates == sorted(dates)

    def test_per_unit_sorted(self, admin):
        r = requests.get(f"{API}/reports/per-unit",
                         params={"start_date": "1900-01-01", "end_date": "2099-12-31"},
                         headers=admin["h"])
        assert r.status_code == 200
        codes = [u["code"] for u in r.json()["units"]]
        assert codes == sorted(codes)


# ---------- Dashboard date filter ----------
class TestDashboardFilter:
    def test_date_range_param(self, admin):
        r1 = requests.get(f"{API}/reports/dashboard",
                          params={"start_date": "2020-01-01", "end_date": "2020-01-02"},
                          headers=admin["h"])
        assert r1.status_code == 200
        d1 = r1.json()
        for k in ("total_pendapatan", "total_beban", "laba_bersih", "total_transactions"):
            assert k in d1


# ---------- PDF signature block ----------
def _extract(resp):
    reader = PdfReader(io.BytesIO(resp.content))
    return "\n".join(p.extract_text() or "" for p in reader.pages)


class TestPDFSignatures:
    endpoints = [
        ("/reports/laba-rugi/pdf", {"start_date": "2020-01-01", "end_date": "2099-12-31"}),
        ("/reports/neraca/pdf", {"as_of_date": "2099-12-31"}),
        ("/reports/arus-kas/pdf", {"start_date": "2020-01-01", "end_date": "2099-12-31"}),
        ("/reports/perubahan-ekuitas/pdf", {"start_date": "2020-01-01", "end_date": "2099-12-31"}),
        ("/reports/per-unit/pdf", {"start_date": "2020-01-01", "end_date": "2099-12-31"}),
        ("/reports/calk/pdf", {"start_date": "2020-01-01", "end_date": "2099-12-31"}),
    ]

    @pytest.mark.parametrize("ep,params", endpoints)
    def test_pdf_content(self, admin, ep, params):
        r = requests.get(f"{API}{ep}", params=params, headers=admin["h"])
        assert r.status_code == 200, f"{ep} status {r.status_code}"
        assert r.headers.get("content-type", "").startswith("application/pdf")
        text = _extract(r)
        assert "KARYA RAHARJA" in text, f"{ep} missing KARYA RAHARJA in: {text[:200]}"
        assert "Waharja" not in text
        assert "<b>" not in text
        assert "Direktur BUMDES" in text, f"{ep} missing direktur signature"
        assert "Bendahara BUMDES" in text, f"{ep} missing bendahara signature"
        assert "Pangandaran" in text
