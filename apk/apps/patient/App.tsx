import React from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@medicode/shared";
import { PatientAuthProvider, usePatientAuth } from "./src/auth";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import AppointmentsScreen from "./src/screens/AppointmentsScreen";
import RecordsScreen from "./src/screens/RecordsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  首页: "🏠",
  预约: "📅",
  记录: "📄",
  我的: "👤",
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontSize: 17,
        fontWeight: "700",
        color: focused ? colors.teal : colors.textMuted,
      }}
    >
      {TAB_ICONS[label] || "•"}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false, // 各页面自带品牌顶栏（对照设计稿）
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: "#ffffff" },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="首页"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="首页" focused={focused} /> }}
      />
      <Tab.Screen
        name="预约"
        component={AppointmentsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="预约" focused={focused} /> }}
      />
      <Tab.Screen
        name="记录"
        component={RecordsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="记录" focused={focused} /> }}
      />
      <Tab.Screen
        name="我的"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="我的" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { signedIn, loading } = usePatientAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {signedIn ? (
        <Stack.Screen name="Main" component={MainTabs} />
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
