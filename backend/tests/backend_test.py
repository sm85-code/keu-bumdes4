"""Backend API tests for BUMDES Karya Raharja."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"

CREDS = {
    "admin": {"username": "admin", "password": "admin123"},
    "direktur": {"username": "budianto", "password": "direktur123"},
    "bendahara": {"username": "riska", "password": "bendahara123"},
}

_tokens = {}


def _login(role):
    if role in _tokens:
        return _tokens[role]
    r = requests.post(f"{API}/auth/login", json=CREDS[role], timeout=15)
    assert r.status_code == 200, f"{role} login failed: {r.status_code} {r.text}"
    tok = r.json()["access_token"]
    _tokens[role] = tok
    return tok


def _h(role):
    return {"Authorization": f"Bearer {_login(role)}"}


# ================= AUTH =================
class TestAuth:
    def test_login_admin(self):
        r = requests.post(f"{API}/auth/login", json=CREDS["admin"])
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["username"] == "admin"
        assert data["user"]["role"] == "admin"

    def test_login_direktur(self):
        r = requests.post(f"{API}/auth/login", json=CREDS["direktur"])
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "direktur"

    def test_login_bendahara(self):
        r = requests.post(f"{API}/auth/login", json=CREDS["bendahara"])
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "bendahara"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401

    def test_me(self):
        r = requests.get(f"{API}/auth/me", headers=_h("admin"))
        assert r.status_code == 200
        assert r.json()["username"] == "admin"

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ================= UNIT USAHA / COA / TX TYPES =================
class TestSeedData:
    def test_unit_usaha_seeded(self):
        r = requests.get(f"{API}/unit-usaha", headers=_h("admin"))
        assert r.status_code == 200
        units = r.json()
        assert len(units) == 6
        codes = sorted([u["code"] for u in units])
        assert codes == ["UU01", "UU02", "UU03", "UU04", "UU05", "UU06"]

    def test_accounts_seeded(self):
        r = requests.get(f"{API}/accounts", headers=_h("admin"))
        assert r.status_code == 200
        accs = r.json()
        assert len(accs) >= 50
        cats = {a["category"] for a in accs}
        assert cats >= {"aset", "kewajiban", "ekuitas", "pendapatan", "beban"}

    def test_transaction_types(self):
        r = requests.get(f"{API}/transaction-types", headers=_h("admin"))
        assert r.status_code == 200
        types = r.json()
        assert len(types) > 10
        assert all("debit" in t and "credit" in t for t in types)


# ================= TRANSACTIONS =================
_tx_id = {"v": None}
_unit_ids = {"v": None}


class TestTransactions:
    def test_setup_get_unit_ids(self):
        r = requests.get(f"{API}/unit-usaha", headers=_h("admin"))
        _unit_ids["v"] = {u["code"]: u["id"] for u in r.json()}
        assert "UU01" in _unit_ids["v"]

    def test_create_tx_as_bendahara(self):
        payload = {
            "date": "2025-01-15",
            "unit_usaha_id": _unit_ids["v"]["UU01"],
            "transaction_type": "penerimaan_bagi_hasil_domba",
            "description": "TEST_Penerimaan domba",
            "amount": 1000000,
            "debit_account_code": "1-1101",
            "credit_account_code": "4-1101",
        }
        r = requests.post(f"{API}/transactions", json=payload, headers=_h("bendahara"))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["amount"] == 1000000
        _tx_id["v"] = d["id"]

    def test_create_tx_beban(self):
        payload = {
            "date": "2025-01-16",
            "unit_usaha_id": _unit_ids["v"]["UU01"],
            "transaction_type": "beban_bbm_monitoring",
            "description": "TEST_BBM monitoring",
            "amount": 200000,
            "debit_account_code": "5-1201",
            "credit_account_code": "1-1101",
        }
        r = requests.post(f"{API}/transactions", json=payload, headers=_h("bendahara"))
        assert r.status_code == 200

    def test_list_transactions(self):
        r = requests.get(f"{API}/transactions", headers=_h("admin"))
        assert r.status_code == 200
        txs = r.json()
        assert isinstance(txs, list)
        assert any(t["description"].startswith("TEST_") for t in txs)


# ================= REPORTS =================
class TestReports:
    def test_dashboard(self):
        r = requests.get(f"{API}/reports/dashboard", headers=_h("admin"))
        assert r.status_code == 200
        d = r.json()
        assert "total_pendapatan" in d
        assert "total_beban" in d
        assert "laba_bersih" in d
        assert len(d["unit_summaries"]) == 6
        assert "monthly" in d

    def test_laba_rugi(self):
        r = requests.get(f"{API}/reports/laba-rugi",
                         params={"start_date": "2025-01-01", "end_date": "2025-12-31"},
                         headers=_h("bendahara"))
        assert r.status_code == 200
        d = r.json()
        assert "pendapatan" in d and "beban" in d
        assert "laba_bersih" in d

    def test_neraca(self):
        r = requests.get(f"{API}/reports/neraca",
                         params={"as_of_date": "2025-12-31"},
                         headers=_h("bendahara"))
        assert r.status_code == 200
        d = r.json()
        assert "aset" in d and "kewajiban" in d and "ekuitas" in d
        assert "balanced" in d

    def test_arus_kas(self):
        r = requests.get(f"{API}/reports/arus-kas",
                         params={"start_date": "2025-01-01", "end_date": "2025-12-31"},
                         headers=_h("bendahara"))
        assert r.status_code == 200
        d = r.json()
        assert "kas_masuk" in d and "kas_keluar" in d

    def test_perubahan_ekuitas(self):
        r = requests.get(f"{API}/reports/perubahan-ekuitas",
                         params={"start_date": "2025-01-01", "end_date": "2025-12-31"},
                         headers=_h("bendahara"))
        assert r.status_code == 200
        d = r.json()
        assert "modal_awal" in d and "modal_akhir" in d

    def test_per_unit(self):
        r = requests.get(f"{API}/reports/per-unit",
                         params={"start_date": "2025-01-01", "end_date": "2025-12-31"},
                         headers=_h("bendahara"))
        assert r.status_code == 200
        d = r.json()
        assert len(d["units"]) == 6
        u1 = d["units"][0]
        assert "share_pengelola_30" in u1 and "share_bumdes_70" in u1

    def test_calk(self):
        r = requests.get(f"{API}/reports/calk",
                         params={"start_date": "2025-01-01", "end_date": "2025-12-31"},
                         headers=_h("bendahara"))
        assert r.status_code == 200
        d = r.json()
        assert "informasi_umum" in d and "ringkasan_kinerja" in d and "kebijakan_akuntansi" in d


# ================= PDF =================
class TestPDF:
    @pytest.mark.parametrize("path,params", [
        ("laba-rugi", {"start_date": "2025-01-01", "end_date": "2025-12-31"}),
        ("neraca", {"as_of_date": "2025-12-31"}),
        ("arus-kas", {"start_date": "2025-01-01", "end_date": "2025-12-31"}),
        ("perubahan-ekuitas", {"start_date": "2025-01-01", "end_date": "2025-12-31"}),
        ("per-unit", {"start_date": "2025-01-01", "end_date": "2025-12-31"}),
        ("calk", {"start_date": "2025-01-01", "end_date": "2025-12-31"}),
    ])
    def test_pdf(self, path, params):
        r = requests.get(f"{API}/reports/{path}/pdf", params=params, headers=_h("bendahara"))
        assert r.status_code == 200, f"{path} failed: {r.text[:200]}"
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF"


# ================= REVENUE SHARE =================
class TestRevenueShare:
    def test_create(self):
        r = requests.get(f"{API}/unit-usaha", headers=_h("admin"))
        uid = r.json()[0]["id"]
        payload = {
            "period": "2025-01", "unit_usaha_id": uid,
            "gross_revenue": 10000000, "operational_cost": 2000000,
        }
        r = requests.post(f"{API}/revenue-share", json=payload, headers=_h("bendahara"))
        assert r.status_code == 200
        d = r.json()
        assert d["net_revenue"] == 8000000
        assert d["manager_share"] == 2400000
        assert d["bumdes_share"] == 5600000


# ================= RBAC =================
class TestRBAC:
    def test_bendahara_cannot_register(self):
        payload = {
            "email": "TEST_bad@x.com", "username": "TEST_bad", "name": "Bad",
            "role": "pengelola", "password": "test123",
        }
        r = requests.post(f"{API}/auth/register", json=payload, headers=_h("bendahara"))
        assert r.status_code == 403

    def test_admin_can_register_pengelola(self):
        r = requests.get(f"{API}/unit-usaha", headers=_h("admin"))
        uid = r.json()[0]["id"]
        payload = {
            "email": "TEST_peng@x.com", "username": "TEST_pengelola1", "name": "TEST Pengelola",
            "role": "pengelola", "password": "test123", "unit_usaha_id": uid,
        }
        r = requests.post(f"{API}/auth/register", json=payload, headers=_h("admin"))
        # 200 first time, 400 if exists
        assert r.status_code in (200, 400)

    def test_register_pengelola_without_unit_fails(self):
        payload = {
            "email": "TEST_pengnoU@x.com", "username": "TEST_pengnoU", "name": "X",
            "role": "pengelola", "password": "test123",
        }
        r = requests.post(f"{API}/auth/register", json=payload, headers=_h("admin"))
        assert r.status_code == 400

    def test_pengelola_scoped_transactions(self):
        # login as pengelola
        r = requests.post(f"{API}/auth/login", json={"username": "TEST_pengelola1", "password": "test123"})
        if r.status_code != 200:
            pytest.skip("Pengelola user not created")
        tok = r.json()["access_token"]
        r = requests.get(f"{API}/transactions", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200
        txs = r.json()
        # All txs should be from user's unit
        me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"}).json()
        my_unit = me["unit_usaha_id"]
        for t in txs:
            assert t.get("unit_usaha_id") == my_unit


# ================= MITRA =================
class TestMitra:
    def test_create_mitra(self):
        r = requests.get(f"{API}/unit-usaha", headers=_h("admin"))
        uid = r.json()[0]["id"]
        payload = {"unit_usaha_id": uid, "name": "TEST_Mitra1", "mitra_type": "peternak_domba"}
        r = requests.post(f"{API}/mitra", json=payload, headers=_h("bendahara"))
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Mitra1"

    def test_filter_mitra(self):
        r = requests.get(f"{API}/unit-usaha", headers=_h("admin"))
        uid = r.json()[0]["id"]
        r = requests.get(f"{API}/mitra", params={"unit_usaha_id": uid}, headers=_h("admin"))
        assert r.status_code == 200
        for m in r.json():
            assert m["unit_usaha_id"] == uid
