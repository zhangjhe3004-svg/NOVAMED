"""
定时任务 API —— /api/tasks
任务 CRUD + 启停 + 立即执行 + 后台调度线程（到期执行动作：站内通知提醒）
"""
import threading
import time
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_employee_db, employee_session
from ..core.dependencies import get_current_user
from ..models.models import ScheduledTask, User, Notification

router = APIRouter(prefix="/api/tasks", tags=["定时任务"])


class TaskPayload(BaseModel):
    name: str
    schedule_type: str = "daily"          # once / daily / weekly / interval
    schedule_time: str = "09:00"
    interval_minutes: int = 60
    weekdays: str = "1,2,3,4,5"
    run_at: str = ""
    action: str = "notify"
    payload: str = ""
    enabled: bool = True


def _compute_next_run(t: ScheduledTask) -> datetime | None:
    """根据任务配置计算下一次执行时间"""
    now = datetime.now()
    try:
        if t.schedule_type == "interval":
            base = t.last_run or now
            nxt = base + timedelta(minutes=max(1, t.interval_minutes or 60))
            return max(nxt, now)
        hh, mm = (t.schedule_time or "09:00").split(":")[:2]
        today_at = now.replace(hour=int(hh), minute=int(mm), second=0, microsecond=0)
        if t.schedule_type == "once":
            if t.run_at:
                run = datetime.strptime(t.run_at, "%Y-%m-%d %H:%M")
                return run if run > now else None
            return today_at if today_at > now else None
        if t.schedule_type == "daily":
            if today_at > now:
                return today_at
            return today_at + timedelta(days=1)
        if t.schedule_type == "weekly":
            days = [int(d) for d in (t.weekdays or "").split(",") if d.strip()]
            if not days:
                return None
            for offset in range(8):
                d = today_at + timedelta(days=offset)
                if d <= now or d.isoweekday() not in days:
                    continue
                return d
            return None
    except Exception:
        return None
    return None


def _task_dict(t: ScheduledTask) -> dict:
    return {
        "id": t.id, "name": t.name, "schedule_type": t.schedule_type,
        "schedule_time": t.schedule_time, "interval_minutes": t.interval_minutes,
        "weekdays": t.weekdays, "run_at": t.run_at,
        "action": t.action, "payload": t.payload, "enabled": t.enabled,
        "last_run": t.last_run.isoformat() if t.last_run else None,
        "next_run": t.next_run.isoformat() if t.next_run else None,
        "run_count": t.run_count,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get("")
def list_tasks(_=Depends(get_current_user), db: Session = Depends(get_employee_db)):
    items = db.query(ScheduledTask).filter(ScheduledTask.user_id == _.id).order_by(ScheduledTask.id.desc()).all()
    return {"total": len(items), "items": [_task_dict(t) for t in items]}


@router.post("")
def create_task(payload: TaskPayload, user: User = Depends(get_current_user),
                db: Session = Depends(get_employee_db)):
    t = ScheduledTask(
        user_id=user.id, name=payload.name, schedule_type=payload.schedule_type,
        schedule_time=payload.schedule_time, interval_minutes=payload.interval_minutes,
        weekdays=payload.weekdays, run_at=payload.run_at,
        action=payload.action, payload=payload.payload, enabled=payload.enabled,
    )
    t.next_run = _compute_next_run(t)
    db.add(t)
    db.commit()
    db.refresh(t)
    return _task_dict(t)


@router.put("/{tid}")
def update_task(tid: int, payload: TaskPayload, user: User = Depends(get_current_user),
                db: Session = Depends(get_employee_db)):
    t = db.query(ScheduledTask).filter(ScheduledTask.id == tid, ScheduledTask.user_id == user.id).first()
    if not t:
        return {"detail": "任务不存在"}
    for k in ("name", "schedule_type", "schedule_time", "interval_minutes",
              "weekdays", "run_at", "action", "payload", "enabled"):
        setattr(t, k, getattr(payload, k))
    t.next_run = _compute_next_run(t)
    db.commit()
    db.refresh(t)
    return _task_dict(t)


@router.post("/{tid}/toggle")
def toggle_task(tid: int, user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    t = db.query(ScheduledTask).filter(ScheduledTask.id == tid, ScheduledTask.user_id == user.id).first()
    if not t:
        return {"detail": "任务不存在"}
    t.enabled = not t.enabled
    t.next_run = _compute_next_run(t) if t.enabled else None
    db.commit()
    return _task_dict(t)


@router.post("/{tid}/run")
def run_task_now(tid: int, user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    """立即执行一次"""
    t = db.query(ScheduledTask).filter(ScheduledTask.id == tid, ScheduledTask.user_id == user.id).first()
    if not t:
        return {"detail": "任务不存在"}
    _execute_task(db, t)
    db.commit()
    return _task_dict(t)


@router.delete("/{tid}")
def delete_task(tid: int, user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    t = db.query(ScheduledTask).filter(ScheduledTask.id == tid, ScheduledTask.user_id == user.id).first()
    if not t:
        return {"detail": "任务不存在"}
    db.delete(t)
    db.commit()
    return {"deleted": tid}


def _execute_task(db: Session, t: ScheduledTask):
    """执行任务动作：notify = 给任务所有者发站内通知"""
    if t.action == "notify":
        s = employee_session()
        try:
            s.add(Notification(
                user_id=t.user_id,
                title=f"定时提醒 · {t.name}",
                content=t.payload or t.name,
                level="info",
            ))
            s.commit()
        finally:
            s.close()
    t.last_run = datetime.now()
    t.run_count = (t.run_count or 0) + 1
    t.next_run = _compute_next_run(t)


def _scheduler_loop():
    """后台调度线程：每 20 秒扫描一次到期任务"""
    from ..core.database import init_db
    while True:
        try:
            s = employee_session()
            try:
                now = datetime.now()
                due = s.query(ScheduledTask).filter(
                    ScheduledTask.enabled == True,  # noqa: E712
                    ScheduledTask.next_run != None,  # noqa: E711
                    ScheduledTask.next_run <= now,
                ).all()
                for t in due:
                    _execute_task(s, t)
                if due:
                    s.commit()
            finally:
                s.close()
        except Exception:
            pass
        time.sleep(20)


_scheduler_started = False


def start_scheduler():
    """应用启动时调用：拉起后台调度线程（幂等）"""
    global _scheduler_started
    if _scheduler_started:
        return
    _scheduler_started = True
    th = threading.Thread(target=_scheduler_loop, daemon=True, name="task-scheduler")
    th.start()
