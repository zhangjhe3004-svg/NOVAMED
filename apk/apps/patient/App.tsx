import React from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { colors, DockTabBar } from "@medicode/shared";
import { PatientAuthProvider, usePatientAuth } from "./src/auth";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import AppointmentsScreen from "./src/screens/AppointmentsScreen";
import RecordsScreen from "./src/screens/RecordsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import LabReportsScreen from "./src/screens/LabReportsScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

type IconId = "home" | "calendar" | "list" | "person";

/** 纯 View 绘制的线性页签图标（贴近 SF Symbols 观感，不引入额外字体依赖） */
function TabIcon({ id, focused }: { id: IconId; focused: boolean }) {
  const c = focused ? colors.teal : colors.textSecondary;
  const wrap = { width: 24, height: 24, alignItems: "center" as const, justifyContent: "center" as const };

  if (id === "home") {
    return (
      <View style={wrap}>
        <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: c, transform: [{ rotate: "45deg" }], marginTop: -1 }} />
        <View style={{ width: 12, height: 8, borderBottomLeftRadius: 2.5, borderBottomRightRadius: 2.5, backgroundColor: c, marginTop: -4 }} />
      </View>
    );
  }
  if (id === "calendar") {
    return (
      <View style={wrap}>
        <View style={{ width: 14, height: 13, borderRadius: 3, borderWidth: 2, borderColor: c, overflow: "hidden" }}>
          <View style={{ height: 4, backgroundColor: c }} />
        </View>
      </View>
    );
  }
  if (id === "list") {
    return (
      <View style={wrap}>
        {[13, 13, 9].map((w, i) => (
          <View key={i} style={{ width: w, height: 2, borderRadius: 1, backgroundColor: c, marginTop: i ? 3.5 : 0 }} />
        ))}
      </View>
    );
  }
  return (
    <View style={wrap}>
      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c }} />
      <View style={{ width: 13, height: 6, borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: c, marginTop: 1.5 }} />
    </View>
  );
}

/** Dock 右侧圆形按钮的「报告」图标：文档 + 行（纯 View） */
function ReportGlyph() {
  const c = colors.brandTeal;
  return (
    <View style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 13, height: 16, borderRadius: 3, borderWidth: 2, borderColor: c }} />
      <View style={{ position: "absolute", width: 7, height: 2, borderRadius: 1, backgroundColor: c, top: 6 }} />
      <View style={{ position: "absolute", width: 7, height: 2, borderRadius: 1, backgroundColor: c, top: 10 }} />
    </View>
  );
}

const TAB_ICONS: Record<string, IconId> = {
  首页: "home",
  预约: "calendar",
  记录: "list",
  我的: "person",
};

const TAB_SCREENS = {
  首页: HomeScreen,
  预约: AppointmentsScreen,
  记录: RecordsScreen,
  我的: ProfileScreen,
} as const;

function MainTabs() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Tab.Navigator
        tabBar={(props) => (
          <DockTabBar
            {...props}
            accent={colors.brandTeal}
            activeBg="rgba(39,133,125,0.10)"
            extra={{
              label: "检查报告",
              glyph: <ReportGlyph />,
              onPress: () => props.navigation.navigate("报告"),
            }}
          />
        )}
        screenOptions={{ headerShown: false }}
      >
        {(["首页", "预约", "记录", "我的"] as const).map((name) => (
          <Tab.Screen
            key={name}
            name={name}
            component={TAB_SCREENS[name]}
            options={{
              tabBarLabel: name,
              tabBarIcon: ({ focused }) => <TabIcon id={TAB_ICONS[name]} focused={focused} />,
            }}
          />
        ))}
      </Tab.Navigator>
    </SafeAreaView>
  );
}

function RootNavigator() {
  const { signedIn, loading } = usePatientAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {signedIn ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="报告" component={LabReportsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="消息" component={NotificationsScreen} options={{ headerShown: false }} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PatientAuthProvider>
        <NavigationContainer>
          <RootNavigator />
          <StatusBar style="dark" />
        </NavigationContainer>
      </PatientAuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
