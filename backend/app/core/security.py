"""
安全工具模块
- 密码哈希（bcrypt）
- JWT令牌生成与验证
"""
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from .config import settings


def hash_password(password: str) -> str:
    """对密码进行哈希加密"""
    # bcrypt要求密码不超过72字节
    password_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码是否匹配"""
    plain_bytes = plain_password.encode("utf-8")[:72]
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(plain_bytes, hashed_bytes)


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
    token_type: str = "staff",
) -> str:
    """生成JWT访问令牌，写入类型/受众/签发者声明，隔离员工与患者身份域。"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update(
        {
            "exp": expire,
            "type": token_type,
            "aud": settings.TOKEN_AUDIENCE,
            "iss": settings.TOKEN_ISSUER,
        }
    )
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str, expected_type: Optional[str] = None) -> Optional[dict]:
    """解码JWT令牌，返回payload或None；可选校验令牌类型。"""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            audience=settings.TOKEN_AUDIENCE,
            issuer=settings.TOKEN_ISSUER,
        )
    except JWTError:
        return None
    if expected_type and payload.get("type") != expected_type:
        return None
    return payload

