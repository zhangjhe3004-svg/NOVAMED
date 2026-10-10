"""
患者注册 / 验证码 API（系统级，始终挂载）—— /api/patient-register
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.security import hash_password
from ..models.models import Patient, PatientAccount, Gender

router = APIRouter(prefix="/api", tags=["患者注册"])


class RegisterPayload(BaseModel):
    name: str = ""
    id_type: str = "居民身份证"
    id_number: str = ""
    surname: str = ""
    given_name: str = ""
    valid_until: str = ""
    issue_date: str = ""
    registered_place: str = ""
    phone: str = ""
    password: str = ""


class SendCodePayload(BaseModel):
    phone: str = ""


@router.post("/patient-register")
def register(payload: RegisterPayload, db: Session = Depends(get_db)):
    if db.query(PatientAccount).filter(PatientAccount.phone == payload.phone).first():
        return {"detail": "该手机号已注册"}
    pat = Patient(name=payload.name or f"{payload.surname}{payload.given_name}",
                  gender=Gender.OTHER, phone=payload.phone)
    db.add(pat)
    db.commit()
    db.refresh(pat)
    acct = PatientAccount(
        patient_id=pat.id, id_type=payload.id_type, id_number=payload.id_number,
        surname=payload.surname, given_name=payload.given_name,
        valid_until=payload.valid_until, issue_date=payload.issue_date,
        registered_place=payload.registered_place, phone=payload.phone,
        password_hash=hash_password(payload.password) if payload.password else "",
        status="已注册",
    )
    db.add(acct)
    db.commit()
    db.refresh(acct)
    return {"id": acct.id, "patient_id": pat.id, "status": acct.status}


@router.post("/patient-register/send-code")
def send_code(payload: SendCodePayload):
    # 演示实现：真实环境接入短信服务
    return {"message": "验证码已发送（演示环境固定为 123456）", "code": "123456", "note": "演示环境"}
