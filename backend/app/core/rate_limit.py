"""
认证等敏感接口的内存滑动窗口限流（防暴力破解/撞库）。

生产多实例部署时应替换为 Redis 等共享存储的限流器。
"""
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

SENSITIVE_PREFIXES = (
    "/api/auth/login",
    "/api/patient-auth/login",
    "/api/patient-register",
)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, window: float = 60.0, max_requests: int = 20):
        super().__init__(app)
        self.window = window
        self.max_requests = max_requests
        self._hits = defaultdict(deque)

    async def dispatch(self, request, call_next):
        path = request.url.path
        if not any(path.startswith(p) for p in SENSITIVE_PREFIXES):
            return await call_next(request)
        client = request.client.host if request.client else "unknown"
        key = f"{client}:{path}"
        now = time.time()
        q = self._hits[key]
        while q and q[0] < now - self.window:
            q.popleft()
        if len(q) >= self.max_requests:
            return JSONResponse(status_code=429, content={"detail": "请求过于频繁，请稍后再试"})
        q.append(now)
        return await call_next(request)
