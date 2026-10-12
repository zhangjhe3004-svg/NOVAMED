/**
 * 模块建设中占位页
 * 用于原型中已规划、但真实系统尚未实现的功能模块入口，避免侧边栏出现死链。
 * 该页面在 MainLayout 的 <Outlet /> 内渲染，无需自行包裹布局。
 */
import { useParams, useSearchParams } from "react-router-dom";

const LABELS: Record<string, string> = {
  pharmacy: "药房管理",
  labTest: "检查检验",
  billing: "财务收费",
  analytics: "运营数据",
  inpatient: "住院管理",
  patientMobile: "患者移动端",
  displayDensity: "切换显示密度",
  loginPortal: "员工 / 患者登录",
  patientPreview: "患者端完整预览",
  uiDesign: "功能页 UI 设计",
};

export default function ComingSoon() {
  const { key } = useParams();
  const [search] = useSearchParams();
  const name = LABELS[key || ""] || search.get("name") || "该模块";
  return (
    <div
      style={{
        maxWidth: 560,
        margin: "80px auto",
        textAlign: "center",
        background: "#fff",
        border: "1px solid #e6ecf3",
        borderRadius: 14,
        padding: "48px 32px",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          margin: "0 auto 18px",
          borderRadius: 14,
          background: "#eaf1ff",
          color: "#2563eb",
          display: "grid",
          placeItems: "center",
          fontSize: 26,
        }}
      >
        ⚙
      </div>
      <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#1b2b45" }}>
        {name} · 建设中
      </h2>
      <p style={{ margin: 0, color: "#78869b", fontSize: 13, lineHeight: 1.7 }}>
        该模块已在原型设计中规划，正在对接真实业务与后端接口，
        暂时以占位页呈现。你可以继续浏览其他已上线的功能。
      </p>
    </div>
  );
}
