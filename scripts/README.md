# 脚本目录说明

本目录存放根级辅助脚本与历史归档工具：

- `scan_dead_buttons.py`（原 frontend/scripts）：扫描前端「无 onClick 且无代理组件」的死按钮，可重复运行
- `.tmp_rewrite_ai.py`（归档）：历史 AI 模块改写工具，仅存档，勿在生产使用
- `database/` `dev/`：数据库与开发辅助脚本

后端一次性数据脚本（用户增删/种子数据）已归档至 `backend/scripts/`：
`_add_deputies.py`、`_del_demo.py`、`_del_patient.py`、`_delete_users.py`、`_dl_icons.py`、
`_find_users.py`、`_inspect_dept.py`、`_list_users.py`、`seed_admin_doctors.py`、
`seed_default_patient_records.py`、`seed_departments_schedules.py`、`seed_dept_members.py`、`seed_week_schedule.py`。

> 注意：`backend/data/` 为遗留旧库目录，真实数据库在 `backend/db/`，请勿读写 data/。
