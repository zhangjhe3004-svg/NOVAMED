"""
应用核心配置
所有配置项通过环境变量覆盖，默认值用于本地开发
"""
import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用配置"""

    # ---- 基本配置 ----
    APP_NAME: str = "MediCode Smart Medical System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # ---- 服务器 ----
    HOST: str = "127.0.0.1"
    PORT: int = int(__import__("os").get("BACKEND_PORT", "18001"))

    # ---- 数据库 ----
    # 开发环境默认使用SQLite，生产环境使用PostgreSQL
    DATABASE_URL: str = "sqlite:///./data/medical_system.db"

    # ---- 安全 ----
    # JWT密钥，生产环境必须修改为随机字符串
    SECRET_KEY: str = "change-this-to-a-random-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8小时

    # ---- CORS ----
    CORS_ORIGINS: list[str] = ["http://localhost:3051", "http://localhost:3005"]

    # ---- AI API Keys（可选，后续阶段配置） ----
    OPENAI_API_KEY: Optional[str] = None
    DEEPSEEK_API_KEY: Optional[str] = None
    QWEN_API_KEY: Optional[str] = None

    # ---- 文件存储 ----
    UPLOAD_DIR: str = "./data/uploads"
    MAX_UPLOAD_SIZE_MB: int = 50

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
