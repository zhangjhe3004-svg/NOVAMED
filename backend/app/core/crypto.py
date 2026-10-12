"""
医院级 PHI 字段级加密工具（Fernet：AES-128-CBC + HMAC-SHA256，来自 cryptography）。

用途：对患者姓名、手机号、身份证号等敏感字段做静态加密，保证数据库文件被窃取时无法还原明文。

密钥来源：环境变量 FERNET_KEY（Base64 编码 32 字节）。未配置时加密不可用并显式报错，
避免出现“看起来加密、实际明文”的假安全。

兼容性：decrypt_text 对历史明文/非本前缀值原样返回，用于平滑迁移。
"""
import os
from typing import Optional

try:
    from cryptography.fernet import Fernet
    _HAS_CRYPTO = True
except Exception:  # pragma: no cover
    Fernet = None
    _HAS_CRYPTO = False

_PREFIX = "enc:"


def has_crypto() -> bool:
    return _HAS_CRYPTO


def get_fernet_key() -> Optional[str]:
    key = os.getenv("FERNET_KEY")
    return key or None


def _fernet():
    if not _HAS_CRYPTO:
        raise RuntimeError("未安装 cryptography，无法进行字段级加密")
    key = get_fernet_key()
    if not key:
        raise RuntimeError("未配置 FERNET_KEY 环境变量，字段级加密不可用")
    try:
        return Fernet(key.encode("utf-8"))
    except Exception as e:
        raise RuntimeError(f"FERNET_KEY 无效：{e}")


def encrypt_text(plain: Optional[str]) -> Optional[str]:
    """加密明文字符串，返回带前缀密文；空值原样返回。"""
    if plain is None or plain == "":
        return plain
    f = _fernet()
    return _PREFIX + f.encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_text(value: Optional[str]) -> Optional[str]:
    """解密；空值、非加密值、解密失败时均原样返回（兼容历史明文，避免业务中断）。"""
    if value is None or value == "":
        return value
    if not value.startswith(_PREFIX):
        return value
    f = _fernet()
    try:
        return f.decrypt(value[len(_PREFIX):].encode("ascii")).decode("utf-8")
    except Exception:
        return value


def generate_fernet_key() -> str:
    """生成一个新的 Fernet 密钥（Base64）。"""
    if not _HAS_CRYPTO:
        raise RuntimeError("未安装 cryptography")
    return Fernet.generate_key().decode("ascii")
