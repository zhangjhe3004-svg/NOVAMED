/**
 * 员工消息页 —— 微信式会话
 *
 * - 会话列表：与我相关的所有同事会话（含未读数、最后一条摘要）
 * - 消息气泡：悬停/点击弹出操作（复制 / 引用 / 撤回 / 删除）
 * - 引用：回复时带上被引用消息的引用条；撤回：2 分钟内可撤回
 * - 联系人也支持群组（前端虚拟群，群发站内消息）
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Input, Button, Tag, Empty, Spin, Modal, Form, Select, message, Popconfirm, Dropdown,
} from "antd";
import type { MenuProps } from "antd";
import {
  SearchOutlined,
  SendOutlined,
  LinkOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  UsergroupAddOutlined,
  FileTextOutlined,
  ReloadOutlined,
  DeleteOutlined,
  RollbackOutlined,
  CopyOutlined,
  RightOutlined,
  LeftOutlined,
} from "@ant-design/icons";
import {
  listPeers, listRecords, sendTransfer,
} from "../api/nearby";
import type { PeerItem, TransferableRecord } from "../api/nearby";
import {
  listMessages, listConversation, sendMessage, recallMessage, deleteMessage,
  markPeerRead,
} from "../api/messages";
import type { ConversationItem, EmployeeMessage } from "../api/messages";
import VoiceTextArea from "../components/VoiceTextArea";

const { TextArea } = Input;

interface Contact {
  id: number;                 // 同事为真实用户 id；群组为负的虚拟 id
  name: string;
  avatar: string;
  isGroup?: boolean;
  members?: { id: number; name: string }[];
  dept?: string;
  title?: string;
  phone?: string;
  email?: string;
  relation?: string;
}

/** 会话视图里的消息（统一结构，含群组本地消息） */
interface ThreadMsg {
  key: string;                // 本地唯一 key（后端消息为 "r<id>"，本地为 "l<ts>"）
  id: number;                 // 后端消息 id；本地消息为负数
  sender: string;
  content: string;
  timestamp: string;
  is_me: boolean;
  recalled?: boolean;
  quote_id?: number | null;
  quote_preview?: string;
  quote_sender?: string;
  quote_is_me?: boolean;
}

export default function Messages() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Contact[]>([]);
  const [peers, setPeers] = useState<PeerItem[]>([]);
  const [records, setRecords] = useState<TransferableRecord[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [thread, setThread] = useState<ThreadMsg[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [segFilter, setSegFilter] = useState("全部");
  const [keyword, setKeyword] = useState("");

  // 引用回复
  const [quoting, setQuoting] = useState<ThreadMsg | null>(null);

  // 群组本地消息（虚拟会话，不落库）
  const [groupSent, setGroupSent] = useState<Record<number, ThreadMsg[]>>({});

  const threadBoxRef = useRef<HTMLDivElement>(null);

  // 弹窗
  const [groupOpen, setGroupOpen] = useState(false);
  // 左右面板折叠态（收起后保留 44px 窄条，点击可展开）
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [groupForm] = Form.useForm();
  const [startOpen, setStartOpen] = useState(false);
  const [startForm] = Form.useForm();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm] = Form.useForm();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareForm] = Form.useForm();
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm] = Form.useForm();

  const fmtTime = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay
      ? d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const el = threadBoxRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [p, conv, r] = await Promise.all([
        listPeers(),
        listMessages(),
        listRecords().catch(() => ({ items: [] as TransferableRecord[] })),
      ]);
      setPeers(p.items || []);
      setConversations(conv.items || []);
      setRecords(r.items || []);
      const list: Contact[] = (p.items || []).map((x) => ({
        id: x.id,
        name: x.real_name || x.username,
        avatar: (x.real_name || x.username || "员")[0],
        dept: x.department,
        title: x.title,
        phone: x.phone,
        relation: x.relation,
      }));
      setContacts(list);
      return list;
    } catch {
      message.error("加载消息数据失败");
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const contactList = useMemo(() => [...contacts, ...groups], [contacts, groups]);

  /** 打开与某联系人的会话：加载真实对话 / 群组本地消息，并标记已读 */
  const openConversation = async (c: Contact) => {
    setSelectedContact(c);
    setQuoting(null);
    if (c.isGroup) {
      setThread(groupSent[c.id] || []);
      scrollToBottom();
      return;
    }
    setThreadLoading(true);
    try {
      const res = await listConversation(c.id);
      const msgs: ThreadMsg[] = (res.items || []).map((m) => ({
        key: `r${m.id}`,
        id: m.id,
        sender: m.sender_name || c.name,
        content: m.content || "",
        timestamp: fmtTime(m.created_at),
        is_me: m.sender_id !== c.id,
        recalled: m.recalled,
        quote_id: m.quote_id,
        quote_preview: m.quote_preview,
      }));
      setThread(msgs);
      // 标记该会话已读
      markPeerRead(c.id).then(() => loadData(true)).catch(() => {});
    } catch {
      message.error("加载对话失败");
      setThread([]);
    } finally {
      setThreadLoading(false);
      scrollToBottom();
    }
  };

  const unreadOf = (peerId: number) =>
    conversations.find((c) => c.peer_id === peerId)?.unread || 0;

  const totalUnread = useMemo(
    () => conversations.reduce((a, c) => a + (c.unread || 0), 0),
    [conversations]
  );

  /** 会话摘要（含群组本地） */
  const convSummaries = useMemo(() => {
    const list = conversations.map((c) => ({
      key: `c${c.peer_id}`,
      contactId: c.peer_id,
      lastText: c.last_recalled ? "已撤回" : c.last_text,
      lastTime: fmtTime(c.last_at),
      unread: c.unread,
      lastIsMe: c.last_is_me,
    }));
    groups.forEach((g) => {
      const local = groupSent[g.id] || [];
      const last = local[local.length - 1];
      list.push({
        key: `g${g.id}`,
        contactId: g.id,
        lastText: last ? last.content : "群组已创建",
        lastTime: last ? last.timestamp : "",
        unread: 0,
        lastIsMe: true,
      });
    });
    return list;
  }, [conversations, groups, groupSent]);

  const visibleContacts = useMemo(() => {
    let list = contactList;
    if (segFilter.startsWith("未读")) {
      list = list.filter((c) => !c.isGroup && unreadOf(c.id) > 0);
    } else if (segFilter === "@我") {
      // 「@我」按最近一条消息含 @ 过滤（简化）
      list = list.filter((c) => {
        const s = convSummaries.find((x) => x.contactId === c.id);
        return s ? (s.lastText || "").includes("@") : false;
      });
    }
    const kw = keyword.trim();
    if (kw) list = list.filter((c) => c.name.includes(kw));
    return list;
  }, [contactList, segFilter, keyword, convSummaries]);

  const targetsOf = (c: Contact | null) =>
    !c ? [] : c.isGroup ? (c.members || []).map((m) => m.id) : [c.id];

  /** 发送（支持引用回复） */
  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text) { message.warning("请输入消息内容"); return; }
    if (!selectedContact) { message.warning("请先选择联系人"); return; }
    const targets = targetsOf(selectedContact);
    if (targets.length === 0) { message.warning("该群组暂无成员"); return; }
    const quote = quoting;
    setSending(true);
    try {
      if (selectedContact.isGroup) {
        // 群组本地消息
        const msg: ThreadMsg = {
          key: `l${Date.now()}`,
          id: -Date.now(),
          sender: "我",
          content: text,
          timestamp: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
          is_me: true,
          quote_id: quote?.id,
          quote_preview: quote?.content || "",
          quote_sender: quote?.sender || "",
        };
        setGroupSent((prev) => ({ ...prev, [selectedContact.id]: [...(prev[selectedContact.id] || []), msg] }));
        setThread((prev) => [...prev, msg]);
        // 群组消息落库给每位成员（引用附带预览）
        await Promise.all(
          targets.map((rid) =>
            sendMessage({
              receiver_id: rid,
              title: `[群组] ${selectedContact.name}`,
              content: text,
              quote_id: quote && quote.id > 0 ? quote.id : undefined,
            })
          )
        );
        message.success(`已发送给群组 ${selectedContact.name}（${targets.length} 人）`);
      } else {
        const res = await sendMessage({
          receiver_id: selectedContact.id,
          content: text,
          quote_id: quote && quote.id > 0 ? quote.id : undefined,
        });
        const msg: ThreadMsg = {
          key: `r${res.id}`,
          id: res.id,
          sender: "我",
          content: text,
          timestamp: fmtTime(res.created_at) || new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
          is_me: true,
          quote_id: quote?.id,
          quote_preview: quote?.content || "",
        };
        setThread((prev) => [...prev, msg]);
        message.success(`已发送给 ${selectedContact.name}`);
      }
      setInputValue("");
      setQuoting(null);
      loadData(true);
      scrollToBottom();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "发送失败");
    } finally {
      setSending(false);
    }
  };

  /** 复制消息文本 */
  const copyText = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      message.success("已复制");
    } catch {
      message.error("复制失败");
    }
  };

  /** 引用回复 */
  const doQuote = (m: ThreadMsg) => {
    setQuoting(m);
  };

  /** 撤回消息（仅自己、2 分钟内） */
  const doRecall = async (m: ThreadMsg) => {
    if (m.id <= 0) {
      // 本地群组消息：直接移除
      if (selectedContact?.isGroup) {
        const next = thread.filter((x) => x.key !== m.key);
        setThread(next);
        setGroupSent((prev) => ({
          ...prev,
          [selectedContact!.id]: (prev[selectedContact!.id] || []).filter((x) => x.key !== m.key),
        }));
      }
      return;
    }
    try {
      await recallMessage(m.id);
      message.success("已撤回");
      setThread((prev) => prev.map((x) => (x.key === m.key ? { ...x, recalled: true, content: "" } : x)));
      loadData(true);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "撤回失败");
    }
  };

  /** 删除消息（单方隐藏） */
  const doDelete = async (m: ThreadMsg) => {
    if (m.id <= 0) {
      if (selectedContact?.isGroup) {
        const next = thread.filter((x) => x.key !== m.key);
        setThread(next);
        setGroupSent((prev) => ({
          ...prev,
          [selectedContact!.id]: (prev[selectedContact!.id] || []).filter((x) => x.key !== m.key),
        }));
      }
      return;
    }
    try {
      await deleteMessage(m.id);
      message.success("已删除");
      setThread((prev) => prev.filter((x) => x.key !== m.key));
      loadData(true);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "删除失败");
    }
  };

  /** 在 thread 中查找被引用的消息（用于显示引用条） */
  const findQuoted = (m: ThreadMsg): ThreadMsg | undefined =>
    m.quote_id ? thread.find((x) => x.id === m.quote_id) : undefined;

  const menuFor = (m: ThreadMsg): MenuProps["items"] => [
    { key: "copy", label: "复制", icon: <CopyOutlined />, disabled: m.recalled },
    { key: "quote", label: "引用", icon: <RollbackOutlined />, disabled: m.recalled },
    ...(m.is_me
      ? [
          { key: "recall", label: "撤回", icon: <RollbackOutlined />, danger: true },
          { key: "delete", label: "删除", icon: <DeleteOutlined />, danger: true },
        ]
      : [{ key: "delete", label: "删除", icon: <DeleteOutlined />, danger: true }]),
  ];

  const onMenuClick = (m: ThreadMsg, key: string) => {
    if (key === "copy") copyText(m.content);
    else if (key === "quote") doQuote(m);
    else if (key === "recall") doRecall(m);
    else if (key === "delete") doDelete(m);
  };

  /** 新建群组 */
  const createGroup = async (values: any) => {
    const memberIds: number[] = values.member_ids || [];
    const members = memberIds
      .map((id) => peers.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => ({ id: p!.id, name: p!.real_name || p!.username }));
    if (members.length === 0) { message.warning("请至少选择 1 位成员"); return; }
    const g: Contact = {
      id: -Date.now(),
      name: values.name?.trim() || `群组（${members.length} 人）`,
      avatar: (values.name?.trim() || "群")[0],
      isGroup: true,
      members,
    };
    setGroups((prev) => [...prev, g]);
    setSelectedContact(g);
    setThread([]);
    setQuoting(null);
    setGroupOpen(false);
    groupForm.resetFields();
    message.success("群组已创建，可直接群发消息");
  };

  /** 发起会话 */
  const startConversation = async (values: any) => {
    const peer = peers.find((p) => p.id === values.peer_id);
    if (!peer) { message.warning("请选择同事"); return; }
    let c = contacts.find((x) => x.id === peer.id);
    if (!c) {
      c = {
        id: peer.id,
        name: peer.real_name || peer.username,
        avatar: (peer.real_name || peer.username || "员")[0],
        dept: peer.department,
        title: peer.title,
        phone: peer.phone,
      };
      setContacts((prev) => [...prev, c!]);
    }
    setStartOpen(false);
    startForm.resetFields();
    openConversation(c);
  };

  /** 插入链接到输入框 */
  const insertLink = async (values: any) => {
    const text = (values.text || "").trim() || values.url.trim();
    const md = `[${text}](${values.url.trim()})`;
    setInputValue((v) => (v ? `${v}${v.endsWith(" ") ? "" : " "}${md}` : md));
    setLinkOpen(false);
    linkForm.resetFields();
  };

  /** 共享 / 传输就诊记录 */
  const submitShare = async (values: any) => {
    if (!selectedContact) return;
    const rec = records.find((r) => r.id === values.record_id);
    if (!rec) { message.warning("请选择就诊记录"); return; }
    const targets = targetsOf(selectedContact);
    if (targets.length === 0) { message.warning("该群组暂无成员"); return; }
    try {
      await Promise.all(
        targets.map((rid) =>
          sendTransfer({
            receiver_id: rid,
            direction: "send",
            item_type: "record",
            item_title: `就诊记录 #${rec.id}`,
            payload: {
              record_id: rec.id,
              patient_id: rec.patient_id,
              diagnosis: rec.diagnosis,
              symptoms: rec.symptoms,
            },
            note: values.note || "",
          })
        )
      );
      message.success(`就诊记录 #${rec.id} 已共享给 ${selectedContact.name}`);
      setShareOpen(false);
      shareForm.resetFields();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "共享失败");
    }
  };

  /** 请求就诊记录 */
  const submitRequest = async (values: any) => {
    if (!selectedContact) return;
    const targets = targetsOf(selectedContact);
    if (targets.length === 0) { message.warning("该群组暂无成员"); return; }
    try {
      await Promise.all(
        targets.map((rid) =>
          sendTransfer({
            receiver_id: rid,
            direction: "request",
            item_type: "request",
            item_title: values.request?.slice(0, 40) || "请求就诊记录",
            payload: { request: values.request || "请提供您负责的患者数据" },
            note: values.note || "",
          })
        )
      );
      message.success("记录请求已发出，可在「员工协同 · 附近互传」查看进度");
      setRequestOpen(false);
      requestForm.resetFields();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "请求失败");
    }
  };

  const dismissGroup = (id: number) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    if (selectedContact?.id === id) setSelectedContact(contacts[0] || null);
    message.success("群组已解散");
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  const groupTargets = targetsOf(selectedContact);

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>消息</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>员工消息 · 支持引用、撤回与删除，与同事高效协作。</div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="lv-btn" type="button" onClick={() => loadData(true)}><ReloadOutlined /> 刷新</button>
          <button className="lv-btn" type="button" onClick={() => { groupForm.resetFields(); setGroupOpen(true); }}><UsergroupAddOutlined /> 新建群组</button>
          <button className="lv-btn lv-btn--primary" type="button" onClick={() => { startForm.resetFields(); setStartOpen(true); }}><SendOutlined /> 发起会话</button>
        </div>
      </div>

      {/* 三栏聊天界面（左右两栏可折叠，收起后保留 44px 窄条） */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${leftOpen ? "290px" : "44px"} minmax(0, 1fr) ${rightOpen ? "260px" : "44px"}`,
          minHeight: 640,
          background: "#1a2740",
          borderRadius: 14,
          border: "1px solid rgba(59, 130, 246, 0.18)",
          overflow: "hidden",
        }}
      >
        {/* 左侧：联系人列表（可折叠为窄条） */}
        {!leftOpen ? (
          <aside
            style={{ borderRight: "1px solid rgba(59, 130, 246, 0.18)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12, gap: 10 }}
          >
            <button
              type="button"
              title="展开联系人列表"
              onClick={() => setLeftOpen(true)}
              style={{
                width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(59, 130, 246, 0.3)",
                background: "rgba(59, 130, 246, 0.14)", color: "#93c5fd", cursor: "pointer",
                display: "grid", placeItems: "center", fontSize: 13, flex: "none",
              }}
            >
              <RightOutlined />
            </button>
            <span style={{ writingMode: "vertical-rl", letterSpacing: 4, fontSize: 11, color: "var(--muted)", userSelect: "none" }}>联系人</span>
          </aside>
        ) : (
        <aside style={{ borderRight: "1px solid rgba(59, 130, 246, 0.18)" }}>
          <div style={{ padding: "16px 16px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <label className="input" style={{ width: "100%", flex: 1, minWidth: 0 }}>
              <SearchOutlined style={{ color: "var(--muted)" }} />
              <Input
                placeholder="搜索联系人或消息"
                variant="borderless"
                style={{ fontSize: 12 }}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                allowClear
              />
            </label>
            <button
              type="button"
              title="收起"
              onClick={() => setLeftOpen(false)}
              style={{
                width: 26, height: 26, borderRadius: 7, border: "1px solid rgba(59, 130, 246, 0.3)",
                background: "transparent", color: "var(--muted)", cursor: "pointer",
                display: "grid", placeItems: "center", fontSize: 11, flex: "none",
              }}
            >
              <LeftOutlined />
            </button>
          </div>

          <div style={{ padding: "0 16px 10px" }}>
            <div className="segmented">
              {["全部", `未读 ${totalUnread}`, "@我"].map((s) => (
                <button
                  key={s}
                  className={segFilter === s ? "selected" : ""}
                  onClick={() => setSegFilter(s)}
                  style={{ flex: 1 }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {visibleContacts.length === 0 && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span style={{ fontSize: 11 }}>暂无联系人</span>}
                style={{ marginTop: 30 }}
              />
            )}
            {visibleContacts.map((contact) => {
              const sum = convSummaries.find((x) => x.contactId === contact.id);
              const unread = contact.isGroup ? 0 : unreadOf(contact.id);
              return (
                <button
                  key={contact.id}
                  onClick={() => openConversation(contact)}
                  style={{
                    display: "flex",
                    gap: 11,
                    width: "100%",
                    textAlign: "left",
                    padding: "14px 18px",
                    background: selectedContact?.id === contact.id ? "rgba(59, 130, 246, 0.16)" : "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(59, 130, 246, 0.14)",
                    cursor: "pointer",
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    className="avatar"
                    style={{
                      background: contact.isGroup ? "#16294d" : "rgba(59, 130, 246, 0.18)",
                      color: "#eaf1fb",
                    }}
                  >
                    {contact.avatar}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                      {contact.name}
                      <span style={{ fontWeight: 400, fontSize: 10, color: "var(--muted)" }}>{sum?.lastTime || ""}</span>
                    </b>
                    <p
                      style={{
                        margin: "5px 0 0",
                        fontSize: 11,
                        color: "#8290a4",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 190,
                      }}
                    >
                      {sum?.lastIsMe ? "我：" : ""}{sum?.lastText || "暂无消息"}
                    </p>
                  </span>
                  {unread > 0 && (
                    <span
                      style={{
                        minWidth: 17,
                        height: 17,
                        borderRadius: 9,
                        background: "#3b82f6",
                        color: "#fff",
                        fontSize: 10,
                        display: "grid",
                        placeItems: "center",
                        padding: "0 5px",
                        marginLeft: 6,
                      }}
                    >
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>
        )}

        {/* 中间：对话线程 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              padding: "16px 22px",
              borderBottom: "1px solid rgba(59, 130, 246, 0.16)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {selectedContact ? (
              <>
                <span
                  className="avatar"
                  style={{
                    background: selectedContact.isGroup ? "#16294d" : "#2a2a40",
                    color: "#eaf1fb",
                  }}
                >
                  {selectedContact.avatar}
                </span>
                <div>
                  <b style={{ fontSize: 13, display: "block" }}>{selectedContact.name}</b>
                  <small style={{ fontSize: 10, color: "#9a9ab0" }}>
                    {selectedContact.isGroup
                      ? `群组 · ${groupTargets.length} 位成员`
                      : `${selectedContact.dept ? selectedContact.dept + " · " : ""}${selectedContact.title || selectedContact.relation || "在线"}`}
                  </small>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <Button
                    size="small"
                    icon={<FileTextOutlined />}
                    onClick={() => { shareForm.resetFields(); setShareOpen(true); }}
                  >
                    共享记录
                  </Button>
                </div>
              </>
            ) : (
              <b style={{ fontSize: 13 }}>请选择左侧联系人开始会话</b>
            )}
          </div>

          {/* 消息列表 */}
          <div
            ref={threadBoxRef}
            style={{
              flex: 1,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              background: "#0f0f1a",
              overflowY: "auto",
              maxHeight: 420,
            }}
          >
            <div
              style={{
                alignSelf: "center",
                fontSize: 10,
                color: "var(--muted)",
                background: "#101b2e",
                padding: "4px 12px",
                borderRadius: 999,
              }}
            >
              点击消息气泡可复制 · 引用 · 撤回 · 删除
            </div>

            {threadLoading ? (
              <div style={{ textAlign: "center", padding: 20 }}><Spin size="small" /></div>
            ) : thread.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 11, marginTop: 20 }}>
                暂无消息记录，发送第一条消息开始沟通
              </div>
            ) : (
              thread.map((msg) => {
                const quoted = findQuoted(msg);
                return (
                  <Dropdown
                    key={msg.key}
                    trigger={["contextMenu"]}
                    menu={{ items: menuFor(msg), onClick: ({ key }) => onMenuClick(msg, key) }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        maxWidth: "78%",
                        alignSelf: msg.is_me ? "flex-end" : "flex-start",
                        flexDirection: msg.is_me ? "row-reverse" : "row",
                      }}
                    >
                      <span
                        className="avatar"
                        style={{
                          background: msg.is_me ? "rgba(59, 130, 246, 0.22)" : "#2a2a40",
                          color: msg.is_me ? "#93c5fd" : "#9a9ab0",
                        }}
                      >
                        {msg.is_me ? "我" : selectedContact?.avatar}
                      </span>
                      <div>
                        <div
                          style={{
                            background: msg.is_me ? "#3b82f6" : "#2a2a40",
                            color: msg.is_me ? "#fff" : "#eaf1fb",
                            border: msg.is_me ? "1px solid #3b82f6" : "1px solid rgba(59, 130, 246, 0.2)",
                            borderRadius: 12,
                            padding: "10px 13px",
                            fontSize: 12,
                            lineHeight: 1.75,
                            whiteSpace: "pre-wrap",
                            maxWidth: 360,
                            opacity: msg.recalled ? 0.6 : 1,
                          }}
                        >
                          {/* 引用条 */}
                          {(quoted || msg.quote_preview) && (
                            <div
                              style={{
                                fontSize: 10,
                                color: msg.is_me ? "rgba(232,232,244,0.9)" : "#9a9ab0",
                                background: msg.is_me ? "rgba(59, 130, 246, 0.3)" : "#101b2e",
                                borderRadius: 6,
                                padding: "5px 8px",
                                marginBottom: 6,
                                borderLeft: `3px solid ${msg.is_me ? "rgba(232,232,244,0.72)" : "#3b82f6"}`,
                              }}
                            >
                              <b>{quoted?.sender || msg.quote_sender || "引用"}</b>
                              <div style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {quoted?.recalled ? "已撤回" : quoted?.content || msg.quote_preview || ""}
                              </div>
                            </div>
                          )}
                          {msg.recalled ? <em style={{ fontStyle: "normal" }}>你撤回了一条消息</em> : msg.content}
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: msg.is_me ? "flex-end" : "flex-start", marginTop: 4 }}>
                          <time style={{ fontSize: 10, color: "var(--muted)" }}>{msg.timestamp}</time>
                          {/* 悬停操作按钮 */}
                          <span style={{ display: "flex", gap: 4 }}>
                            {!msg.recalled && (
                              <Button size="small" type="text" icon={<CopyOutlined />} title="复制" onClick={() => copyText(msg.content)} />
                            )}
                            {!msg.recalled && (
                              <Button size="small" type="text" icon={<RollbackOutlined />} title="引用" onClick={() => doQuote(msg)} />
                            )}
                            {msg.is_me && (
                              msg.recalled ? (
                                <span style={{ fontSize: 10, color: "#c4423e" }}>已撤回</span>
                              ) : (
                                <Popconfirm title="撤回这条消息？" onConfirm={() => doRecall(msg)}>
                                  <Button size="small" type="text" icon={<RollbackOutlined />} title="撤回" style={{ color: "#c4423e" }} />
                                </Popconfirm>
                              )
                            )}
                            <Popconfirm title="删除这条消息（仅对你隐藏）？" onConfirm={() => doDelete(msg)}>
                              <Button size="small" type="text" danger icon={<DeleteOutlined />} title="删除" />
                            </Popconfirm>
                          </span>
                        </div>
                      </div>
                    </div>
                  </Dropdown>
                );
              })
            )}
          </div>

          {/* 引用提示条 */}
          {quoting && (
            <div
              style={{
                margin: "0 18px 6px",
                padding: "8px 12px",
                background: "rgba(59, 130, 246, 0.12)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 11,
                color: "#2d527e",
              }}
            >
              <RollbackOutlined />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                引用 {quoting.sender}：{quoting.recalled ? "已撤回" : quoting.content}
              </span>
              <Button size="small" type="text" onClick={() => setQuoting(null)}>取消</Button>
            </div>
          )}

          {/* 消息输入框 */}
          <div
            style={{
              borderTop: "1px solid rgba(59, 130, 246, 0.16)",
              padding: "14px 18px",
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <Button
              icon={<LinkOutlined />}
              title="插入链接"
              onClick={() => { linkForm.resetFields(); setLinkOpen(true); }}
            />
            <label className="input" style={{ flex: 1 }}>
              <TextArea
                placeholder="输入消息，Enter 发送，Shift+Enter 换行"
                variant="borderless"
                autoSize={{ minRows: 1, maxRows: 4 }}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                style={{ fontSize: 12, resize: "none" }}
              />
            </label>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={sending}
              disabled={!selectedContact}
            >
              发送
            </Button>
          </div>
        </div>

        {/* 右侧：联系人详情（可折叠为窄条） */}
        {!rightOpen ? (
          <aside
            style={{ borderLeft: "1px solid rgba(59, 130, 246, 0.18)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12, gap: 10 }}
          >
            <button
              type="button"
              title="展开详情"
              onClick={() => setRightOpen(true)}
              style={{
                width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(59, 130, 246, 0.3)",
                background: "rgba(59, 130, 246, 0.14)", color: "#93c5fd", cursor: "pointer",
                display: "grid", placeItems: "center", fontSize: 13, flex: "none",
              }}
            >
              <LeftOutlined />
            </button>
            <span style={{ writingMode: "vertical-rl", letterSpacing: 4, fontSize: 11, color: "var(--muted)", userSelect: "none" }}>详情</span>
          </aside>
        ) : (
        <aside style={{ borderLeft: "1px solid rgba(59, 130, 246, 0.18)" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 12px 0" }}>
            <button
              type="button"
              title="收起"
              onClick={() => setRightOpen(false)}
              style={{
                width: 26, height: 26, borderRadius: 7, border: "1px solid rgba(59, 130, 246, 0.3)",
                background: "transparent", color: "var(--muted)", cursor: "pointer",
                display: "grid", placeItems: "center", fontSize: 11,
              }}
            >
              <RightOutlined />
            </button>
          </div>
          {selectedContact && (
            <div style={{ padding: "20px 22px" }}>
              <div className="person" style={{ marginBottom: 18 }}>
                <span
                  className="avatar lg"
                  style={{
                    background: selectedContact.isGroup ? "#16294d" : "#2a2a40",
                    color: "#eaf1fb",
                  }}
                >
                  {selectedContact.avatar}
                </span>
                <span>
                  <b style={{ fontSize: 14 }}>{selectedContact.name}</b>
                  <small style={{ display: "block", color: "#9a9ab0", marginTop: 4 }}>
                    {selectedContact.isGroup
                      ? `群组 · ${groupTargets.length} 位成员`
                      : `${selectedContact.dept ? selectedContact.dept + " · " : ""}${selectedContact.title || ""}`}
                  </small>
                </span>
              </div>

              {selectedContact.isGroup ? (
                <>
                  <h3 style={{ fontSize: 12, margin: "0 0 10px" }}>群组成员</h3>
                  <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                    {(selectedContact.members || []).map((m) => (
                      <span key={m.id} style={{ fontSize: 11, color: "#9a9ab0" }}>
                        <span
                          className="avatar"
                          style={{ width: 20, height: 20, fontSize: 10, marginRight: 6, background: "rgba(59, 130, 246, 0.18)", color: "#93c5fd" }}
                        >
                          {m.name[0]}
                        </span>
                        {m.name}
                      </span>
                    ))}
                  </div>
                  <Popconfirm title="解散该群组？" onConfirm={() => dismissGroup(selectedContact.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />}>解散群组</Button>
                  </Popconfirm>
                </>
              ) : (
                <dl className="kv">
                  {selectedContact.phone && (
                    <>
                      <dt><PhoneOutlined style={{ marginRight: 4 }} />电话</dt>
                      <dd>{selectedContact.phone}</dd>
                    </>
                  )}
                  {selectedContact.email && (
                    <>
                      <dt><MailOutlined style={{ marginRight: 4 }} />邮箱</dt>
                      <dd>{selectedContact.email}</dd>
                    </>
                  )}
                  <dt>在岗状态</dt>
                  <dd><Tag color="green" style={{ borderRadius: 5 }}>在职</Tag></dd>
                </dl>
              )}

              <h3 style={{ fontSize: 12, margin: "22px 0 10px" }}>快捷操作</h3>
              <div style={{ display: "grid", gap: 8 }}>
                <Button size="small" block icon={<LinkOutlined />} onClick={() => { shareForm.resetFields(); setShareOpen(true); }}>
                  传输就诊记录
                </Button>
                <Button size="small" block icon={<SendOutlined />} onClick={() => { requestForm.resetFields(); setRequestOpen(true); }}>
                  请求就诊记录
                </Button>
                <Button size="small" block icon={<UserOutlined />} onClick={() => { startForm.resetFields(); setStartOpen(true); }}>
                  发起新会话
                </Button>
              </div>
            </div>
          )}
        </aside>
        )}
      </div>

      {/* 新建群组 */}
      <Modal title="新建群组" open={groupOpen} onCancel={() => setGroupOpen(false)} onOk={() => groupForm.submit()} okText="创建">
        <Form form={groupForm} layout="vertical" onFinish={createGroup}>
          <Form.Item name="name" label="群组名称" rules={[{ required: true, message: "请输入群组名称" }]}>
            <Input placeholder="例如：内科会诊协作组" />
          </Form.Item>
          <Form.Item name="member_ids" label="选择成员（可多选）" rules={[{ required: true, message: "请选择成员" }]}>
            <Select
              mode="multiple"
              showSearch
              placeholder="选择责任链内同事"
              optionFilterProp="label"
              options={peers.map((p) => ({
                value: p.id,
                label: `${p.real_name || p.username}（${p.department || p.title || p.relation}）`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 发起会话 */}
      <Modal title="发起会话" open={startOpen} onCancel={() => setStartOpen(false)} onOk={() => startForm.submit()} okText="开始">
        <Form form={startForm} layout="vertical" onFinish={startConversation}>
          <Form.Item name="peer_id" label="选择同事" rules={[{ required: true, message: "请选择同事" }]}>
            <Select
              showSearch
              placeholder="选择责任链内同事"
              optionFilterProp="label"
              options={peers.map((p) => ({
                value: p.id,
                label: `${p.real_name || p.username}（${p.department || p.title || p.relation}）`,
              }))}
            />
          </Form.Item>
          <div style={{ fontSize: 11, color: "#8290a4" }}>
            提示：若列表中无目标同事，可前往「员工协同 · 附近互传」调整责任链关系。
          </div>
        </Form>
      </Modal>

      {/* 插入链接 */}
      <Modal title="插入链接" open={linkOpen} onCancel={() => setLinkOpen(false)} onOk={() => linkForm.submit()} okText="插入">
        <Form form={linkForm} layout="vertical" onFinish={insertLink}>
          <Form.Item name="text" label="链接文字"><Input placeholder="例如：病历书写规范" /></Form.Item>
          <Form.Item name="url" label="链接地址" rules={[{ required: true, message: "请输入链接地址" }]}>
            <Input placeholder="https://..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 共享 / 传输就诊记录 */}
      <Modal
        title={`共享就诊记录${selectedContact ? " 给 " + selectedContact.name : ""}`}
        open={shareOpen}
        onCancel={() => setShareOpen(false)}
        onOk={() => shareForm.submit()}
        okText="共享"
      >
        <Form form={shareForm} layout="vertical" onFinish={submitShare}>
          <Form.Item name="record_id" label="选择就诊记录" rules={[{ required: true, message: "请选择就诊记录" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={records.length ? "选择本人负责的就诊记录" : "暂无本人负责的就诊记录"}
              options={records.map((r) => ({
                value: r.id,
                label: `#${r.id} 患者#${r.patient_id} ${r.diagnosis || r.symptoms || ""}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="note" label="备注"><Input placeholder="可选" /></Form.Item>
        </Form>
      </Modal>

      {/* 请求就诊记录 */}
      <Modal
        title={`请求就诊记录${selectedContact ? " 来自 " + selectedContact.name : ""}`}
        open={requestOpen}
        onCancel={() => setRequestOpen(false)}
        onOk={() => requestForm.submit()}
        okText="发送请求"
      >
        <Form form={requestForm} layout="vertical" onFinish={submitRequest}>
          <Form.Item name="request" label="请求说明" rules={[{ required: true, message: "请输入请求说明" }]}>
            <VoiceTextArea rows={3} placeholder="例如：请提供患者赵知行近两周的血压随访记录" />
          </Form.Item>
          <Form.Item name="note" label="备注"><Input placeholder="可选" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
