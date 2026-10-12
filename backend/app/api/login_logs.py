"""
登录日志 API —— /api/login-logs

复刻 scaffold 监控·登录日志：
  - list   ：分页明细（按账号 / IP 关键词 + 结果过滤）
  - stats  ：概览（登录次数 / 成功率 / 失败 / 账号数 / IP 数）+ 趋势桶
  - heatmap：星期 × 小时热力 + 失败聚集异常
  - delete ：按 ID 删除 / 清空
"""
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin
from ..models.models import LoginLog

router = APIRouter(prefix="/api/login-logs", tags=["登录日志"])

FAILED = "失败"


def _window_start(range_: str) -> datetime:
    now = datetime.now()
    if range_ == "24h":
        return now - timedelta(hours=24)
    if range_ == "30d":
        return now - timedelta(days=30)
    return now - timedelta(days=7)


@router.get("")
def list_login_logs(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                    status: str = None, keyword: str = None,
                    _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    q = db.query(LoginLog)
    if status:
        q = q.filter(LoginLog.status == status)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(LoginLog.username.like(like), LoginLog.ip.like(like)))
    total = q.count()
    items = q.order_by(LoginLog.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [
        {"id": l.id, "user_id": l.user_id, "username": l.username,
         "ip": l.ip, "status": l.status,
         "created_at": l.created_at.isoformat() if l.created_at else None}
        for l in items
    ]}


@router.get("/stats")
def login_stats(rng: str = Query("7d", alias="range"), _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    """概览 + 趋势桶：24h 按小时、7d / 30d 按天。参数用 rng，避免遮蔽内建 range()。"""
    start = _window_start(rng)
    rows = db.query(LoginLog).filter(LoginLog.created_at >= start).all()
    total = len(rows)
    failed = sum(1 for r in rows if r.status == FAILED)
    users = len({r.username for r in rows if r.username})
    ips = len({r.ip for r in rows if r.ip})
    success_rate = round((total - failed) / total * 100, 1) if total else 0.0

    series: list = []
    if rng == "24h":
        base = datetime.now().replace(minute=0, second=0, microsecond=0)
        for i in range(23, -1, -1):
            d0 = base - timedelta(hours=i)
            d1 = d0 + timedelta(hours=1)
            seg = [r for r in rows if d0 <= r.created_at < d1]
            series.append({"bucket": d0.strftime("%H:00"), "total": len(seg),
                           "failed": sum(1 for r in seg if r.status == FAILED)})
    else:
        days = 30 if rng == "30d" else 7
        base = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        for i in range(days - 1, -1, -1):
            d0 = base - timedelta(days=i)
            d1 = d0 + timedelta(days=1)
            seg = [r for r in rows if d0 <= r.created_at < d1]
            series.append({"bucket": d0.strftime("%m-%d"), "total": len(seg),
                           "failed": sum(1 for r in seg if r.status == FAILED)})

    return {"range": rng, "total": total, "failed": failed, "successRate": success_rate,
            "users": users, "ips": ips, "series": series}


@router.get("/heatmap")
def login_heatmap(days: int = Query(7, ge=7, le=30), _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    """星期 × 小时热力 + 失败聚集异常（同一 IP / 账号失败 ≥ threshold）。"""
    since = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
    rows = db.query(LoginLog).filter(LoginLog.created_at >= since).all()

    cells: dict = defaultdict(lambda: {"total": 0, "failed": 0})
    for r in rows:
        k = (r.created_at.weekday(), r.created_at.hour)  # 0=周一
        cells[k]["total"] += 1
        if r.status == FAILED:
            cells[k]["failed"] += 1
    cell_list = [{"dow": k[0], "hour": k[1], "total": v["total"], "failed": v["failed"]}
                 for k, v in cells.items()]

    threshold = 5
    by_ip: dict = defaultdict(lambda: {"failed": 0, "total": 0, "keys": set(), "first": None, "last": None})
    by_user: dict = defaultdict(lambda: {"failed": 0, "total": 0, "keys": set(), "first": None, "last": None})
    for r in rows:
        if r.ip:
            a = by_ip[r.ip]
            a["total"] += 1
            if r.username:
                a["keys"].add(r.username)
            if r.status == FAILED:
                a["failed"] += 1
                if a["first"] is None or r.created_at < a["first"]:
                    a["first"] = r.created_at
                if a["last"] is None or r.created_at > a["last"]:
                    a["last"] = r.created_at
        if r.username:
            a = by_user[r.username]
            a["total"] += 1
            if r.ip:
                a["keys"].add(r.ip)
            if r.status == FAILED:
                a["failed"] += 1
                if a["first"] is None or r.created_at < a["first"]:
                    a["first"] = r.created_at
                if a["last"] is None or r.created_at > a["last"]:
                    a["last"] = r.created_at

    anomalies: list = []
    for ip, a in by_ip.items():
        if a["failed"] >= threshold:
            anomalies.append({"kind": "ip", "key": ip, "failed": a["failed"], "total": a["total"],
                              "spread": len(a["keys"]),
                              "firstTime": a["first"].strftime("%m-%d %H:%M"),
                              "lastTime": a["last"].strftime("%m-%d %H:%M")})
    for u, a in by_user.items():
        if a["failed"] >= threshold:
            anomalies.append({"kind": "user", "key": u, "failed": a["failed"], "total": a["total"],
                              "spread": len(a["keys"]),
                              "firstTime": a["first"].strftime("%m-%d %H:%M"),
                              "lastTime": a["last"].strftime("%m-%d %H:%M")})
    anomalies.sort(key=lambda x: -x["failed"])

    return {"days": days, "since": since.strftime("%Y-%m-%d"), "threshold": threshold,
            "cells": cell_list, "anomalies": anomalies}


@router.delete("/{log_id}")
def remove_login_log(log_id: int, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    db.query(LoginLog).filter(LoginLog.id == log_id).delete()
    db.commit()
    return {"ok": True}


@router.delete("")
def clear_login_logs(_=Depends(require_admin), db: Session = Depends(get_employee_db)):
    db.query(LoginLog).delete()
    db.commit()
    return {"ok": True}
