# frontend/src/api — HTTP 客户端

统一基于 `client.ts`（axios 实例，自动附加 JWT、401 统一跳转登录）。

| 文件 | 功能 |
| --- | --- |
| `client.ts` | axios 实例与请求/响应拦截器 |
| `auth.ts` | 员工登录 / 卡片登录 / 当前用户 |
| `users.ts` | 用户管理（列表 / 医生 / 更新 / 删除 / 重置密码） |
| `patients.ts` | 患者档案 CRUD |
| `records.ts` | 就诊记录 / 审核 / 待审计数 / 相似病例 |
| `appointment.ts` | 预约挂号 / 接诊 / 报到 / 完成 |
| `patientAccount.ts` | 患者注册档案 / 验证码 |
| `patientAuth.ts` | 患者端认证与档案 / 预约 / 记录 |
| `ai.ts` | AI 诊断 / 工作流 / 防幻觉配置 / 服务商 |
| `knowledge.ts` | 知识库 |
| `plugins.ts` | 插件市场 |
| `conversation.ts` | AI 会话 |
| `notifications.ts` | 通知 |
| `tokenUsage.ts` | Token 用量统计 |
| `dyn.ts` | 动态数据源 |
| `pages.ts` | 低代码页面 Schema |
| `acl.ts` | 数据权限规则 |
| `wf.ts` | 业务工作流 |
| `schedule.ts` | 号源排班 |
