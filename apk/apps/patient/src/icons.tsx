/**
 * 纯 View 绘制图标集 —— 单一绘制语言（细描边 + 圆角），替代 emoji 字符。
 * 全部图标按 20×20 视口绘制，color 单参数控制前景色。
 */
import React from "react";
import { View } from "react-native";

type P = { color: string; size?: number };

function Box({ children, size = 20 }: { children: React.ReactNode; size?: number }) {
  return <View style={{ width: size, height: size }}>{children}</View>;
}

/** 日历 */
export function CalIcon({ color, size = 20 }: P) {
  return (
    <Box size={size}>
      <View style={{ width: 18, height: 17, borderRadius: 4, borderWidth: 1.6, borderColor: color, marginTop: 3, alignSelf: "center" }} />
      <View style={{ position: "absolute", top: 0, left: "22%", width: 2, height: 5, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 0, right: "22%", width: 2, height: 5, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 8.5, left: "18%", width: 11, height: 1.8, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 12.5, left: "18%", width: 7, height: 1.8, borderRadius: 1, backgroundColor: color }} />
    </Box>
  );
}

/** 文档 */
export function DocIcon({ color, size = 20 }: P) {
  return (
    <Box size={size}>
      <View style={{ width: 15, height: 19, borderRadius: 3, borderWidth: 1.6, borderColor: color, marginLeft: 2.5 }} />
      <View style={{ position: "absolute", top: 5, left: 6, width: 8, height: 1.8, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 9, left: 6, width: 8, height: 1.8, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 13, left: 6, width: 5, height: 1.8, borderRadius: 1, backgroundColor: color }} />
    </Box>
  );
}

/** 时钟 */
export function ClockIcon({ color, size = 20 }: P) {
  return (
    <Box size={size}>
      <View style={{ width: 19, height: 19, borderRadius: 9.5, borderWidth: 1.6, borderColor: color, marginTop: 0.5 }}>
        <View style={{ position: "absolute", top: 4, left: 8.3, width: 1.8, height: 6, borderRadius: 1, backgroundColor: color }} />
        <View style={{ position: "absolute", top: 8.5, left: 8.3, width: 5, height: 1.8, borderRadius: 1, backgroundColor: color }} />
      </View>
    </Box>
  );
}

/** 单人 */
export function PersonIcon({ color, size = 20 }: P) {
  return (
    <Box size={size}>
      <View style={{ width: 7.5, height: 7.5, borderRadius: 4, backgroundColor: color, marginTop: 1.5, alignSelf: "center" }} />
      <View style={{ width: 15, height: 8, borderTopLeftRadius: 7.5, borderTopRightRadius: 7.5, backgroundColor: color, marginTop: 1.5, alignSelf: "center" }} />
    </Box>
  );
}

/** 双人（就诊人管理） */
export function PeopleIcon({ color, size = 20 }: P) {
  return (
    <Box size={size}>
      <View style={{ position: "absolute", top: 2, left: 2, width: 6.5, height: 6.5, borderRadius: 3.25, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 9.5, left: 0.5, width: 10, height: 5.5, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: color, opacity: 0.55 }} />
      <View style={{ position: "absolute", top: 2, right: 2, width: 6.5, height: 6.5, borderRadius: 3.25, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 9.5, right: 0.5, width: 10, height: 5.5, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: color, opacity: 0.55 }} />
    </Box>
  );
}

/** 锁（账号与密码） */
export function LockIcon({ color, size = 20 }: P) {
  return (
    <Box size={size}>
      <View style={{ width: 10, height: 8, borderTopLeftRadius: 5, borderTopRightRadius: 5, borderWidth: 1.6, borderColor: color, borderBottomWidth: 0, marginLeft: 5, marginTop: 1 }} />
      <View style={{ width: 15, height: 11, borderRadius: 3, backgroundColor: color, marginLeft: 2.5, marginTop: -0.5 }}>
        <View style={{ position: "absolute", top: 4, left: 6.6, width: 1.8, height: 4.5, borderRadius: 1, backgroundColor: "#fff" }} />
      </View>
    </Box>
  );
}

/** 证件卡 */
export function CardIcon({ color, size = 20 }: P) {
  return (
    <Box size={size}>
      <View style={{ width: 19, height: 14.5, borderRadius: 3, borderWidth: 1.6, borderColor: color, marginTop: 3 }} />
      <View style={{ position: "absolute", top: 6, left: 3.5, width: 5, height: 4, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 6.5, left: 10.5, width: 5, height: 1.6, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 9.5, left: 10.5, width: 4, height: 1.6, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 12.5, left: 3.5, width: 12, height: 1.6, borderRadius: 1, backgroundColor: color }} />
    </Box>
  );
}

/** 文件夹 */
export function FolderIcon({ color, size = 20 }: P) {
  return (
    <Box size={size}>
      <View style={{ width: 9, height: 3.5, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: color, marginLeft: 2 }} />
      <View style={{ width: 19, height: 14.5, borderRadius: 3, borderWidth: 1.6, borderColor: color }} />
    </Box>
  );
}

/** 烧瓶（化验） */
export function FlaskIcon({ color, size = 20 }: P) {
  return (
    <Box size={size}>
      <View style={{ position: "absolute", top: 1, left: 6.5, width: 7, height: 2.2, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 2.5, left: 8.2, width: 3.6, height: 5, backgroundColor: color }} />
      {/* 锥形瓶身（两层梯形近似） */}
      <View style={{ position: "absolute", top: 7, left: 6, width: 8, height: 5.5, borderLeftWidth: 1.6, borderRightWidth: 1.6, borderBottomWidth: 1.6, borderColor: color, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderTopWidth: 0 }} />
      <View style={{ position: "absolute", top: 12, left: 3, width: 14, height: 6, borderLeftWidth: 1.6, borderRightWidth: 1.6, borderBottomWidth: 1.6, borderColor: color, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }} />
      <View style={{ position: "absolute", bottom: 3, left: 6, width: 8, height: 3, borderRadius: 1.5, backgroundColor: color, opacity: 0.4 }} />
    </Box>
  );
}

/** 铃铛 */
export function BellIcon({ color, size = 20 }: P) {
  return (
    <Box size={size}>
      <View style={{ width: 14, height: 13, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: color, marginTop: 2, alignSelf: "center" }} />
      <View style={{ position: "absolute", bottom: 2.5, width: 4.5, height: 2.2, borderRadius: 1.1, backgroundColor: color, alignSelf: "center" }} />
    </Box>
  );
}
