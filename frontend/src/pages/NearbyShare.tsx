/**
 * 员工协同 · 附近互传（三星 Quick Share 风格 · 全息粒子节点版）
 *
 * 视觉：深色星空画布铺满容器；中心与本机/同事节点均由 Canvas 粒子球构成，
 * 粒子效果对齐 jarvis-holographic 项目的全息风格——青蓝发光(additive 叠加)、
 * 线框经纬线、外层粒子卫星环、内核心光晕、倾斜光环带、尾迹扫描线。
 * 鼠标移到某个节点上，该节点旁才浮现一张员工名片（姓名/科室/职称/权限等级/连接状态）；
 * 名片默认全部隐藏，离开节点 140ms 后自动收起，同一时刻最多一张。
 * 交互：拖同事气泡入中心圈 → 连接并打开文件传输弹窗；点击气泡 → 查看其团队。
 * 传输支持任意格式文件上传入库（磁盘存储 + nearby_files 元数据）。
 */
import { useEffect, useMemo, useRef, useState, Fragment, type DragEvent } from "react";
import {
  Card, Tabs, Tag, Button, Space, Typography, Modal, Form, Input, Select,
  message, List, Avatar, Popconfirm, Table, Upload, Spin,
} from "antd";
import type { UploadFile } from "antd";
import {
  SendOutlined, ReloadOutlined, TeamOutlined, SafetyCertificateOutlined,
  ArrowUpOutlined, ArrowDownOutlined, InboxOutlined, DownloadOutlined,
  FileOutlined, AimOutlined, LinkOutlined, CheckOutlined, CloseOutlined,
} from "@ant-design/icons";
import { useAuth } from "../stores/auth";
import {
  listPeers, listTransfers, respondTransfer,
  listLevels, createLevel, updateLevel, deleteLevel,
  sendFiles, fileDownloadUrl, teamOf,
  getConnections, requestConnection, requestConnectionPair, respondConnection, cancelConnection,
} from "../api/nearby";
import type { PeerItem, TransferItem, PermissionLevel, TeamMember, ConnectionsData } from "../api/nearby";
import VoiceTextArea from "../components/VoiceTextArea";
import HolographicScene3D, { type SceneNode } from "../components/HolographicScene3D";

const { Title, Text } = Typography;

const LEVEL_COLORS: Record<number, string> = {
  1: "#7c7c96", 2: "#5eead4", 3: "#60a5fa", 4: "#93c5fd",
  5: "#93c5fd", 6: "#f59e0b", 7: "#fb923c", 8: "#f87171", 9: "#7f1d1d",
};

const CANVAS_H = 620;

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function NearbyShare() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [peers, setPeers] = useState<PeerItem[]>([]);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [levels, setLevels] = useState<PermissionLevel[]>([]);
  const [loading, setLoading] = useState(false);

  // 文件传输弹窗
  const [sendOpen, setSendOpen] = useState(false);
  const [target, setTarget] = useState<PeerItem | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  // 团队查看弹窗
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamUser, setTeamUser] = useState<any>(null);
  const [teamItems, setTeamItems] = useState<TeamMember[]>([]);

  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [levelForm] = Form.useForm();

  const [connectedIds, setConnectedIds] = useState<number[]>([]);
  const [connections, setConnections] = useState<ConnectionsData>({ connected_ids: [], incoming_pending: [], outgoing: [] });
  const [focusNodeId, setFocusNodeId] = useState<number | null>(null);
  const [dragOverCenter, setDragOverCenter] = useState(false);

  // 两节点点选申请连接：第一次点选节点 → 选中；再点另一节点 → 弹出连接申请确认
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [pairTargetId, setPairTargetId] = useState<number | null>(null);
  const [pairOpen, setPairOpen] = useState(false);
  const [pairNote, setPairNote] = useState("");
  const [pairSubmitting, setPairSubmitting] = useState(false);

  // 同事名片：默认全部隐藏，指针移到哪个节点才弹哪个（同一时刻最多一张）
  const [hoverPeerId, setHoverPeerId] = useState<number | null>(null);

  // 3D 场景投影坐标（id → 屏幕坐标，中心为 -1）
  const [projected, setProjected] = useState<Record<number, { x: number; y: number }>>({});
  // 3D 场景的相机距离（用于估算 DOM 缩放比例）
  const [camDist, setCamDist] = useState(180);

  // 3D 场景节点数据
  const sceneNodes = useMemo<SceneNode[]>(() => {
    const list: SceneNode[] = [{
      id: -1, label: user?.real_name || "本机", level: user?.auth_level ?? 1,
      active: true, isCenter: true,
    }];
    peers.forEach((p) => {
      list.push({
        id: p.id, label: p.real_name, level: p.auth_level,
        active: connectedIds.includes(p.id),
      });
    });
    return list;
  }, [peers, user, connectedIds]);

  // 层级连线（供 3D 场景绘制）
  const superiorLines3D = useMemo(() => {
    const lines: { from: number; to: number }[] = [];
    peers.forEach((p) => {
      if (p.superior_id == null) return;
      // to：若上级是某个同事，用其 id；否则指向中心(-1)
      const to = peers.some((q) => q.id === p.superior_id) ? (p.superior_id as number) : -1;
      lines.push({ from: p.id, to });
    });
    return lines;
  }, [peers]);

  // 画布自适应（3D 场景宽度，高度固定 CANVAS_H）
  const wrapRef = useRef<HTMLDivElement>(null);
  const [canvasW, setCanvasW] = useState(900);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setCanvasW(el.clientWidth - 24);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 3D 投影回调
  const handleProject = (pos: Record<number, { x: number; y: number }>) => setProjected(pos);
  // 相机距离 → 缩放百分比（用于 DOM 缩放）
  const handleDistance = (d: number) => setCamDist(d);

  // 由相机距离推导 DOM 缩放系数（距离近=放大，距离远=缩小）
  const domScale = useMemo(() => {
    const s = 180 / camDist; // 初始距离 180 → 1
    return Math.min(1.6, Math.max(0.4, s));
  }, [camDist]);
  /* 名片的显隐：移入节点即出，移出后留 140ms 宽限再收，
     这样指针在节点边缘轻微抖动、或从节点滑向旁边时不会闪断。 */
  const cardHideTimer = useRef<number | null>(null);
  const showPeerCard = (id: number) => {
    if (cardHideTimer.current !== null) {
      window.clearTimeout(cardHideTimer.current);
      cardHideTimer.current = null;
    }
    setHoverPeerId(id);
  };
  const hidePeerCard = () => {
    if (cardHideTimer.current !== null) window.clearTimeout(cardHideTimer.current);
    cardHideTimer.current = window.setTimeout(() => {
      cardHideTimer.current = null;
      setHoverPeerId(null);
    }, 140);
  };
  useEffect(
    () => () => {
      if (cardHideTimer.current !== null) window.clearTimeout(cardHideTimer.current);
    },
    []
  );

  /* 名片的锚定：从节点「近边」向外生长，而不是以自身中心去偏移。
     中心偏移的做法在名片变宽时（科室·职称长短不一）一定会压住节点；
     按近边锚定则无论多宽都不会盖到正在指的那个节点。
     近边 = 节点半径 37·scale + 12 的间隙。 */
  const cardEdge = 37 * domScale + 12;
  const cardOnLeft = (x: number) => x > canvasW / 2;

  /* 画布是 overflow:hidden，而 3D 场景可拖拽平移 / 滚轮缩放，节点完全可能贴到上下边缘；
     名片内容固定两行（科室行已设 nowrap），高度稳定，所以把垂直位置夹进画布内即可。 */
  const CARD_H = 92;
  const cardTop = (y: number) =>
    Math.min(Math.max(y, CARD_H / 2 + 6), CANVAS_H - CARD_H / 2 - 6);

  // 节点屏幕坐标（中心/同事）
  const centerPos = projected[-1] ?? { x: canvasW / 2, y: CANVAS_H / 2 };
  const peerScreenPos = (id: number) => projected[id] ?? { x: canvasW / 2, y: CANVAS_H / 2 };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [p, t, c] = await Promise.all([listPeers(), listTransfers(), getConnections()]);
      setPeers(p.items); setTransfers(t.items);
      setConnections(c); setConnectedIds(c.connected_ids);
      if (isAdmin) {
        const lv = await listLevels(); setLevels(lv.items);
      }
    } catch {
      message.error("加载附近协作数据失败");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, [isAdmin]);

  const openSend = (peer: PeerItem, force = false) => {
    if (!force && !connectedIds.includes(peer.id)) {
      message.warning(`尚未与 ${peer.real_name} 建立连接，请先申请连接（搜索或拖拽节点到中心圈）`);
      return;
    }
    setTarget(peer);
    setFileList([]);
    setNote("");
    setSendOpen(true);
  };

  const submitFiles = async () => {
    if (!target) return;
    if (fileList.length === 0) { message.warning("请选择要传输的文件"); return; }
    setSending(true);
    try {
      await sendFiles(target.id, fileList.map((f) => f.originFileObj as File), note);
      message.success(`已发送 ${fileList.length} 个文件到 ${target.real_name}`);
      setSendOpen(false);
      const t = await listTransfers(); setTransfers(t.items);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "发送失败");
    } finally { setSending(false); }
  };

  const openTeam = async (peer: PeerItem) => {
    setTeamOpen(true); setTeamLoading(true); setTeamUser(null); setTeamItems([]);
    try {
      const r = await teamOf(peer.id);
      setTeamUser(r.user); setTeamItems(r.items);
    } catch {
      message.error("加载团队信息失败");
    } finally { setTeamLoading(false); }
  };

  // 连接流程：未连接 → 发起申请（低→高需审批，通过后才能传输）；已连接 → 断开
  const connectFlow = async (peer: PeerItem, note = "") => {
    try {
      const r = await requestConnection(peer.id, note);
      if (r.status === "accepted") {
        message.success(`已与 ${peer.real_name} 建立连接，可以开始传输文件`);
        openSend(peer, true);
      } else if (r.status === "pending") {
        message.info(`已向 ${peer.real_name}（L${peer.auth_level}）发送连接申请，等待对方审批`);
      } else {
        message.warning(`与 ${peer.real_name} 的连接状态：${r.status}`);
      }
      const c = await getConnections();
      setConnections(c); setConnectedIds(c.connected_ids);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "连接申请失败");
    }
  };

  // 断开连接
  const disconnect = async (peer: PeerItem) => {
    try {
      await cancelConnection(peer.id);
      message.success(`已断开与 ${peer.real_name} 的连接`);
      const c = await getConnections();
      setConnections(c); setConnectedIds(c.connected_ids);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "断开失败");
    }
  };

  // 审批：通过 / 拒绝收到的连接申请
  const handleConnectRespond = async (cid: number, accept: boolean) => {
    try {
      await respondConnection(cid, accept);
      message.success(accept ? "已通过连接申请" : "已拒绝连接申请");
      const c = await getConnections();
      setConnections(c); setConnectedIds(c.connected_ids);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "操作失败");
    }
  };

  // 搜索员工：定位到其位置 + 申请连接
  const locateAndConnect = (peer: PeerItem) => {
    setFocusNodeId(peer.id);
    setTimeout(() => setFocusNodeId(null), 100);
    if (connectedIds.includes(peer.id)) {
      message.info(`已定位到 ${peer.real_name}，当前已与 TA 建立连接`);
    } else {
      connectFlow(peer);
    }
  };

  // ---------- 两节点点选申请连接 ----------

  /** 节点展示信息（含中心本机 id=-1） */
  const nodeInfo = (id: number): { id: number; name: string; level: number } | null => {
    if (id === -1) return { id: -1, name: user?.real_name || "本机", level: user?.auth_level ?? 1 };
    const p = peers.find((x) => x.id === id);
    return p ? { id: p.id, name: p.real_name, level: p.auth_level } : null;
  };

  /** 点击节点：未选中 → 选中；点同一个 → 取消；点另一个 → 打开连接申请确认弹窗 */
  const handleNodeClick = (id: number) => {
    if (selectedNodeId === null) {
      setSelectedNodeId(id);
      return;
    }
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
      return;
    }
    setPairTargetId(id);
    setPairNote("");
    setPairOpen(true);
  };

  /** 从选中态打开团队查看（保留原点击查看团队的能力） */
  const openTeamOfSelected = () => {
    if (selectedNodeId === null || selectedNodeId === -1) return;
    const peer = peers.find((x) => x.id === selectedNodeId);
    if (peer) {
      setSelectedNodeId(null);
      openTeam(peer);
    }
  };

  /** 确认发起两节点连接申请 */
  const submitPairConnect = async () => {
    if (selectedNodeId === null || pairTargetId === null || selectedNodeId === pairTargetId) return;
    const n1 = nodeInfo(selectedNodeId);
    const n2 = nodeInfo(pairTargetId);
    if (!n1 || !n2) return;
    setPairSubmitting(true);
    try {
      let r: { id: number; status: string };
      if (selectedNodeId === -1 || pairTargetId === -1) {
        // 一方是本机 → 走原有「我 ↔ 对方」申请
        const peerId = selectedNodeId === -1 ? pairTargetId : selectedNodeId;
        const peer = peers.find((x) => x.id === peerId);
        if (!peer) return;
        r = await requestConnection(peerId, pairNote);
        if (r.status === "accepted") {
          message.success(`已与 ${peer.real_name} 建立连接，可以开始传输文件`);
        } else if (r.status === "pending") {
          message.info(`已向 ${peer.real_name}（L${peer.auth_level}）发送连接申请，等待对方审批`);
        } else {
          message.warning(`连接状态：${r.status}`);
        }
      } else {
        // 两名同事之间 → 由我代为发起（低权限一方为申请方）
        r = await requestConnectionPair(n1.id, n2.id, pairNote);
        const reqName = n1.level <= n2.level ? n1.name : n2.name;
        const tgtName = n1.level <= n2.level ? n2.name : n1.name;
        if (r.status === "accepted") {
          message.success(`已为 ${reqName} 与 ${tgtName} 建立连接`);
        } else if (r.status === "pending") {
          message.info(`已为 ${reqName} 向 ${tgtName} 发起连接申请，等待对方审批`);
        } else {
          message.warning(`连接状态：${r.status}`);
        }
      }
      const c = await getConnections();
      setConnections(c); setConnectedIds(c.connected_ids);
      setPairOpen(false);
      setSelectedNodeId(null);
      setPairTargetId(null);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "连接申请失败");
    } finally {
      setPairSubmitting(false);
    }
  };

  // 中心圈 drop：同事气泡 → 连接（已连接则断开）
  const handleCenterDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOverCenter(false);
    const raw = e.dataTransfer.getData("application/json");
    try {
      const data = raw ? JSON.parse(raw) : null;
      if (data?.peer_id) {
        const peer = peers.find((p) => p.id === data.peer_id);
        if (peer) {
          if (connectedIds.includes(peer.id)) {
            disconnect(peer);
          } else {
            connectFlow(peer);
          }
        }
      }
    } catch { /* 忽略 */ }
  };

  const handleRespond = async (id: number, accept: boolean) => {
    try {
      await respondTransfer(id, accept);
      message.success(accept ? "已接收" : "已拒绝");
      const t = await listTransfers(); setTransfers(t.items);
    } catch { message.error("操作失败"); }
  };

  const saveLevel = async (values: any) => {
    try {
      const editing = levelForm.getFieldValue("id");
      if (editing) await updateLevel(editing, values);
      else await createLevel(values);
      message.success("已保存");
      setLevelModalOpen(false);
      levelForm.resetFields();
      const lv = await listLevels(); setLevels(lv.items);
    } catch (e: any) { message.error(e?.response?.data?.detail || "保存失败"); }
  };

  const levelColumns = [
    { title: "级别", dataIndex: "level", width: 80, render: (v: number) => <Tag color={LEVEL_COLORS[v] || "#7c7c96"}>L{v}</Tag> },
    { title: "名称", dataIndex: "name" },
    { title: "说明", dataIndex: "description" },
    { title: "状态", dataIndex: "enabled", width: 80, render: (v: boolean) => v ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag> },
    {
      title: "操作", width: 150, render: (_: any, r: PermissionLevel) => (
        <Space>
          <Button size="small" type="link" onClick={() => { levelForm.setFieldsValue(r); setLevelModalOpen(true); }}>编辑</Button>
          <Popconfirm title="删除该级别？" onConfirm={async () => { await deleteLevel(r.id); message.success("已删除"); const lv = await listLevels(); setLevels(lv.items); }}>
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 搜索传输文档
  const [searchKw, setSearchKw] = useState("");
  // 员工搜索：按姓名/用户名匹配责任链同事，可定位 + 申请连接
  const peerResults = useMemo(() => {
    const kw = searchKw.trim().toLowerCase();
    if (!kw) return [];
    return peers.filter((p) =>
      (p.real_name || "").toLowerCase().includes(kw) ||
      (p.username || "").toLowerCase().includes(kw) ||
      (p.department || "").toLowerCase().includes(kw),
    );
  }, [searchKw, peers]);
  const searchResults = useMemo(() => {
    const kw = searchKw.trim().toLowerCase();
    if (!kw) return [];
    return transfers.filter((t) => {
      const hay = [
        t.item_title, t.note, t.sender_name, t.receiver_name,
        ...(t.files || []).map((f) => f.file_name),
      ].join(" ").toLowerCase();
      return hay.includes(kw);
    });
  }, [searchKw, transfers]);

  const typeLabel = (v: string) => ({ message: "消息", record: "记录", text: "文本", file: "文件", request: "请求" } as any)[v] || v;

  const transferColumns = [
    { title: "方向", dataIndex: "direction", width: 80, render: (v: string) => v === "request" ? <Tag color="orange">请求</Tag> : <Tag color="blue">发送</Tag> },
    { title: "对方", width: 110, render: (_: any, r: TransferItem) => r.sender_id === user?.id ? r.receiver_name : r.sender_name },
    {
      title: "内容", dataIndex: "item_title", ellipsis: true,
      render: (v: string, r: TransferItem) => (
        <div>
          <div>{v}</div>
          {r.files?.length ? (
            <Space size={6} wrap style={{ marginTop: 4 }}>
              {r.files.map((f) => (
                <a key={f.id} href={fileDownloadUrl(f.id)} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>
                  <FileOutlined /> {f.file_name}（{fmtSize(f.file_size)}）<DownloadOutlined />
                </a>
              ))}
            </Space>
          ) : null}
        </div>
      ),
    },
    { title: "类型", dataIndex: "item_type", width: 90, render: typeLabel },
    { title: "状态", dataIndex: "status", width: 90, render: (v: string) => <Tag color={v === "已接收" ? "green" : v === "已拒绝" ? "red" : "blue"}>{v}</Tag> },
    { title: "时间", dataIndex: "created_at", width: 150, render: (v: string) => v ? new Date(v).toLocaleString("zh-CN") : "-" },
    {
      title: "操作", width: 130, render: (_: any, r: TransferItem) =>
        r.receiver_id === user?.id && r.status === "待处理" ? (
          <Space>
            <Button size="small" type="primary" onClick={() => handleRespond(r.id, true)}>接收</Button>
            <Button size="small" onClick={() => handleRespond(r.id, false)}>拒绝</Button>
          </Space>
        ) : <Text type="secondary">-</Text>,
    },
  ];

  return (
    <div style={{ padding: 4 }}>
      <style>{`
        /* 名片外层只负责贴到节点近边（从近边向外长），内层做缩放入场，
           两层分开写是因为外层已经占用了 transform 做锚定，动画再写 transform 会打架。 */
        @keyframes qs-card-pop { from { opacity:0; transform:scale(.86);} to { opacity:1; transform:scale(1);} }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}><TeamOutlined /> 员工协同 · 附近互传</Title>
          <Text type="secondary">搜索员工可定位并申请连接 · 点击节点选中，再点另一节点即可申请连接（低权限需审批）· 拖节点到中心圈=申请/断开 · 左键拖拽旋转 3D 视角</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadAll} loading={loading}>刷新</Button>
      </div>

      <Tabs
        items={[
          {
            key: "share",
            label: "附近互传",
            children: (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* ===== 搜索（员工定位连接 + 传输文档） ===== */}
                <Card styles={{ body: { padding: "14px 18px" } }}>
                  <Input.Search
                    placeholder="搜索员工（姓名/用户名/科室）可定位并申请连接，或搜索传输文档…"
                    allowClear
                    enterButton
                    size="large"
                    value={searchKw}
                    onChange={(e) => setSearchKw(e.target.value)}
                    style={{ maxWidth: 640 }}
                  />
                  {searchKw.trim() && (
                    <div style={{ marginTop: 12 }}>
                      {/* 员工匹配结果：定位 + 申请连接 */}
                      {peerResults.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 6 }}>
                            <TeamOutlined /> 匹配员工 · 点击「定位并连接」自动飞向其位置并发起连接申请
                          </Text>
                          <Space size={8} wrap>
                            {peerResults.slice(0, 8).map((p) => {
                              const isConnected = connectedIds.includes(p.id);
                              const isPending = connections.outgoing.some((o) => o.target_id === p.id && o.status === "pending");
                              const isRejected = connections.outgoing.some((o) => o.target_id === p.id && o.status === "rejected");
                              return (
                                <Button
                                  key={p.id}
                                  size="small"
                                  type={isConnected ? "default" : "primary"}
                                  ghost={isConnected}
                                  icon={<AimOutlined />}
                                  onClick={() => locateAndConnect(p)}
                                >
                                  {p.real_name}（L{p.auth_level}）
                                  {isConnected ? " · 已连接 · 定位" : isPending ? " · 申请中 · 定位" : isRejected ? " · 被拒重试" : " · 定位并连接"}
                                </Button>
                              );
                            })}
                          </Space>
                        </div>
                      )}
                      {searchResults.length === 0 ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>未找到匹配的传输记录</Text>
                      ) : (
                        <List
                          size="small"
                          dataSource={searchResults.slice(0, 8)}
                          renderItem={(t) => (
                            <List.Item>
                              <List.Item.Meta
                                avatar={<FileOutlined style={{ fontSize: 18, color: "#3b82f6" }} />}
                                title={
                                  <span style={{ fontSize: 12.5 }}>
                                    {t.item_title}
                                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                                      {t.sender_id === user?.id ? `发给 ${t.receiver_name}` : `来自 ${t.sender_name}`} · {typeLabel(t.item_type)} · {t.status}
                                    </Text>
                                  </span>
                                }
                                description={t.files?.length ? (
                                  <Space size={6} wrap>
                                    {t.files.map((f) => (
                                      <a key={f.id} href={fileDownloadUrl(f.id)} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>
                                        <FileOutlined /> {f.file_name}（{fmtSize(f.file_size)}）<DownloadOutlined />
                                      </a>
                                    ))}
                                  </Space>
                                ) : t.note}
                              />
                            </List.Item>
                          )}
                        />
                      )}
                    </div>
                  )}
                </Card>

                <Card styles={{ body: { padding: 12 } }}>
                  <div ref={wrapRef} style={{ width: "100%" }}>
                    {/* 收到的连接申请（待我审批） */}
                    {connections.incoming_pending.length > 0 && (
                      <div style={{
                        marginBottom: 10, padding: "10px 14px", borderRadius: 12,
                        background: "rgba(0,240,255,0.06)", border: "1px solid rgba(0,240,255,0.35)",
                      }}>
                        <div style={{ marginBottom: 8, fontSize: 12.5, color: "#7fdce8", fontWeight: 600 }}>
                          <LinkOutlined /> 收到 {connections.incoming_pending.length} 条连接申请（对方权限低于你，需你审批后才能互传）
                        </div>
                        <Space size={8} wrap>
                          {connections.incoming_pending.map((c) => (
                            <span key={c.id} style={{
                              display: "inline-flex", alignItems: "center", gap: 8,
                              background: "rgba(4,18,31,0.8)", border: "1px solid rgba(0,240,255,0.3)",
                              borderRadius: 999, padding: "4px 6px 4px 12px", fontSize: 12, color: "#cfe8f5",
                            }}>
                              {c.requester_name}（L{c.requester_level}）{c.note ? `：${c.note}` : ""}
                              <Button size="small" type="primary" icon={<CheckOutlined />}
                                onClick={() => handleConnectRespond(c.id, true)}>通过</Button>
                              <Button size="small" danger icon={<CloseOutlined />}
                                onClick={() => handleConnectRespond(c.id, false)}>拒绝</Button>
                            </span>
                          ))}
                        </Space>
                      </div>
                    )}
                    <div
                      className="nb-canvas"
                      style={{
                        position: "relative", width: canvasW || "100%", height: CANVAS_H, overflow: "hidden",
                        background: "#000000",
                        borderRadius: 24, cursor: "grab",
                        touchAction: "none", userSelect: "none",
                      }}
                    >
                      {/* 3D 全息场景（Three.js：粒子球 + 连线 + 旋转/缩放/平移） */}
                      <HolographicScene3D
                        width={canvasW}
                        height={CANVAS_H}
                        nodes={sceneNodes}
                        focusNodeId={focusNodeId}
                        superiorLines={superiorLines3D}
                        connectedIds={connectedIds}
                        onProject={handleProject}
                        onDistanceChange={handleDistance}
                      />

                      {/* 中心交互层（drop zone） */}
                      <div
                        data-node
                        onPointerDown={(e) => e.stopPropagation()}
                        onDragOver={(e) => { e.preventDefault(); setDragOverCenter(true); }}
                        onDragLeave={() => setDragOverCenter(false)}
                        onDrop={handleCenterDrop}
                        onClick={() => handleNodeClick(-1)}
                        style={{
                          position: "absolute", left: centerPos.x, top: centerPos.y,
                          transform: "translate(-50%,-50%)",
                          width: 132 * domScale, height: 132 * domScale, borderRadius: "50%",
                          zIndex: 4,
                          border: selectedNodeId === -1
                            ? "2.5px dashed #FFD54F"
                            : dragOverCenter ? "2.5px dashed #00F0FF" : "2.5px solid transparent",
                          boxShadow: selectedNodeId === -1 ? "0 0 22px rgba(255,213,79,0.55)" : undefined,
                          display: "grid", placeItems: "center",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ textAlign: "center", pointerEvents: "none" }}>
                          <div style={{ color: "#eaf6ff", fontWeight: 650, fontSize: 15 * domScale, textShadow: "0 0 14px rgba(0,240,255,.95)" }}>
                            {user?.real_name}
                          </div>
                          <div style={{ fontSize: 10.5 * domScale, color: "#6fd8e8", marginTop: 3 }}>
                            本机 · L{user?.auth_level ?? 1}{connectedIds.length > 0 ? ` · 已连 ${connectedIds.length} 人` : ""}
                          </div>
                        </div>
                      </div>

                      {/* 同事节点交互层 + 名片 */}
                      {peers.map((peer) => {
                        const p = peerScreenPos(peer.id);
                        const isConnected = connectedIds.includes(peer.id);
                        const isPending = connections.outgoing.some((o) => o.target_id === peer.id && o.status === "pending");
                        const isRejected = connections.outgoing.some((o) => o.target_id === peer.id && o.status === "rejected");
                        const stateText = isConnected ? " · 已连接" : isPending ? " · 申请中" : isRejected ? " · 被拒绝" : "";
                        return (
                          <div key={peer.id}>
                            {/* 透明交互圆 */}
                            <div
                              data-node
                              data-peer={peer.id}
                              draggable
                              onDragStart={(e) => { e.dataTransfer.setData("application/json", JSON.stringify({ peer_id: peer.id })); setHoverPeerId(null); e.stopPropagation(); }}
                              onPointerDown={(e) => e.stopPropagation()}
                              onPointerEnter={() => showPeerCard(peer.id)}
                              onPointerLeave={hidePeerCard}
                              onPointerCancel={hidePeerCard}
                              onClick={() => handleNodeClick(peer.id)}
                              title={selectedNodeId === null
                                ? "点击选中该节点（再点另一节点可申请连接）· 拖到中心圈传输文件"
                                : selectedNodeId === peer.id
                                  ? "再次点击取消选中"
                                  : "点击与已选节点发起连接申请"}
                              style={{
                                position: "absolute", left: p.x, top: p.y,
                                transform: "translate(-50%,-50%)",
                                width: 74 * domScale, height: 74 * domScale, borderRadius: "50%",
                                zIndex: 4, cursor: "pointer",
                                border: selectedNodeId === peer.id ? "2.5px dashed #FFD54F" : "2.5px solid transparent",
                                boxShadow: selectedNodeId === peer.id ? "0 0 22px rgba(255,213,79,0.55)" : undefined,
                              }}
                            />
                            {/* 节点名（始终显示，小字） */}
                            <div style={{
                              position: "absolute", left: p.x, top: p.y + 46 * domScale,
                              transform: "translateX(-50%)", zIndex: 3, pointerEvents: "none", textAlign: "center",
                            }}>
                              <div style={{ fontSize: 11.5, color: "#cfe8f5", fontWeight: 550, maxWidth: 120, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                                {peer.real_name}
                              </div>
                              <div style={{ fontSize: 10, color: isConnected ? "#00F0FF" : isPending ? "#f59e0b" : isRejected ? "#f87171" : "#5f8ca8" }}>
                                {peer.relation === "上级" ? <ArrowUpOutlined /> : <ArrowDownOutlined />} L{peer.auth_level}{stateText}
                              </div>
                            </div>
                            {/* 悬停名片：默认隐藏，指针移入该节点才出现 */}
                            {hoverPeerId === peer.id && (
                              <div className="nb-card-wrap" style={{
                                position: "absolute",
                                left: cardOnLeft(p.x) ? p.x - cardEdge : p.x + cardEdge,
                                top: cardTop(p.y),
                                transform: cardOnLeft(p.x) ? "translate(-100%, -50%)" : "translate(0, -50%)",
                                zIndex: 5, pointerEvents: "none",
                              }}>
                                <div className="nb-card" data-peer-card={peer.id} style={{
                                  minWidth: 148, background: "rgba(4,18,31,0.92)", border: "1px solid rgba(0,240,255,0.45)",
                                  borderRadius: 12, padding: "10px 13px", boxShadow: "0 10px 30px rgba(0,0,0,.6), 0 0 20px rgba(0,240,255,0.15)",
                                  backdropFilter: "blur(4px)",
                                  transformOrigin: cardOnLeft(p.x) ? "right center" : "left center",
                                  animation: "qs-card-pop .22s ease",
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                                    <Avatar size={34} style={{ background: LEVEL_COLORS[peer.auth_level] || "#7c7c96", fontSize: 15, fontWeight: 600 }}>
                                      {peer.real_name?.[0]}
                                    </Avatar>
                                    <div>
                                      <div style={{ color: "#eaf6ff", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>
                                        {peer.real_name} <Tag style={{ fontSize: 9, lineHeight: "15px", padding: "0 5px" }} color="cyan">L{peer.auth_level}</Tag>
                                      </div>
                                      <div style={{ fontSize: 10.5, color: "#7fb6c8", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 210 }}>
                                        {peer.department || "—"} · {peer.title || "—"}
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 10, color: "#5f8ca8", marginTop: 7, borderTop: "1px solid rgba(0,240,255,0.18)", paddingTop: 6 }}>
                                    {peer.relation === "上级" ? "我的上级" : "我的下级"} · {isConnected ? "已连接" : isPending ? "申请中" : isRejected ? "被拒绝" : "待连接"}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {peers.length === 0 && (
                        <div style={{ position: "absolute", left: canvasW / 2, top: CANVAS_H / 2 + 80, transform: "translate(-50%,-50%)", color: "#5f8ca8", fontSize: 13, zIndex: 2 }}>
                          暂无责任链内同事 · 请先在「下级审阅」中分配
                        </div>
                      )}

                      {/* 选中节点浮动操作条（两节点点选申请连接） */}
                      {selectedNodeId !== null && (
                        <div style={{
                          position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
                          zIndex: 7, display: "flex", alignItems: "center", gap: 10,
                          background: "rgba(4,18,31,0.92)", border: "1px solid rgba(255,213,79,0.55)",
                          borderRadius: 999, padding: "6px 8px 6px 14px", boxShadow: "0 8px 26px rgba(0,0,0,.6)",
                        }}>
                          <span style={{ fontSize: 12, color: "#ffe08a", fontWeight: 600 }}>
                            已选中：{nodeInfo(selectedNodeId)?.name || "？"}（L{nodeInfo(selectedNodeId)?.level ?? 1}）
                          </span>
                          <span style={{ fontSize: 11, color: "#8fa8c0" }}>
                            再点击另一节点即可申请连接{selectedNodeId !== -1 ? " · 也可查看团队" : ""}
                          </span>
                          {selectedNodeId !== -1 && (
                            <Button size="small" icon={<TeamOutlined />} onClick={openTeamOfSelected}>查看团队</Button>
                          )}
                          <Button size="small" onClick={() => setSelectedNodeId(null)}>取消选中</Button>
                        </div>
                      )}

                      {/* 全息扫描线 overlay（对齐 jarvis HUD scanlines） */}
                      <div style={{
                        position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none",
                        background: "repeating-linear-gradient(0deg, rgba(0,240,255,0.025) 0px, rgba(0,240,255,0.025) 1px, transparent 1px, transparent 3px)",
                        mixBlendMode: "screen",
                      }} />
                      {/* 暗角 vignette（对齐 jarvis vignette） */}
                      <div style={{
                        position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none",
                        background: "radial-gradient(ellipse at 50% 42%, transparent 55%, rgba(0,0,0,0.55) 100%)",
                      }} />

                      {/* 交互提示 */}
                      <div style={{ position: "absolute", right: 14, bottom: 10, fontSize: 10.5, color: "#5f6f95", zIndex: 3, pointerEvents: "none" }}>
                        左键拖拽旋转 · 滚轮无限缩放 · 右键平移 · 按 R 复位视角 · 悬停节点看名片
                      </div>
                    </div>

                    <div style={{ textAlign: "center", margin: "12px 0 2px", fontSize: 13, color: "#5b6b83" }}>
                      搜索员工可定位并自动申请连接；鼠标移到节点上可看该同事名片；点击一个节点选中（金色高亮），再点击另一节点即可在两者之间发起连接申请（一方为本机时等价于「我 ↔ 对方」，低权限需审批）；拖节点到中心圈=申请/断开；左键拖拽旋转 3D 视角。
                    </div>
                  </div>
                </Card>

                {/* ===== 互传记录（含文件下载） ===== */}
                <Card title="互传记录（发送 / 接收 / 文件）">
                  <Table rowKey="id" dataSource={transfers} size="small" pagination={{ pageSize: 8 }}
                    columns={transferColumns} />
                </Card>
              </div>
            ),
          },
          ...(isAdmin ? [{
            key: "levels",
            label: (<Space><SafetyCertificateOutlined />权限级别管理</Space>),
            children: (
              <div>
                <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text type="secondary">数字越大权限越高；员工级别在「用户管理」中分配</Text>
                  <Button type="primary" size="small" onClick={() => { levelForm.resetFields(); levelForm.setFieldsValue({ id: undefined }); setLevelModalOpen(true); }}>新增级别</Button>
                </div>
                <Table rowKey="id" dataSource={levels} size="small" pagination={false} columns={levelColumns} />
              </div>
            ),
          }] : []),
        ]}
      />

      {/* 两节点连接申请确认弹窗 */}
      <Modal
        title="发起连接申请"
        open={pairOpen}
        onCancel={() => { setPairOpen(false); setSelectedNodeId(null); setPairTargetId(null); }}
        onOk={submitPairConnect}
        confirmLoading={pairSubmitting}
        okText="发起申请"
        cancelText="取消"
      >
        {selectedNodeId !== null && pairTargetId !== null && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, padding: "14px 0 18px" }}>
              {[nodeInfo(selectedNodeId), nodeInfo(pairTargetId)].map((n, i) => (
                n && (
                  <Fragment key={n.id}>
                    {i === 1 && <LinkOutlined style={{ fontSize: 22, color: "#3b82f6" }} />}
                <div style={{ textAlign: "center", minWidth: 120 }}>
                  <Avatar size={52} style={{ background: LEVEL_COLORS[n.level] || "#7c7c96", fontSize: 21, fontWeight: 600 }}>
                    {n.name?.[0]}
                  </Avatar>
                  <div style={{ fontWeight: 600, marginTop: 8 }}>{n.name}{n.id === -1 && "（本机）"}</div>
                  <Tag style={{ marginTop: 4 }} color="cyan">L{n.level}</Tag>
                </div>
                  </Fragment>
                )
              ))}
            </div>
            <div style={{ background: "rgba(59, 130, 246, 0.08)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#9a9ab0", marginBottom: 14 }}>
              低权限一方将作为申请方：低 → 高需对方审批；同级或高 → 低自动通过。
              {selectedNodeId !== -1 && pairTargetId !== -1 && " 两名同事之间的连接将由你代为发起。"}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>备注（可选）</Text>
            <VoiceTextArea rows={2} value={pairNote} onChange={(e: any) => setPairNote(e?.target?.value ?? e)} placeholder="给对方的说明" style={{ marginTop: 6 }} />
          </>
        )}
      </Modal>

      {/* 文件传输弹窗 */}
      <Modal
        title={`向 ${target?.real_name || ""} 传输文件`}
        open={sendOpen}
        onCancel={() => setSendOpen(false)}
        onOk={submitFiles}
        confirmLoading={sending}
        okText="发送"
        okButtonProps={{ disabled: fileList.length === 0 }}
      >
        <Upload.Dragger
          multiple
          fileList={fileList}
          onChange={({ fileList: fl }) => setFileList(fl)}
          beforeUpload={() => false}
          style={{ marginTop: 8 }}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽文件到此处</p>
          <p className="ant-upload-hint">支持任意格式文件，可多选（文档 / 图片 / 视频 / 压缩包等）</p>
        </Upload.Dragger>
        <div style={{ marginTop: 14 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>备注（可选）</Text>
          <VoiceTextArea rows={2} value={note} onChange={(e: any) => setNote(e?.target?.value ?? e)} placeholder="给对方的说明" style={{ marginTop: 6 }} />
        </div>
      </Modal>

      {/* 团队查看弹窗 */}
      <Modal
        title={teamUser ? `${teamUser.real_name} 负责的人员` : "负责的人员"}
        open={teamOpen}
        onCancel={() => setTeamOpen(false)}
        footer={
          teamUser && (
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              {connectedIds.includes(teamUser.id) && (
                <Button danger icon={<CloseOutlined />}
                  onClick={async () => { setTeamOpen(false); await disconnect({ id: teamUser.id, real_name: teamUser.real_name } as PeerItem); }}>
                  断开连接
                </Button>
              )}
              <Button type="primary" icon={<SendOutlined />}
                onClick={() => { setTeamOpen(false); openSend({ id: teamUser.id, real_name: teamUser.real_name } as PeerItem); }}>
                向 TA 传输文件
              </Button>
            </Space>
          )
        }
      >
        {teamLoading ? (
          <div style={{ textAlign: "center", padding: 30 }}><Spin /></div>
        ) : (
          <>
            {teamUser && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #f0f2f7" }}>
                <Avatar size={46} style={{ background: LEVEL_COLORS[teamUser.auth_level] || "#7c7c96", fontSize: 19 }}>{teamUser.real_name?.[0]}</Avatar>
                <div>
                  <div style={{ fontWeight: 600 }}>{teamUser.real_name} <Tag color="blue">L{teamUser.auth_level}</Tag></div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{teamUser.department || "-"} · {teamUser.title || "-"}</Text>
                </div>
              </div>
            )}
            {teamItems.length === 0 ? (
              <div style={{ textAlign: "center", color: "#8d9aae", fontSize: 12, padding: 20 }}>该同事暂无负责的下级人员</div>
            ) : (
              <List
                dataSource={teamItems}
                renderItem={(m) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar size={38} style={{ background: LEVEL_COLORS[m.auth_level] || "#7c7c96", fontSize: 16 }}>{m.real_name?.[0]}</Avatar>}
                      title={<span>{m.real_name} <Tag style={{ fontSize: 10 }}>L{m.auth_level}</Tag></span>}
                      description={<span style={{ fontSize: 11 }}>{m.department || "-"} · {m.title || "-"}</span>}
                    />
                  </List.Item>
                )}
              />
            )}
          </>
        )}
      </Modal>

      <Modal title="权限级别" open={levelModalOpen} onCancel={() => setLevelModalOpen(false)} onOk={() => levelForm.submit()}>
        <Form form={levelForm} layout="vertical" onFinish={saveLevel}>
          <Form.Item name="id" hidden><Input /></Form.Item>
          <Form.Item name="level" label="数字级别（1-9）" rules={[{ required: true, message: "请选择级别" }]}>
            <Select options={Array.from({ length: 9 }, (_, i) => ({ value: i + 1, label: "L" + (i + 1) }))} />
          </Form.Item>
          <Form.Item name="name" label="级别名称" rules={[{ required: true, message: "请输入名称" }]}><Input /></Form.Item>
          <Form.Item name="description" label="说明"><VoiceTextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
