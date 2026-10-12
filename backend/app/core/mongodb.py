"""
MongoDB 连接模块

用途：存储非结构化医疗数据
- 医学影像元数据（DICOM标签、图像描述）
- AI训练数据集（原始文本、标注数据）
- 用户行为日志和偏好
- 知识库文档（医学文献、诊疗指南）
- 模型训练实验记录（超参数、评估指标）

为什么需要MongoDB？
├── PostgreSQL：像Excel表格，适合"患者信息""就诊记录"这类固定格式的数据
└── MongoDB：像文件夹，适合"检查报告""影像描述""AI训练数据"这类格式灵活的数据

启动方式：
├── 开发环境：docker run -d -p 27017:27017 --name medical-mongo mongo:7
├── 生产环境：MongoDB Atlas 云端集群（兼容 vector search）
└── 边缘设备：MongoDB 本地实例，与PostgreSQL同机部署

使用方法：
    from app.core.mongodb import get_mongo_db
    db = get_mongo_db()
    await db.training_datasets.insert_one({...})
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import MongoClient
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# 全局客户端实例
_mongo_client: Optional[AsyncIOMotorClient] = None
_sync_client: Optional[MongoClient] = None
_db: Optional[AsyncIOMotorDatabase] = None

# MongoDB 连接URL
# 开发环境默认连接本地MongoDB
# 生产环境设置环境变量 MONGODB_URL
MONGODB_URL = "mongodb://localhost:27017"
MONGODB_DB_NAME = "medical_system"


async def init_mongodb(url: str = None, db_name: str = None):
    """
    初始化MongoDB连接（应用启动时调用一次）

    参数:
        url: MongoDB连接地址，默认 mongodb://localhost:27017
        db_name: 数据库名，默认 medical_system
    """
    global _mongo_client, _sync_client, _db

    _url = url or MONGODB_URL
    _db_name = db_name or MONGODB_DB_NAME

    try:
        _mongo_client = AsyncIOMotorClient(_url, serverSelectionTimeoutMS=2000)
        _sync_client = MongoClient(_url, serverSelectionTimeoutMS=2000)
        _db = _mongo_client[_db_name]

        # 测试连接
        await _mongo_client.admin.command("ping")
        logger.info(f"MongoDB 已连接: {_db_name}")

        # 创建集合和索引
        await _setup_collections()
    except Exception as e:
        logger.warning(f"MongoDB 连接失败（系统仍可运行，非结构化功能暂时不可用）: {e}")
        _mongo_client = None
        _sync_client = None
        _db = None


async def _setup_collections():
    """创建必要的集合和索引"""
    db = _db

    # 1. 训练数据集集合
    await db.training_datasets.create_index("name", unique=True)
    await db.training_datasets.create_index("created_at")

    # 2. 模型实验记录
    await db.model_experiments.create_index("experiment_id", unique=True)
    await db.model_experiments.create_index([("metrics.accuracy", -1)])

    # 3. 医学知识文档
    await db.knowledge_docs.create_index("title")
    await db.knowledge_docs.create_index("tags")

    # 4. 用户偏好记忆
    await db.user_preferences.create_index("user_id", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("created_at")

    # 5. 医学影像元数据
    await db.medical_images.create_index("patient_id")
    await db.medical_images.create_index("study_uid", unique=True, sparse=True)

    # 6. 向量嵌入存储（配合FAISS使用）
    await db.vector_embeddings.create_index("source_type")
    await db.vector_embeddings.create_index("source_id")


def get_mongo_db() -> Optional[AsyncIOMotorDatabase]:
    """
    获取异步MongoDB数据库实例

    使用示例:
        db = get_mongo_db()
        if db:
            result = await db.collection_name.find_one({"_id": doc_id})
    """
    return _db


def get_sync_mongo() -> Optional[MongoClient]:
    """获取同步MongoDB客户端（用于离线批量操作）"""
    return _sync_client


async def close_mongodb():
    """关闭MongoDB连接（应用关闭时调用）"""
    global _mongo_client, _sync_client, _db
    if _mongo_client:
        _mongo_client.close()
    if _sync_client:
        _sync_client.close()
    _mongo_client = None
    _sync_client = None
    _db = None
    logger.info("MongoDB 连接已关闭")
"""
通用业务工作流引擎 —— 对齐 NocoBase 的工作流编排（非 AI 诊断专用）

概念：
├── wf_defs        流程定义：key / trigger_collection / status_field / meta_json(节点+状态)
├── wf_instances   流程实例：当前节点 / 当前审批人 / 流转历史 / 关联动态行
├── 触发：新建命中 trigger_collection 的集合行 → 自动创建实例并置「审批中」
└── 流转：任一审批人 approve / reject → 推进到下一节点或终态，并回写动态行状态字段

节点：
{ "name": "上级审批", "assign_type": "superior|role", "assign_value": "admin" }
审批人解析：superior → 发起人的上级(superior_id)；role → 该角色所有启用用户；两者都取不到 → 管理员兜底。
"""
import datetime
import json
from typing import List, Optional

