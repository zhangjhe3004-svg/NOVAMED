import React from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { colors, DockTabBar } from "@medicode/shared";
import { StaffAuthProvider, useStaffAuth } from "./src/auth";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import PatientsScreen from "./src/screens/PatientsScreen";
import PatientDetailScreen from "./src/screens/PatientDetailScreen";
import RecordsScreen from "./src/screens/RecordsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

type IconId = "grid" | "people" | "list" | "person";

/** 纯 View 绘制的线性页签图标（贴近 SF Symbols 观感，不引入额外字体依赖） */
function TabIcon({ id, focused }: { id: IconId; focused: boolean }) {
  const c = focused ? colors.primary : colors.textMuted;
  const wrap = { width: 24, height: 24, alignItems: "center" as const, justifyContent: "center" as const };

  if (id === "grid") {
    return (
      <View style={wrap}>
        <View style={{ flexDirection: "row", gap: 3.5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: c }} />
          <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: c }} />
        </View>
        <View style={{ flexDirection: "row", gap: 3.5, marginTop: 3.5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: c }} />
          <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: c }} />
        </View>
      </View>
    );
  }
  if (id === "people") {
    return (
      <View style={wrap}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 1 }}>
          <View style={{ alignItems: "center" }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
            <View style={{ width: 11, height: 5, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: c, marginTop: 1.5 }} />
          </View>
          <View style={{ alignItems: "center", opacity: 0.55 }}>
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: c }} />
            <View style={{ width: 9, height: 4, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: c, marginTop: 1.5 }} />
          </View>
        </View>
      </View>
    );
  }
  if (id === "list") {
    return (
      <View style={wrap}>
        {[13, 13, 9].map((w, i) => (
          <View
            key={i}
            style={{ width: w, height: 2, borderRadius: 1, backgroundColor: c, marginTop: i ? 3.5 : 0 }}
          />
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

/** Dock 右侧圆形按钮的「搜索」图标：放大镜（纯 View） */
function SearchGlyph() {
  const c = colors.primary;
  return (
    <View style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: c, marginTop: -3, marginLeft: -3 }} />
      <View style={{ position: "absolute", right: 3, bottom: 2, width: 6, height: 2, borderRadius: 1, backgroundColor: c, transform: [{ rotate: "45deg" }] }} />
    </View>
  );
}

function MainTabs() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Tab.Navigator
        tabBar={(props) => (
          <DockTabBar
            {...props}
            accent={colors.primary}
            activeBg="rgba(37,99,235,0.10)"
            extra={{
              label: "搜索患者",
              glyph: <SearchGlyph />,
              onPress: () => props.navigation.navigate("患者"),
            }}
          />
        )}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen
          name="工作台"
          component={HomeScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon id="grid" focused={focused} /> }}
        />
        <Tab.Screen
          name="患者"
          component={PatientsScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon id="people" focused={focused} /> }}
        />
        <Tab.Screen
          name="记录"
          component={RecordsScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon id="list" focused={focused} /> }}
        />
        <Tab.Screen
          name="我的"
          component={ProfileScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon id="person" focused={focused} /> }}
        />
      </Tab.Navigator>
    </SafeAreaView>
  );
}

function RootNavigator() {
  const { signedIn, loading } = useStaffAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {signedIn ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="PatientDetail"
            component={PatientDetailScreen}
            options={{ headerShown: false }}
          />
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
      <StaffAuthProvider>
        <NavigationContainer>
          <RootNavigator />
          <StatusBar style="dark" />
        </NavigationContainer>
      </StaffAuthProvider>
    </SafeAreaProvider>
  );
}
