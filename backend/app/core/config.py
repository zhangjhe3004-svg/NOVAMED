"""
应用核心配置
所有配置项通过环境变量覆盖，默认值用于本地开发
"""
import os
from pydantic import model_validator
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用配置"""

    # ---- 基本配置 ----
    APP_NAME: str = "MediCode Smart Medical System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ---- 服务器 ----
    # 0.0.0.0 使局域网内其他电脑可通过本机 IP 访问（多机并发使用）
    HOST: str = os.environ.get("BACKEND_HOST", "0.0.0.0")
    PORT: int = int(os.environ.get("BACKEND_PORT", "18001"))
    ENABLE_TASK_SCHEDULER: bool = True
    ENABLE_FILE_UPLOADS: bool = True

    # ---- 数据库 ----
    # 开发环境默认使用SQLite，生产环境使用PostgreSQL
    DATABASE_URL: str = "sqlite:///./data/medical_system.db"

    # ---- 安全 ----
    # JWT密钥，生产环境必须修改为随机字符串
    SECRET_KEY: str = ""
    BOOTSTRAP_ADMIN_USERNAME: Optional[str] = None
    BOOTSTRAP_ADMIN_PASSWORD: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8小时

    # ---- CORS ----
    # 支持本机与局域网任意来源（多机并发访问）；生产可改为精确域名列表
    CORS_ORIGINS: list[str] = ["http://localhost:3051", "http://localhost:3005"]

    # ---- AI API Keys（可选，后续阶段配置） ----
    OPENAI_API_KEY: Optional[str] = None
    DEEPSEEK_API_KEY: Optional[str] = None
    QWEN_API_KEY: Optional[str] = None

    # ---- 文件存储 ----
    UPLOAD_DIR: str = "./data/uploads"
    MAX_UPLOAD_SIZE_MB: int = 50

    # ---- 安全增强（医院级数据保护） ----
    FERNET_KEY: Optional[str] = None
    RATE_LIMIT_REQUESTS: int = 20
    RATE_LIMIT_WINDOW: int = 60
    ENABLE_SECURITY_HEADERS: bool = True
    TOKEN_ISSUER: str = "medicode"
    TOKEN_AUDIENCE: str = "medicode"

    @model_validator(mode="after")
    def _check_security(self):
        if not self.DEBUG:
            if len(self.SECRET_KEY) < 32:
                raise ValueError("生产环境必须配置至少 32 个字符的随机 SECRET_KEY")
            if "sqlite" in self.DATABASE_URL.lower():
                raise ValueError("生产环境必须使用持久化 PostgreSQL DATABASE_URL")
            if not self.CORS_ORIGINS or "*" in self.CORS_ORIGINS:
                raise ValueError("生产环境必须配置明确的 CORS_ORIGINS，不能使用通配符")
            local_origins = ("http://localhost", "http://127.0.0.1")
            if all(origin.startswith(local_origins) for origin in self.CORS_ORIGINS):
                raise ValueError("生产环境 CORS_ORIGINS 必须包含已部署的前端域名")
            if any(not origin.startswith("https://") for origin in self.CORS_ORIGINS):
                raise ValueError("生产环境 CORS_ORIGINS 仅允许 HTTPS 来源")
        return self

    # ---- 多租户数据存储服务（1 万并发，生产用 PostgreSQL + pgbouncer） ----
    STORAGE_DATABASE_URL: Optional[str] = None
    STORAGE_POOL_SIZE: int = 20
    STORAGE_MAX_OVERFLOW: int = 40
    STORAGE_POOL_TIMEOUT: int = 30

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
