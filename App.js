import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './src/services/firebase';
import * as Notifications from 'expo-notifications';
import { 
  registerForPushNotifications, 
  syncAllNotifications,
  showTestNotification 
} from './src/services/notificationService';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import MachinesScreen from './src/screens/MachinesScreen';
import RentalsScreen from './src/screens/RentalsScreen';
import IncomeScreen from './src/screens/IncomeScreen';
import PendingScreen from './src/screens/PendingScreen';
import PartnersScreen from './src/screens/PartnersScreen';
import ScheduledScreen from './src/screens/ScheduledScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SubscriptionExpiredScreen from './src/screens/SubscriptionExpiredScreen';


const Stack = createStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Machines" component={MachinesScreen} />
      <Stack.Screen name="Rentals" component={RentalsScreen} />
      <Stack.Screen name="Income" component={IncomeScreen} />
      <Stack.Screen name="Pending" component={PendingScreen} />
      <Stack.Screen name="Partners" component={PartnersScreen} />
      <Stack.Screen name="Scheduled" component={ScheduledScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      
    </Stack.Navigator>
  );
}

function ExpiredStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SubscriptionExpired" component={SubscriptionExpiredScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Verificar estado de suscripción
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const subscription = userData.subscription;
            
            if (subscription) {
              const now = new Date();
              const trialEndDate = new Date(subscription.trialEndDate);
              const daysRemaining = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));
              
              // Verificar si la suscripción expiró
              if (subscription.status === 'trial' && daysRemaining <= 0 && !subscription.isPaid) {
                setSubscriptionExpired(true);
              } else if (subscription.status === 'expired') {
                setSubscriptionExpired(true);
              } else {
                setSubscriptionExpired(false);
                
                // Solo configurar notificaciones si la suscripción está activa
                try {
                  await registerForPushNotifications();
                  await showTestNotification();
                  await syncAllNotifications();
                } catch (error) {
                  console.log('Notificaciones no disponibles:', error);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error verificando suscripción:', error);
        }
      }
      
      setLoading(false);
    });

    // Listener para notificaciones
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notificación recibida:', notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Usuario tocó la notificación:', response);
    });

    return () => {
      unsubscribe();
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack />
      ) : subscriptionExpired ? (
        <ExpiredStack />
      ) : (
        <AppStack />
      )}
    </NavigationContainer>
  );
}