# scripts — 脚本实现

Windows 双击入口在 [bat](../bat/README.md)，本目录存放底层实现，按用途分为两个子目录。

## dev — 开发与诊断

| 文件 | 功能 |
| --- | --- |
| `doctor.py` | 系统诊断命令（运行时 / 依赖 / 构建 / 端口 / 数据 / 配置 / 依赖服务 / 进程探活） |
| `select_free_port.ps1` | 自动挑选空闲端口并输出分配结果（供端口工具调用） |

## database — 数据库脚本

| 文件 | 功能 |
| --- | --- |
| `init_databases.py` | 初始化双数据库（patient.db / employee.db） |

## 使用

```bash
python scripts\dev\doctor.py                       # 运行诊断
python scripts\database\init_databases.py          # 初始化数据库
powershell -File scripts\dev\select_free_port.ps1  # 一键切换端口
```
