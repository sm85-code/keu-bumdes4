"""Pydantic models & MongoDB base helpers for BUMDES app."""
from datetime import datetime, timezone
from typing import Optional, List, Any, Annotated
from pydantic import BaseModel, Field, ConfigDict, EmailStr, BeforeValidator
from bson import ObjectId
import uuid


def _to_str(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    return str(v)


PyObjectId = Annotated[str, BeforeValidator(_to_str)]


def gen_id() -> str:
    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True, extra="ignore")

    id: str = Field(default_factory=gen_id)

    def to_mongo(self) -> dict:
        d = self.model_dump()
        # normalize datetimes to iso string
        for k, v in list(d.items()):
            if isinstance(v, datetime):
                d[k] = v.isoformat()
        return d

    @classmethod
    def from_mongo(cls, doc: dict):
        if not doc:
            return None
        d = dict(doc)
        d.pop("_id", None)
        return cls(**d)


# ============ USERS ============
class UserRole:
    ADMIN = "admin"
    DIREKTUR = "direktur"
    BENDAHARA = "bendahara"
    PENGELOLA = "pengelola"


class User(BaseDocument):
    email: EmailStr
    username: str
    name: str
    role: str  # admin | direktur | bendahara | pengelola
    unit_usaha_id: Optional[str] = None  # for pengelola only
    password_hash: str
    active: bool = True
    created_at: datetime = Field(default_factory=now_utc)


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    name: str
    role: str
    password: str
    unit_usaha_id: Optional[str] = None


class UserLogin(BaseModel):
    username: str  # username or email
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    username: str
    name: str
    role: str
    unit_usaha_id: Optional[str] = None
    active: bool = True


# ============ UNIT USAHA ============
class UnitUsaha(BaseDocument):
    code: str  # e.g. "UU01"
    name: str
    description: str = ""
    revenue_scheme: str = ""  # description of bagi hasil
    active: bool = True
    created_at: datetime = Field(default_factory=now_utc)


class UnitUsahaCreate(BaseModel):
    code: str
    name: str
    description: str = ""
    revenue_scheme: str = ""


# ============ MITRA (peternak/mitra usaha) ============
class Mitra(BaseDocument):
    unit_usaha_id: str
    name: str
    mitra_type: str = ""  # peternak_domba, peternak_ikan, tukang_kayu, dll
    phone: str = ""
    address: str = ""
    modal: float = 0.0  # untuk unit 4 (perdagangan)
    active: bool = True
    created_at: datetime = Field(default_factory=now_utc)


class MitraCreate(BaseModel):
    unit_usaha_id: str
    name: str
    mitra_type: str = ""
    phone: str = ""
    address: str = ""
    modal: float = 0.0


# ============ CHART OF ACCOUNTS ============
class Account(BaseDocument):
    code: str  # e.g. "1-1101"
    name: str
    category: str  # aset | kewajiban | ekuitas | pendapatan | beban
    subcategory: str = ""  # aset_lancar, aset_tetap, dll
    normal_balance: str  # debit | kredit
    parent_code: Optional[str] = None
    active: bool = True


class AccountCreate(BaseModel):
    code: str
    name: str
    category: str
    subcategory: str = ""
    normal_balance: str
    parent_code: Optional[str] = None


# ============ TRANSACTIONS ============
# Simple double-entry: each transaction has debit account + credit account + amount
class Transaction(BaseDocument):
    date: str  # YYYY-MM-DD
    unit_usaha_id: Optional[str] = None  # null = bumdes-level
    transaction_type: str  # e.g. "penerimaan_bagi_hasil", "beban_operasional", "modal_mitra", etc
    description: str
    amount: float
    debit_account_code: str
    credit_account_code: str
    mitra_id: Optional[str] = None
    reference: str = ""  # optional invoice/nota number
    created_by: str  # user id
    created_at: datetime = Field(default_factory=now_utc)


class TransactionCreate(BaseModel):
    date: str
    unit_usaha_id: Optional[str] = None
    transaction_type: str
    description: str
    amount: float
    debit_account_code: str
    credit_account_code: str
    mitra_id: Optional[str] = None
    reference: str = ""


# ============ REVENUE SHARE (Bagi Hasil) ============
class RevenueShare(BaseDocument):
    period: str  # YYYY-MM
    unit_usaha_id: str
    gross_revenue: float = 0.0
    operational_cost: float = 0.0
    net_revenue: float = 0.0  # gross - op cost
    manager_share: float = 0.0  # 30%
    bumdes_share: float = 0.0  # 70%
    manager_user_id: Optional[str] = None
    status: str = "draft"  # draft | disetor
    settled_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc)


class RevenueShareCreate(BaseModel):
    period: str
    unit_usaha_id: str
    gross_revenue: float
    operational_cost: float = 0.0
