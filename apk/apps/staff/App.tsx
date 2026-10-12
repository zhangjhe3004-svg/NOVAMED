import React from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@medicode/shared";
import { StaffAuthProvider, useStaffAuth } from "./src/auth";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import PatientsScreen from "./src/screens/PatientsScreen";
import PatientDetailScreen from "./src/screens/PatientDetailScreen";
import RecordsScreen from "./src/screens/RecordsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  工作台: "⌂",
  患者: "◉",
  记录: "▤",
  我的: "☰",
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontSize: 16,
        fontWeight: "700",
        color: focused ? colors.primary : colors.textMuted,
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
        headerShown: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { borderTopColor: colors.border },
      }}
    >
      <Tab.Screen
        name="工作台"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="工作台" focused={focused} /> }}
      />
      <Tab.Screen
        name="患者"
        component={PatientsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="患者" focused={focused} /> }}
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
            options={{ headerShown: true, title: "患者详情" }}
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
