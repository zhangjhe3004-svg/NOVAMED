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
    APP_NAME: str = "NOVAMED Smart Medical System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # ---- 服务器 ----
    # 0.0.0.0 使局域网内其他电脑可通过本机 IP 访问（多机并发使用）
    HOST: str = os.environ.get("BACKEND_HOST", "0.0.0.0")
    PORT: int = int(os.environ.get("BACKEND_PORT", "18001"))

    # ---- 数据库 ----
    # 开发环境默认使用SQLite，生产环境使用PostgreSQL
    DATABASE_URL: str = "sqlite:///./data/medical_system.db"

    # ---- 安全 ----
    # JWT密钥，生产环境必须修改为随机字符串
    SECRET_KEY: str = "change-this-to-a-random-secret-key-in-production"
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
        if not self.DEBUG and self.SECRET_KEY == "change-this-to-a-random-secret-key-in-production":
            raise ValueError("生产环境必须通过环境变量设置强随机 SECRET_KEY")
        return self

    # ---- 多租户数据存储服务（1 万并发，生产用 PostgreSQL + pgbouncer） ----
    STORAGE_DATABASE_URL: Optional[str] = None
    STORAGE_POOL_SIZE: int = 20
    STORAGE_MAX_OVERFLOW: int = 40
    STORAGE_POOL_TIMEOUT: int = 30

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
