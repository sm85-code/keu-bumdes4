"""BUMDES Karya Waharja - Financial Reporting App
Backend API sesuai Kepmendesa PDTT No 136/2022.
"""
import os
import io
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)

from models import (
    User, UserCreate, UserLogin, UserOut, UserRole, PasswordResetRequest,
    UnitUsaha, UnitUsahaCreate,
    Mitra, MitraCreate,
    Account, AccountCreate,
    Transaction, TransactionCreate,
    RevenueShare, RevenueShareCreate,
    now_utc,
)
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user_payload, require_roles,
)
from seed_data import CHART_OF_ACCOUNTS, UNIT_USAHA_SEED, TRANSACTION_TYPES

# Roles that can read all reports/data like Direktur (read-only for pengawas/penasihat)
READ_LEVEL = ("admin", "direktur", "bendahara", "pengawas", "penasihat")
WRITE_LEVEL = ("admin", "direktur", "bendahara")
ADMIN_LEVEL = ("admin",)
READONLY_ROLES = ("pengawas", "penasihat")


def require_not_readonly():
    """Dependency that blocks pengawas & penasihat from mutating data."""
    async def checker(payload: dict = Depends(get_current_user_payload)):
        if payload.get("role") in READONLY_ROLES:
            raise HTTPException(status_code=403, detail="Role Anda hanya bisa membaca, tidak bisa mengubah data")
        return payload
    return checker

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="BUMDES Karya Waharja API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ==================== HELPERS ====================
async def user_from_payload(payload: dict) -> User:
    uid = payload.get("sub")
    doc = await db.users.find_one({"id": uid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="User tidak ditemukan")
    return User(**doc)


def fmt_rp(n: float) -> str:
    try:
        return "Rp " + f"{n:,.0f}".replace(",", ".")
    except Exception:
        return f"Rp {n}"


# ==================== INIT / SEED ====================
@app.on_event("startup")
async def seed_startup():
    # seed COA
    if await db.accounts.count_documents({}) == 0:
        docs = []
        for code, name, cat, sub, nb in CHART_OF_ACCOUNTS:
            acc = Account(code=code, name=name, category=cat, subcategory=sub, normal_balance=nb)
            docs.append(acc.to_mongo())
        if docs:
            await db.accounts.insert_many(docs)
        logger.info(f"Seeded {len(docs)} accounts")

    # seed unit usaha
    if await db.unit_usaha.count_documents({}) == 0:
        docs = []
        for code, name, desc, scheme in UNIT_USAHA_SEED:
            u = UnitUsaha(code=code, name=name, description=desc, revenue_scheme=scheme)
            docs.append(u.to_mongo())
        if docs:
            await db.unit_usaha.insert_many(docs)
        logger.info(f"Seeded {len(docs)} unit usaha")

    # seed transaction types collection (for dropdown)
    await db.transaction_types.delete_many({})
    await db.transaction_types.insert_many(TRANSACTION_TYPES)

    # seed default users if none
    if await db.users.count_documents({}) == 0:
        default_users = [
            {"email": "admin@bumdes.id", "username": "admin", "name": "Admin Utama",
             "role": UserRole.ADMIN, "password": "admin123"},
            {"email": "budianto@bumdes.id", "username": "budianto", "name": "Budianto (Direktur)",
             "role": UserRole.DIREKTUR, "password": "direktur123"},
            {"email": "riska@bumdes.id", "username": "riska", "name": "Riska Vianti (Bendahara)",
             "role": UserRole.BENDAHARA, "password": "bendahara123"},
        ]
        for u in default_users:
            usr = User(
                email=u["email"], username=u["username"], name=u["name"],
                role=u["role"], password_hash=hash_password(u["password"]),
                plain_password=u["password"],
            )
            await db.users.insert_one(usr.to_mongo())
        logger.info("Seeded default users (admin/direktur/bendahara)")

    # backfill plain_password for existing default users (idempotent)
    for uname, pwd in [("admin", "admin123"), ("budianto", "direktur123"), ("riska", "bendahara123")]:
        await db.users.update_one(
            {"username": uname, "$or": [{"plain_password": {"$exists": False}}, {"plain_password": None}]},
            {"$set": {"plain_password": pwd}}
        )


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ==================== AUTH ====================
@api.post("/auth/register")
async def register(payload: UserCreate, admin: dict = Depends(require_roles("admin"))):
    exists = await db.users.find_one({"$or": [{"email": payload.email}, {"username": payload.username}]})
    if exists:
        raise HTTPException(status_code=400, detail="Email atau username sudah terdaftar")
    if payload.role not in (UserRole.ADMIN, UserRole.DIREKTUR, UserRole.BENDAHARA,
                            UserRole.PENGELOLA, UserRole.PENGAWAS, UserRole.PENASIHAT):
        raise HTTPException(status_code=400, detail="Role tidak valid")
    if payload.role == UserRole.PENGELOLA and not payload.unit_usaha_id:
        raise HTTPException(status_code=400, detail="Pengelola harus memiliki unit_usaha_id")
    user = User(
        email=payload.email, username=payload.username, name=payload.name,
        role=payload.role, unit_usaha_id=payload.unit_usaha_id,
        password_hash=hash_password(payload.password),
        plain_password=payload.password,
    )
    await db.users.insert_one(user.to_mongo())
    return UserOut(**user.model_dump())


@api.post("/auth/login")
async def login(payload: UserLogin):
    doc = await db.users.find_one(
        {"$or": [{"username": payload.username}, {"email": payload.username}]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=401, detail="Username atau password salah")
    user = User(**doc)
    if not user.active:
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = create_access_token(user.id, user.role, {"name": user.name, "unit": user.unit_usaha_id})
    return {"access_token": token, "token_type": "bearer", "user": UserOut(**user.model_dump()).model_dump()}


@api.get("/auth/me", response_model=UserOut)
async def me(payload: dict = Depends(get_current_user_payload)):
    user = await user_from_payload(payload)
    return UserOut(**user.model_dump())


@api.get("/users", response_model=List[UserOut])
async def list_users(admin: dict = Depends(require_roles("admin"))):
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(200)
    return [UserOut(**d) for d in docs]


@api.post("/users/{user_id}/reset-password")
async def reset_password(user_id: str, payload: PasswordResetRequest,
                         admin: dict = Depends(require_roles("admin"))):
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password minimal 6 karakter")
    r = await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(payload.new_password),
                  "plain_password": payload.new_password}}
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    return {"ok": True}


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_roles("admin"))):
    r = await db.users.delete_one({"id": user_id})
    return {"deleted": r.deleted_count}


# ==================== UNIT USAHA ====================
@api.get("/unit-usaha", response_model=List[UnitUsaha])
async def list_units(_: dict = Depends(get_current_user_payload)):
    docs = await db.unit_usaha.find({}, {"_id": 0}).sort("code", 1).to_list(50)
    return [UnitUsaha(**d) for d in docs]


@api.post("/unit-usaha", response_model=UnitUsaha)
async def create_unit(payload: UnitUsahaCreate, _: dict = Depends(require_roles("admin", "direktur"))):
    if await db.unit_usaha.find_one({"code": payload.code}):
        raise HTTPException(status_code=400, detail="Kode unit sudah ada")
    u = UnitUsaha(**payload.model_dump())
    await db.unit_usaha.insert_one(u.to_mongo())
    return u


# ==================== MITRA ====================
@api.get("/mitra", response_model=List[Mitra])
async def list_mitra(unit_usaha_id: Optional[str] = None, payload: dict = Depends(get_current_user_payload)):
    user = await user_from_payload(payload)
    q: dict = {}
    if unit_usaha_id:
        q["unit_usaha_id"] = unit_usaha_id
    if user.role == UserRole.PENGELOLA and user.unit_usaha_id:
        q["unit_usaha_id"] = user.unit_usaha_id
    docs = await db.mitra.find(q, {"_id": 0}).to_list(500)
    return [Mitra(**d) for d in docs]


@api.post("/mitra", response_model=Mitra)
async def create_mitra(payload: MitraCreate, dep: dict = Depends(require_not_readonly())):
    user = await user_from_payload(dep)
    unit_id = payload.unit_usaha_id
    if user.role == UserRole.PENGELOLA:
        unit_id = user.unit_usaha_id
    m = Mitra(**{**payload.model_dump(), "unit_usaha_id": unit_id})
    await db.mitra.insert_one(m.to_mongo())
    return m


@api.delete("/mitra/{mitra_id}")
async def delete_mitra(mitra_id: str, _: dict = Depends(require_roles("admin", "direktur", "bendahara"))):
    r = await db.mitra.delete_one({"id": mitra_id})
    return {"deleted": r.deleted_count}


# ==================== CHART OF ACCOUNTS ====================
@api.get("/accounts", response_model=List[Account])
async def list_accounts(_: dict = Depends(get_current_user_payload)):
    docs = await db.accounts.find({}, {"_id": 0}).sort("code", 1).to_list(500)
    return [Account(**d) for d in docs]


@api.post("/accounts", response_model=Account)
async def create_account(payload: AccountCreate, _: dict = Depends(require_roles("admin", "direktur", "bendahara"))):
    if await db.accounts.find_one({"code": payload.code}):
        raise HTTPException(status_code=400, detail="Kode akun sudah ada")
    acc = Account(**payload.model_dump())
    await db.accounts.insert_one(acc.to_mongo())
    return acc


# ==================== TRANSACTION TYPES ====================
@api.get("/transaction-types")
async def list_tx_types(_: dict = Depends(get_current_user_payload)):
    docs = await db.transaction_types.find({}, {"_id": 0}).to_list(200)
    return docs


# ==================== TRANSACTIONS ====================
@api.get("/transactions")
async def list_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    unit_usaha_id: Optional[str] = None,
    limit: int = 500,
    payload: dict = Depends(get_current_user_payload),
):
    user = await user_from_payload(payload)
    q: dict = {}
    if start_date and end_date:
        q["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        q["date"] = {"$gte": start_date}
    elif end_date:
        q["date"] = {"$lte": end_date}
    if unit_usaha_id:
        q["unit_usaha_id"] = unit_usaha_id
    # Pengelola only sees own unit
    if user.role == UserRole.PENGELOLA and user.unit_usaha_id:
        q["unit_usaha_id"] = user.unit_usaha_id
    docs = await db.transactions.find(q, {"_id": 0}).sort("date", -1).to_list(limit)
    return docs


@api.post("/transactions")
async def create_transaction(payload: TransactionCreate, dep: dict = Depends(require_not_readonly())):
    user = await user_from_payload(dep)
    # Pengelola force unit
    unit_id = payload.unit_usaha_id
    if user.role == UserRole.PENGELOLA:
        unit_id = user.unit_usaha_id
    tx = Transaction(**{**payload.model_dump(), "unit_usaha_id": unit_id, "created_by": user.id})
    await db.transactions.insert_one(tx.to_mongo())
    return tx


@api.delete("/transactions/{tx_id}")
async def delete_transaction(tx_id: str, _: dict = Depends(require_roles("admin", "direktur", "bendahara"))):
    r = await db.transactions.delete_one({"id": tx_id})
    return {"deleted": r.deleted_count}


# ==================== REVENUE SHARE (BAGI HASIL) ====================
@api.post("/revenue-share")
async def create_revenue_share(payload: RevenueShareCreate, dep: dict = Depends(require_roles(*WRITE_LEVEL))):
    net = payload.gross_revenue - payload.operational_cost
    manager = round(net * 0.30, 2)
    bumdes = round(net * 0.70, 2)
    rs = RevenueShare(
        period=payload.period, unit_usaha_id=payload.unit_usaha_id,
        gross_revenue=payload.gross_revenue, operational_cost=payload.operational_cost,
        net_revenue=net, manager_share=manager, bumdes_share=bumdes,
    )
    await db.revenue_shares.insert_one(rs.to_mongo())
    return rs


@api.delete("/revenue-share/{rs_id}")
async def delete_revenue_share(rs_id: str, _: dict = Depends(require_roles(*WRITE_LEVEL))):
    r = await db.revenue_shares.delete_one({"id": rs_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Data bagi hasil tidak ditemukan")
    return {"deleted": r.deleted_count}


@api.get("/revenue-share")
async def list_revenue_share(
    unit_usaha_id: Optional[str] = None,
    payload: dict = Depends(get_current_user_payload),
):
    user = await user_from_payload(payload)
    q: dict = {}
    if unit_usaha_id:
        q["unit_usaha_id"] = unit_usaha_id
    if user.role == UserRole.PENGELOLA and user.unit_usaha_id:
        q["unit_usaha_id"] = user.unit_usaha_id
    docs = await db.revenue_shares.find(q, {"_id": 0}).sort("period", -1).to_list(200)
    return docs


# ==================== REPORTS ====================
async def _get_accounts_map():
    docs = await db.accounts.find({}, {"_id": 0}).to_list(500)
    return {d["code"]: d for d in docs}


async def _calc_balances(start_date: Optional[str], end_date: Optional[str]):
    """Return {account_code: {debit, credit, saldo}} based on tx filter."""
    q: dict = {}
    if start_date and end_date:
        q["date"] = {"$gte": start_date, "$lte": end_date}
    txs = await db.transactions.find(q, {"_id": 0}).to_list(20000)
    bal: dict = {}
    for tx in txs:
        amt = tx.get("amount", 0)
        d = tx["debit_account_code"]
        c = tx["credit_account_code"]
        bal.setdefault(d, {"debit": 0, "credit": 0})
        bal.setdefault(c, {"debit": 0, "credit": 0})
        bal[d]["debit"] += amt
        bal[c]["credit"] += amt
    accounts = await _get_accounts_map()
    for code, v in bal.items():
        acc = accounts.get(code)
        if acc:
            if acc["normal_balance"] == "debit":
                v["saldo"] = v["debit"] - v["credit"]
            else:
                v["saldo"] = v["credit"] - v["debit"]
        else:
            v["saldo"] = v["debit"] - v["credit"]
    return bal, accounts


@api.get("/reports/dashboard")
async def dashboard(payload: dict = Depends(get_current_user_payload)):
    user = await user_from_payload(payload)
    # scope: pengelola only own unit
    filter_unit = user.unit_usaha_id if user.role == UserRole.PENGELOLA else None

    q: dict = {}
    if filter_unit:
        q["unit_usaha_id"] = filter_unit
    txs = await db.transactions.find(q, {"_id": 0}).to_list(20000)
    accounts = await _get_accounts_map()

    total_pendapatan = 0.0
    total_beban = 0.0
    per_unit: dict = {}

    for tx in txs:
        amt = tx.get("amount", 0)
        d_acc = accounts.get(tx["debit_account_code"], {})
        c_acc = accounts.get(tx["credit_account_code"], {})
        uid = tx.get("unit_usaha_id") or "bumdes"
        per_unit.setdefault(uid, {"pendapatan": 0, "beban": 0})
        if c_acc.get("category") == "pendapatan":
            total_pendapatan += amt
            per_unit[uid]["pendapatan"] += amt
        if d_acc.get("category") == "beban":
            total_beban += amt
            per_unit[uid]["beban"] += amt

    units = await db.unit_usaha.find({}, {"_id": 0}).to_list(50)
    unit_summaries = []
    for u in units:
        p = per_unit.get(u["id"], {"pendapatan": 0, "beban": 0})
        unit_summaries.append({
            "id": u["id"], "code": u["code"], "name": u["name"],
            "pendapatan": p["pendapatan"], "beban": p["beban"],
            "laba": p["pendapatan"] - p["beban"],
        })

    # monthly trend (last 6 months)
    from collections import defaultdict
    monthly = defaultdict(lambda: {"pendapatan": 0, "beban": 0})
    for tx in txs:
        month = (tx.get("date") or "")[:7]
        if not month:
            continue
        d_acc = accounts.get(tx["debit_account_code"], {})
        c_acc = accounts.get(tx["credit_account_code"], {})
        if c_acc.get("category") == "pendapatan":
            monthly[month]["pendapatan"] += tx.get("amount", 0)
        if d_acc.get("category") == "beban":
            monthly[month]["beban"] += tx.get("amount", 0)
    monthly_list = [{"month": m, **v} for m, v in sorted(monthly.items())][-6:]

    return {
        "total_pendapatan": total_pendapatan,
        "total_beban": total_beban,
        "laba_bersih": total_pendapatan - total_beban,
        "unit_summaries": unit_summaries,
        "monthly": monthly_list,
        "total_transactions": len(txs),
    }


async def _laba_rugi(start_date: str, end_date: str):
    bal, accounts = await _calc_balances(start_date, end_date)
    pendapatan_items, beban_items = [], []
    total_p = 0.0
    total_b = 0.0
    for code, acc in sorted(accounts.items()):
        b = bal.get(code)
        if not b:
            continue
        saldo = b.get("saldo", 0)
        if acc["category"] == "pendapatan" and saldo != 0:
            pendapatan_items.append({"code": code, "name": acc["name"], "amount": saldo})
            total_p += saldo
        if acc["category"] == "beban" and saldo != 0:
            beban_items.append({"code": code, "name": acc["name"], "amount": saldo})
            total_b += saldo
    return {
        "pendapatan": pendapatan_items,
        "beban": beban_items,
        "total_pendapatan": total_p,
        "total_beban": total_b,
        "laba_bersih": total_p - total_b,
    }


async def _neraca(as_of_date: str):
    bal, accounts = await _calc_balances(None, as_of_date)
    aset, kewajiban, ekuitas = [], [], []
    tot_a, tot_k, tot_e = 0.0, 0.0, 0.0
    for code, acc in sorted(accounts.items()):
        b = bal.get(code)
        if not b:
            continue
        saldo = b.get("saldo", 0)
        if acc["category"] == "aset" and saldo != 0:
            aset.append({"code": code, "name": acc["name"], "amount": saldo, "sub": acc.get("subcategory", "")})
            tot_a += saldo
        if acc["category"] == "kewajiban" and saldo != 0:
            kewajiban.append({"code": code, "name": acc["name"], "amount": saldo, "sub": acc.get("subcategory", "")})
            tot_k += saldo
        if acc["category"] == "ekuitas" and saldo != 0:
            ekuitas.append({"code": code, "name": acc["name"], "amount": saldo, "sub": acc.get("subcategory", "")})
            tot_e += saldo
    # Laba tahun berjalan
    lr = await _laba_rugi("1900-01-01", as_of_date)
    laba = lr["laba_bersih"]
    if laba != 0:
        ekuitas.append({"code": "3-2102", "name": "Laba/Rugi Tahun Berjalan (kalkulasi)", "amount": laba, "sub": "saldo_laba"})
        tot_e += laba
    return {
        "as_of": as_of_date,
        "aset": aset, "kewajiban": kewajiban, "ekuitas": ekuitas,
        "total_aset": tot_a, "total_kewajiban": tot_k, "total_ekuitas": tot_e,
        "total_pasiva": tot_k + tot_e, "balanced": abs(tot_a - (tot_k + tot_e)) < 0.01,
    }


async def _arus_kas(start_date: str, end_date: str):
    """Cash flow from transactions where kas/bank involved."""
    q = {"date": {"$gte": start_date, "$lte": end_date}}
    txs = await db.transactions.find(q, {"_id": 0}).to_list(20000)
    accounts = await _get_accounts_map()
    kas_codes = {"1-1101", "1-1102"}
    kas_masuk = []
    kas_keluar = []
    tot_masuk, tot_keluar = 0.0, 0.0
    for tx in txs:
        amt = tx.get("amount", 0)
        d = tx["debit_account_code"]
        c = tx["credit_account_code"]
        if d in kas_codes and c not in kas_codes:
            desc = accounts.get(c, {}).get("name", c)
            kas_masuk.append({"date": tx.get("date"), "description": tx.get("description") or desc, "amount": amt})
            tot_masuk += amt
        elif c in kas_codes and d not in kas_codes:
            desc = accounts.get(d, {}).get("name", d)
            kas_keluar.append({"date": tx.get("date"), "description": tx.get("description") or desc, "amount": amt})
            tot_keluar += amt
    return {
        "kas_masuk": kas_masuk, "kas_keluar": kas_keluar,
        "total_masuk": tot_masuk, "total_keluar": tot_keluar,
        "arus_kas_bersih": tot_masuk - tot_keluar,
    }


async def _perubahan_ekuitas(start_date: str, end_date: str):
    lr = await _laba_rugi(start_date, end_date)
    # Modal awal = ekuitas before start
    bal_awal, accounts = await _calc_balances(None, start_date)
    modal_awal = 0.0
    for code, acc in accounts.items():
        if acc["category"] == "ekuitas":
            modal_awal += bal_awal.get(code, {}).get("saldo", 0)
    # Penambahan modal periode berjalan (kredit ke ekuitas)
    q = {"date": {"$gte": start_date, "$lte": end_date}}
    txs = await db.transactions.find(q, {"_id": 0}).to_list(20000)
    tambahan_modal = 0.0
    for tx in txs:
        c_acc = accounts.get(tx["credit_account_code"], {})
        if c_acc.get("category") == "ekuitas" and c_acc.get("code") != "3-2102":
            tambahan_modal += tx.get("amount", 0)
    modal_akhir = modal_awal + tambahan_modal + lr["laba_bersih"]
    return {
        "modal_awal": modal_awal,
        "tambahan_modal": tambahan_modal,
        "laba_bersih_periode": lr["laba_bersih"],
        "modal_akhir": modal_akhir,
    }


async def _per_unit_report(start_date: str, end_date: str):
    q = {"date": {"$gte": start_date, "$lte": end_date}}
    txs = await db.transactions.find(q, {"_id": 0}).to_list(20000)
    accounts = await _get_accounts_map()
    units = await db.unit_usaha.find({}, {"_id": 0}).to_list(50)
    result = []
    for u in units:
        pendapatan = 0.0
        beban = 0.0
        for tx in txs:
            if tx.get("unit_usaha_id") != u["id"]:
                continue
            d_acc = accounts.get(tx["debit_account_code"], {})
            c_acc = accounts.get(tx["credit_account_code"], {})
            if c_acc.get("category") == "pendapatan":
                pendapatan += tx.get("amount", 0)
            if d_acc.get("category") == "beban":
                beban += tx.get("amount", 0)
        laba = pendapatan - beban
        result.append({
            "id": u["id"], "code": u["code"], "name": u["name"],
            "pendapatan": pendapatan, "beban": beban, "laba_bersih": laba,
            "share_pengelola_30": round(laba * 0.30, 2) if laba > 0 else 0,
            "share_bumdes_70": round(laba * 0.70, 2) if laba > 0 else 0,
        })
    return {"period": {"start": start_date, "end": end_date}, "units": result}


@api.get("/reports/laba-rugi")
async def rpt_laba_rugi(start_date: str, end_date: str, _: dict = Depends(require_roles(*READ_LEVEL))):
    return await _laba_rugi(start_date, end_date)


@api.get("/reports/neraca")
async def rpt_neraca(as_of_date: str, _: dict = Depends(require_roles(*READ_LEVEL))):
    return await _neraca(as_of_date)


@api.get("/reports/arus-kas")
async def rpt_arus_kas(start_date: str, end_date: str, _: dict = Depends(require_roles(*READ_LEVEL))):
    return await _arus_kas(start_date, end_date)


@api.get("/reports/perubahan-ekuitas")
async def rpt_pe(start_date: str, end_date: str, _: dict = Depends(require_roles(*READ_LEVEL))):
    return await _perubahan_ekuitas(start_date, end_date)


@api.get("/reports/per-unit")
async def rpt_per_unit(start_date: str, end_date: str, _: dict = Depends(get_current_user_payload)):
    return await _per_unit_report(start_date, end_date)


@api.get("/reports/calk")
async def rpt_calk(start_date: str, end_date: str, _: dict = Depends(require_roles(*READ_LEVEL))):
    lr = await _laba_rugi(start_date, end_date)
    nr = await _neraca(end_date)
    ak = await _arus_kas(start_date, end_date)
    return {
        "informasi_umum": {
            "nama": "BUMDES Karya Waharja",
            "alamat": "Desa Wonoharjo, Kec. Pangandaran",
            "direktur": "Budianto",
            "dasar_hukum": "Kepmendesa PDTT No. 136 Tahun 2022",
        },
        "periode": {"start": start_date, "end": end_date},
        "ringkasan_kinerja": {
            "total_pendapatan": lr["total_pendapatan"],
            "total_beban": lr["total_beban"],
            "laba_bersih": lr["laba_bersih"],
            "total_aset": nr["total_aset"],
            "total_kewajiban": nr["total_kewajiban"],
            "total_ekuitas": nr["total_ekuitas"],
            "arus_kas_bersih": ak["arus_kas_bersih"],
        },
        "kebijakan_akuntansi": [
            "Laporan disusun sesuai Kepmendesa PDTT No. 136 Tahun 2022.",
            "Pengakuan pendapatan menggunakan basis akrual.",
            "Bagi hasil pengelola sebesar 30% dari laba bersih unit usaha.",
            "Bagi hasil BUMDES sebesar 70% dari laba bersih unit usaha.",
            "Bagi hasil mitra peternak (unit domba) sebesar 30% dari penjualan anakan.",
            "Setoran mitra ikan mujaer bioflok sebesar Rp3.000 per kg.",
            "Imbal hasil mitra dagang sebesar 3% per bulan dari modal yang dititipkan.",
        ],
    }


# ==================== PDF EXPORT ====================
# Cached paragraph styles for cell content (word-wrap in table cells).
_STYLES = getSampleStyleSheet()
_CELL_STYLE = ParagraphStyle(
    "cell", parent=_STYLES["Normal"], fontName="Helvetica",
    fontSize=8.5, leading=11, wordWrap="CJK", spaceBefore=0, spaceAfter=0,
)
_CELL_RIGHT = ParagraphStyle("cell_r", parent=_CELL_STYLE, alignment=2)
_CELL_BOLD = ParagraphStyle("cell_b", parent=_CELL_STYLE, fontName="Helvetica-Bold")
_CELL_BOLD_RIGHT = ParagraphStyle("cell_br", parent=_CELL_BOLD, alignment=2)
_SECTION_STYLE = ParagraphStyle(
    "section", parent=_STYLES["Normal"], fontName="Helvetica-Bold",
    fontSize=9, textColor=colors.HexColor("#2E4F32"), spaceBefore=0, spaceAfter=0,
)


def P(text, style=_CELL_STYLE):
    """Wrap text in a Paragraph so it word-wraps inside a table cell."""
    if text is None:
        text = ""
    s = str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return Paragraph(s, style)


def _pdf_response(build_fn, filename: str):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm,
                            leftMargin=1.2 * cm, rightMargin=1.2 * cm)
    story = build_fn()
    doc.build(story)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _pdf_header(story, styles, title: str, subtitle: str = ""):
    story.append(Paragraph("<b>BUMDES KARYA WAHARJA</b>", styles["Title"]))
    story.append(Paragraph("Desa Wonoharjo, Kecamatan Pangandaran", styles["Normal"]))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(f"<b>{title}</b>", styles["Heading2"]))
    if subtitle:
        story.append(Paragraph(subtitle, styles["Normal"]))
    story.append(Spacer(1, 0.4 * cm))


def _table_style():
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D4E09B")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1A2E1E")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E8EAE6")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FDFBF7")]),
    ])


def _section_row(text: str, ncols: int):
    return [P(f"<b>{text}</b>", _SECTION_STYLE)] + [P("") for _ in range(ncols - 1)]


@api.get("/reports/laba-rugi/pdf")
async def pdf_lr(start_date: str, end_date: str, _: dict = Depends(require_roles(*READ_LEVEL))):
    data = await _laba_rugi(start_date, end_date)
    def build():
        story = []
        _pdf_header(story, _STYLES, "LAPORAN LABA RUGI", f"Periode: {start_date} s.d. {end_date}")
        rows = [[P("<b>Kode</b>", _CELL_BOLD), P("<b>Nama Akun</b>", _CELL_BOLD), P("<b>Jumlah</b>", _CELL_BOLD_RIGHT)]]
        section_rows = []
        rows.append(_section_row("PENDAPATAN", 3)); section_rows.append(len(rows) - 1)
        for it in data["pendapatan"]:
            rows.append([P(it["code"]), P(it["name"]), P(fmt_rp(it["amount"]), _CELL_RIGHT)])
        rows.append([P(""), P("<b>Total Pendapatan</b>", _CELL_BOLD), P(f"<b>{fmt_rp(data['total_pendapatan'])}</b>", _CELL_BOLD_RIGHT)])
        rows.append(_section_row("BEBAN", 3)); section_rows.append(len(rows) - 1)
        for it in data["beban"]:
            rows.append([P(it["code"]), P(it["name"]), P(fmt_rp(it["amount"]), _CELL_RIGHT)])
        rows.append([P(""), P("<b>Total Beban</b>", _CELL_BOLD), P(f"<b>{fmt_rp(data['total_beban'])}</b>", _CELL_BOLD_RIGHT)])
        rows.append([P(""), P("<b>LABA / (RUGI) BERSIH</b>", _CELL_BOLD), P(f"<b>{fmt_rp(data['laba_bersih'])}</b>", _CELL_BOLD_RIGHT)])
        total_row_idx = len(rows) - 1
        t = Table(rows, colWidths=[2.3 * cm, 9.7 * cm, 5.5 * cm], repeatRows=1)
        ts = _table_style()
        for sr in section_rows:
            ts.add("BACKGROUND", (0, sr), (-1, sr), colors.HexColor("#F5F1E8"))
        ts.add("BACKGROUND", (0, total_row_idx), (-1, total_row_idx), colors.HexColor("#D4E09B"))
        t.setStyle(ts)
        story.append(t)
        return story
    return _pdf_response(build, f"Laba-Rugi_{start_date}_sd_{end_date}.pdf")


@api.get("/reports/neraca/pdf")
async def pdf_neraca(as_of_date: str, _: dict = Depends(require_roles(*READ_LEVEL))):
    data = await _neraca(as_of_date)
    def build():
        story = []
        _pdf_header(story, _STYLES, "NERACA", f"Per tanggal: {as_of_date}")
        rows = [[P("<b>Kode</b>", _CELL_BOLD), P("<b>Akun</b>", _CELL_BOLD), P("<b>Jumlah</b>", _CELL_BOLD_RIGHT)]]
        section_rows = []
        rows.append(_section_row("ASET", 3)); section_rows.append(len(rows) - 1)
        for it in data["aset"]:
            rows.append([P(it["code"]), P(it["name"]), P(fmt_rp(it["amount"]), _CELL_RIGHT)])
        rows.append([P(""), P("<b>Total Aset</b>", _CELL_BOLD), P(f"<b>{fmt_rp(data['total_aset'])}</b>", _CELL_BOLD_RIGHT)])
        rows.append(_section_row("KEWAJIBAN", 3)); section_rows.append(len(rows) - 1)
        for it in data["kewajiban"]:
            rows.append([P(it["code"]), P(it["name"]), P(fmt_rp(it["amount"]), _CELL_RIGHT)])
        rows.append([P(""), P("<b>Total Kewajiban</b>", _CELL_BOLD), P(f"<b>{fmt_rp(data['total_kewajiban'])}</b>", _CELL_BOLD_RIGHT)])
        rows.append(_section_row("EKUITAS", 3)); section_rows.append(len(rows) - 1)
        for it in data["ekuitas"]:
            rows.append([P(it["code"]), P(it["name"]), P(fmt_rp(it["amount"]), _CELL_RIGHT)])
        rows.append([P(""), P("<b>Total Ekuitas</b>", _CELL_BOLD), P(f"<b>{fmt_rp(data['total_ekuitas'])}</b>", _CELL_BOLD_RIGHT)])
        rows.append([P(""), P("<b>TOTAL PASIVA (Kewajiban + Ekuitas)</b>", _CELL_BOLD),
                     P(f"<b>{fmt_rp(data['total_pasiva'])}</b>", _CELL_BOLD_RIGHT)])
        total_row_idx = len(rows) - 1
        t = Table(rows, colWidths=[2.3 * cm, 9.7 * cm, 5.5 * cm], repeatRows=1)
        ts = _table_style()
        for sr in section_rows:
            ts.add("BACKGROUND", (0, sr), (-1, sr), colors.HexColor("#F5F1E8"))
        ts.add("BACKGROUND", (0, total_row_idx), (-1, total_row_idx), colors.HexColor("#D4E09B"))
        t.setStyle(ts)
        story.append(t)
        return story
    return _pdf_response(build, f"Neraca_{as_of_date}.pdf")


@api.get("/reports/arus-kas/pdf")
async def pdf_ak(start_date: str, end_date: str, _: dict = Depends(require_roles(*READ_LEVEL))):
    data = await _arus_kas(start_date, end_date)
    def build():
        story = []
        _pdf_header(story, _STYLES, "LAPORAN ARUS KAS", f"Periode: {start_date} s.d. {end_date}")
        rows = [[P("<b>Tanggal</b>", _CELL_BOLD), P("<b>Keterangan</b>", _CELL_BOLD), P("<b>Jumlah</b>", _CELL_BOLD_RIGHT)]]
        section_rows = []
        rows.append(_section_row("KAS MASUK", 3)); section_rows.append(len(rows) - 1)
        for it in data["kas_masuk"]:
            rows.append([P(it["date"]), P(it["description"]), P(fmt_rp(it["amount"]), _CELL_RIGHT)])
        rows.append([P(""), P("<b>Total Kas Masuk</b>", _CELL_BOLD), P(f"<b>{fmt_rp(data['total_masuk'])}</b>", _CELL_BOLD_RIGHT)])
        rows.append(_section_row("KAS KELUAR", 3)); section_rows.append(len(rows) - 1)
        for it in data["kas_keluar"]:
            rows.append([P(it["date"]), P(it["description"]), P(fmt_rp(it["amount"]), _CELL_RIGHT)])
        rows.append([P(""), P("<b>Total Kas Keluar</b>", _CELL_BOLD), P(f"<b>{fmt_rp(data['total_keluar'])}</b>", _CELL_BOLD_RIGHT)])
        rows.append([P(""), P("<b>ARUS KAS BERSIH</b>", _CELL_BOLD), P(f"<b>{fmt_rp(data['arus_kas_bersih'])}</b>", _CELL_BOLD_RIGHT)])
        total_row_idx = len(rows) - 1
        t = Table(rows, colWidths=[2.5 * cm, 9.5 * cm, 5.5 * cm], repeatRows=1)
        ts = _table_style()
        for sr in section_rows:
            ts.add("BACKGROUND", (0, sr), (-1, sr), colors.HexColor("#F5F1E8"))
        ts.add("BACKGROUND", (0, total_row_idx), (-1, total_row_idx), colors.HexColor("#D4E09B"))
        t.setStyle(ts)
        story.append(t)
        return story
    return _pdf_response(build, f"Arus-Kas_{start_date}_sd_{end_date}.pdf")


@api.get("/reports/perubahan-ekuitas/pdf")
async def pdf_pe(start_date: str, end_date: str, _: dict = Depends(require_roles(*READ_LEVEL))):
    data = await _perubahan_ekuitas(start_date, end_date)
    def build():
        story = []
        _pdf_header(story, _STYLES, "LAPORAN PERUBAHAN EKUITAS", f"Periode: {start_date} s.d. {end_date}")
        rows = [
            [P("<b>Uraian</b>", _CELL_BOLD), P("<b>Jumlah</b>", _CELL_BOLD_RIGHT)],
            [P("Modal Awal Periode"), P(fmt_rp(data["modal_awal"]), _CELL_RIGHT)],
            [P("Penambahan Modal"), P(fmt_rp(data["tambahan_modal"]), _CELL_RIGHT)],
            [P("Laba/Rugi Bersih Periode Berjalan"), P(fmt_rp(data["laba_bersih_periode"]), _CELL_RIGHT)],
            [P("<b>MODAL AKHIR PERIODE</b>", _CELL_BOLD), P(f"<b>{fmt_rp(data['modal_akhir'])}</b>", _CELL_BOLD_RIGHT)],
        ]
        t = Table(rows, colWidths=[11 * cm, 6.5 * cm], repeatRows=1)
        ts = _table_style()
        ts.add("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#D4E09B"))
        t.setStyle(ts)
        story.append(t)
        return story
    return _pdf_response(build, f"Perubahan-Ekuitas_{start_date}_sd_{end_date}.pdf")


@api.get("/reports/per-unit/pdf")
async def pdf_per_unit(start_date: str, end_date: str, _: dict = Depends(get_current_user_payload)):
    data = await _per_unit_report(start_date, end_date)
    def build():
        story = []
        _pdf_header(story, _STYLES, "LAPORAN PER UNIT USAHA", f"Periode: {start_date} s.d. {end_date}")
        rows = [[P("<b>Kode</b>", _CELL_BOLD), P("<b>Unit Usaha</b>", _CELL_BOLD),
                 P("<b>Pendapatan</b>", _CELL_BOLD_RIGHT), P("<b>Beban</b>", _CELL_BOLD_RIGHT),
                 P("<b>Laba Bersih</b>", _CELL_BOLD_RIGHT),
                 P("<b>30% Pengelola</b>", _CELL_BOLD_RIGHT), P("<b>70% BUMDES</b>", _CELL_BOLD_RIGHT)]]
        total_p = total_b = total_l = total_m = total_bmd = 0.0
        for u in data["units"]:
            rows.append([P(u["code"]), P(u["name"]),
                         P(fmt_rp(u["pendapatan"]), _CELL_RIGHT), P(fmt_rp(u["beban"]), _CELL_RIGHT),
                         P(fmt_rp(u["laba_bersih"]), _CELL_RIGHT),
                         P(fmt_rp(u["share_pengelola_30"]), _CELL_RIGHT),
                         P(fmt_rp(u["share_bumdes_70"]), _CELL_RIGHT)])
            total_p += u["pendapatan"]; total_b += u["beban"]; total_l += u["laba_bersih"]
            total_m += u["share_pengelola_30"]; total_bmd += u["share_bumdes_70"]
        rows.append([P(""), P("<b>TOTAL</b>", _CELL_BOLD),
                     P(f"<b>{fmt_rp(total_p)}</b>", _CELL_BOLD_RIGHT),
                     P(f"<b>{fmt_rp(total_b)}</b>", _CELL_BOLD_RIGHT),
                     P(f"<b>{fmt_rp(total_l)}</b>", _CELL_BOLD_RIGHT),
                     P(f"<b>{fmt_rp(total_m)}</b>", _CELL_BOLD_RIGHT),
                     P(f"<b>{fmt_rp(total_bmd)}</b>", _CELL_BOLD_RIGHT)])
        total_row_idx = len(rows) - 1
        t = Table(rows, colWidths=[1.4 * cm, 4.6 * cm, 2.4 * cm, 1.9 * cm, 2.4 * cm, 2.4 * cm, 2.4 * cm], repeatRows=1)
        ts = _table_style()
        ts.add("BACKGROUND", (0, total_row_idx), (-1, total_row_idx), colors.HexColor("#D4E09B"))
        t.setStyle(ts)
        story.append(t)
        return story
    return _pdf_response(build, f"Laporan-Per-Unit_{start_date}_sd_{end_date}.pdf")


@api.get("/reports/calk/pdf")
async def pdf_calk(start_date: str, end_date: str, _: dict = Depends(require_roles(*READ_LEVEL))):
    data = await rpt_calk(start_date, end_date)
    def build():
        story = []
        _pdf_header(story, _STYLES, "CATATAN ATAS LAPORAN KEUANGAN (CaLK)",
                    f"Periode: {start_date} s.d. {end_date}")
        story.append(Paragraph("<b>1. Informasi Umum</b>", _STYLES["Heading3"]))
        info = data["informasi_umum"]
        for k, v in info.items():
            story.append(Paragraph(f"• <b>{k.replace('_', ' ').title()}</b>: {v}", _STYLES["Normal"]))
        story.append(Spacer(1, 0.4 * cm))
        story.append(Paragraph("<b>2. Ringkasan Kinerja Keuangan</b>", _STYLES["Heading3"]))
        rk = data["ringkasan_kinerja"]
        rows = [[P("<b>Uraian</b>", _CELL_BOLD), P("<b>Jumlah</b>", _CELL_BOLD_RIGHT)]]
        for k, v in rk.items():
            rows.append([P(k.replace("_", " ").title()), P(fmt_rp(v), _CELL_RIGHT)])
        t = Table(rows, colWidths=[11 * cm, 6 * cm], repeatRows=1)
        t.setStyle(_table_style())
        story.append(t)
        story.append(Spacer(1, 0.4 * cm))
        story.append(Paragraph("<b>3. Kebijakan Akuntansi</b>", _STYLES["Heading3"]))
        for k in data["kebijakan_akuntansi"]:
            story.append(Paragraph(f"• {k}", _STYLES["Normal"]))
            story.append(Spacer(1, 0.15 * cm))
        return story
    return _pdf_response(build, f"CaLK_{start_date}_sd_{end_date}.pdf")


# ==================== ROOT ====================
@api.get("/")
async def root():
    return {"app": "BUMDES Karya Waharja", "version": "1.0.0"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
