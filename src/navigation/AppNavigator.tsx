import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SymbolView } from 'expo-symbols';
import { AppColors } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import type { MainTabParamList, RootStackParamList } from '../types';

import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import MapScreen from '../screens/MapScreen';
import NewReportScreen from '../screens/NewReportScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ReportDetailScreen from '../screens/ReportDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: AppColors.primary,
        tabBarInactiveTintColor: AppColors.secondary,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          height: 76 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          lineHeight: 16,
          flexShrink: 0,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Início"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} size={24} tintColor={color}
              accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          ),
        }}
      />
      <Tab.Screen
        name="Mapa"
        component={MapScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'map.fill', android: 'map', web: 'map' }} size={24} tintColor={color}
              accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          ),
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} size={24} tintColor={color}
              accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { currentUser } = useApp();
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#f8f5f0' },
        }}
      >
        {currentUser ? (
          <Stack.Group navigationKey="signed-in">
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="NewReport" component={NewReportScreen} />
            <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
          </Stack.Group>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
