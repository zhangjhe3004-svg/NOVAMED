"""Pydantic 请求/响应模型"""
from typing import Optional, List, Any
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class CardLoginRequest(BaseModel):
    card_no: str


class UserInfo(BaseModel):
    id: int
    username: str
    real_name: str = ""
    role: str = "staff"
    roles: Optional[List[str]] = None  # 多角色编码（sys_user_role 权威；None 时回退 role）
    phone: Optional[str] = None
    email: Optional[str] = None
    id_number: Optional[str] = None
    id_type: Optional[str] = None
    surname: Optional[str] = None
    given_name: Optional[str] = None
    valid_until: Optional[str] = None
    issue_date: Optional[str] = None
    registered_place: Optional[str] = None
    employee_no: Optional[str] = None
    department: Optional[str] = None
    title: Optional[str] = None
    work_status: Optional[str] = "在职"
    auth_level: Optional[int] = 1
    superior_id: Optional[int] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 480
    user: UserInfo


class UserCreate(BaseModel):
    username: str
    password: str
    real_name: Optional[str] = ""
    role: str = "staff"
    role_ids: Optional[List[int]] = None  # 多角色（sys_user_role）；缺省用 role
    phone: Optional[str] = ""
    email: Optional[str] = ""
    id_number: Optional[str] = ""
    id_type: Optional[str] = ""
    surname: Optional[str] = ""
    given_name: Optional[str] = ""
    valid_until: Optional[str] = ""
    issue_date: Optional[str] = ""
    registered_place: Optional[str] = ""
    employee_no: Optional[str] = ""
    department: Optional[str] = ""
    title: Optional[str] = ""
    work_status: Optional[str] = "在职"
    auth_level: Optional[int] = 1
    superior_id: Optional[int] = None


class UserUpdate(BaseModel):
    real_name: Optional[str] = None
    role: Optional[str] = None
    role_ids: Optional[List[int]] = None  # 多角色（sys_user_role）
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    employee_no: Optional[str] = None
    department: Optional[str] = None
    title: Optional[str] = None
    work_status: Optional[str] = None
    auth_level: Optional[int] = None
    superior_id: Optional[int] = None


class PasswordChange(BaseModel):
    old_password: str
    new_password: str


class PasswordReset(BaseModel):
    new_password: str


# ---- 患者域 ----
class PatientCreate(BaseModel):
    name: str
    gender: str = "其他"
    phone: str = ""
    id_card: str = ""
    birth_date: Optional[str] = ""
    address: Optional[str] = ""
    medical_history: Optional[str] = ""


class PatientAccountCreate(BaseModel):
    patient_id: Optional[int] = None
    name: Optional[str] = None
    id_type: str = "居民身份证"
    id_number: str = ""
    surname: str = ""
    given_name: str = ""
    valid_until: Optional[str] = ""
    issue_date: Optional[str] = ""
    registered_place: Optional[str] = ""
    phone: str = ""
    password: str = ""


class AppointmentCreate(BaseModel):
    doctor_id: int
    hospital: Optional[str] = ""
    department: Optional[str] = ""
    date: Optional[str] = ""
    time_slot: Optional[str] = ""
    symptoms: Optional[str] = ""
    patient_name: Optional[str] = ""
    phone: Optional[str] = ""


class MedicalRecordCreate(BaseModel):
    patient_id: int
    symptoms: Optional[str] = ""
    diagnosis: Optional[str] = ""
    prescription: Optional[str] = ""
    notes: Optional[str] = ""


# ---- 通用 ----
class MessageOut(BaseModel):
    detail: str
