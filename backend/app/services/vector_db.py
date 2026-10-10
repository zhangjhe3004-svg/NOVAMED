"""
向量数据库服务 —— FAISS 向量相似度搜索（智能症状匹配）

未安装 FAISS 时优雅降级：返回空结果，不影响主流程。
"""
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    import faiss  # type: ignore
    import numpy as np  # type: ignore
    _FAISS_OK = True
except Exception:  # pragma: no cover
    _FAISS_OK = False


class VectorDB:
    """轻量向量检索封装：内存索引 + 元数据"""

    def __init__(self):
        self._index: Optional[Any] = None
        self._items: List[Dict[str, Any]] = []

    async def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """向量相似度搜索。无索引/无依赖时返回空列表。"""
        if not _FAISS_OK or self._index is None or not self._items:
            return []
        try:
            # 简化实现：使用固定维度哈希向量；实际接入 embedding 模型后可替换
            q = np.zeros((1, 32), dtype="float32")
            for i, ch in enumerate(query[:32]):
                q[0][i] = float(ord(ch) % 32)
            _, indices = self._index.search(q, min(top_k, len(self._items)))
            return [self._items[i] for i in indices[0] if 0 <= i < len(self._items)]
        except Exception as e:  # pragma: no cover
            logger.warning("向量搜索失败: %s", e)
            return []

    def upsert(self, source_type: str, source_id: int, text: str, meta: Optional[dict] = None):
        """写入一条向量记录（演示实现）。"""
        if not _FAISS_OK:
            return
        self._items.append({"source_type": source_type, "source_id": source_id, "text": text, **(meta or {})})


vector_db = VectorDB()
