import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getRentals, getScheduled } from './firestoreService';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

// Configurar cómo se muestran las notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Solicitar permisos de notificaciones
export async function registerForPushNotifications() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8B5CF6',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Permisos de notificaciones denegados');
      return null;
    }
  } else {
    console.log('Debe usar un dispositivo físico para notificaciones push');
  }

  return token;
}

// Cancelar todas las notificaciones programadas
export async function cancelAllScheduledNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🗑️ Notificaciones anteriores canceladas');
  } catch (error) {
    console.log('Error cancelando notificaciones:', error);
  }
}

// Cancelar notificaciones de un alquiler específico
export async function cancelRentalNotifications(rentalId) {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    for (const notification of scheduledNotifications) {
      if (notification.content.data?.rentalId === rentalId) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
    console.log('🗑️ Notificaciones del alquiler canceladas');
  } catch (error) {
    console.log('Error cancelando notificaciones de alquiler:', error);
  }
}

// Cancelar notificaciones de un agendado específico
export async function cancelScheduledNotifications(scheduledId) {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    for (const notification of scheduledNotifications) {
      if (notification.content.data?.scheduledId === scheduledId) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
    console.log('🗑️ Notificaciones del agendado canceladas');
  } catch (error) {
    console.log('Error cancelando notificaciones de agendado:', error);
  }
}

// Programar notificación para alquiler (1 hora antes)
export async function scheduleRentalNotification(rental, machineNumber) {
  try {
    const endDate = new Date(rental.endDate);
    const oneHourBefore = new Date(endDate.getTime() - 60 * 60 * 1000); // 1 hora antes
    const now = new Date();

    // Solo programar si falta más de 1 minuto
    if (oneHourBefore > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Alquiler próximo a vencer',
          body: `La lavadora #${machineNumber} en ${rental.addressType} ${rental.address} vence en 1 hora`,
          data: { rentalId: rental.id, type: 'rental_expiring' },
          sound: true,
        },
        trigger: {
          type: 'date',
          date: oneHourBefore,
          channelId: 'default',
        },
      });
      console.log('✅ Notificación programada para:', oneHourBefore.toLocaleString('es-CO'));
    } else {
      console.log('⚠️ No se programó (ya pasó el tiempo de 1 hora antes)');
    }

    // Notificación cuando YA venció
    if (endDate > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚨 ¡Alquiler VENCIDO!',
          body: `La lavadora #${machineNumber} en ${rental.addressType} ${rental.address} ya venció. ¡Recógela ahora!`,
          data: { rentalId: rental.id, type: 'rental_expired' },
          sound: true,
        },
        trigger: {
          type: 'date',
          date: endDate,
          channelId: 'default',
        },
      });
      console.log('✅ Notificación de vencimiento para:', endDate.toLocaleString('es-CO'));
    } else {
      console.log('⚠️ No se programó notificación de vencimiento (alquiler ya vencido)');
    }
  } catch (error) {
    console.log('❌ Error programando notificación de alquiler:', error.message);
  }
}

// Programar notificación para agendado (40 minutos antes)
export async function scheduleScheduledNotification(scheduled) {
  try {
    const scheduledDate = new Date(scheduled.scheduledDate);
    const fortyMinBefore = new Date(scheduledDate.getTime() - 40 * 60 * 1000); // 40 minutos antes
    const now = new Date();

    // Solo programar si falta más de 1 minuto
    if (fortyMinBefore > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📅 Alquiler agendado próximo',
          body: `Debes entregar la lavadora en ${scheduled.address} en 40 minutos`,
          data: { scheduledId: scheduled.id, type: 'scheduled_reminder' },
          sound: true,
        },
        trigger: {
          type: 'date',
          date: fortyMinBefore,
          channelId: 'default',
        },
      });
      console.log('✅ Notificación de agendado para:', fortyMinBefore.toLocaleString('es-CO'));
    } else {
      console.log('⚠️ No se programó (ya pasó el tiempo de 40 min antes)');
    }
  } catch (error) {
    console.log('❌ Error programando notificación de agendado:', error.message);
  }
}

// Programar notificaciones de suscripción
export async function scheduleSubscriptionNotifications() {
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    const userData = userDoc.data();
    
    if (!userData?.subscription?.trialEndDate) {
      console.log('⚠️ No hay fecha de vencimiento de suscripción');
      return;
    }

    const trialEndDate = new Date(userData.subscription.trialEndDate);
    const now = new Date();

    // Notificación 3 días antes
    const threeDaysBefore = new Date(trialEndDate.getTime() - 3 * 24 * 60 * 60 * 1000);
    if (threeDaysBefore > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Tu suscripción vence pronto',
          body: 'Tu período de prueba gratuito termina en 3 días. Renueva para seguir usando LaundryManager.',
          data: { type: 'subscription_warning_3days' },
          sound: true,
        },
        trigger: {
          type: 'date',
          date: threeDaysBefore,
          channelId: 'default',
        },
      });
      console.log('✅ Notificación de suscripción (3 días) para:', threeDaysBefore.toLocaleString('es-CO'));
    }

    // Notificación 1 día antes
    const oneDayBefore = new Date(trialEndDate.getTime() - 24 * 60 * 60 * 1000);
    if (oneDayBefore > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚨 ¡Suscripción vence mañana!',
          body: 'Tu período de prueba termina mañana. Renueva hoy para no perder acceso.',
          data: { type: 'subscription_warning_1day' },
          sound: true,
        },
        trigger: {
          type: 'date',
          date: oneDayBefore,
          channelId: 'default',
        },
      });
      console.log('✅ Notificación de suscripción (1 día) para:', oneDayBefore.toLocaleString('es-CO'));
    }
  } catch (error) {
    console.log('❌ Error programando notificaciones de suscripción:', error.message);
  }
}

// Sincronizar todas las notificaciones (llamar al iniciar la app)
export async function syncAllNotifications() {
  try {
    console.log('🔄 Sincronizando notificaciones...');
    
    // Cancelar todas las notificaciones anteriores
    await cancelAllScheduledNotifications();

    // Obtener alquileres activos
    const rentals = await getRentals();
    console.log(`📦 Procesando ${rentals.length} alquileres...`);
    
    // Programar notificaciones para cada alquiler activo
    for (const rental of rentals) {
      const machineNumber = rental.machineNumber || 'Sin número';
      await scheduleRentalNotification(rental, machineNumber);
    }

    // Obtener agendados
    const scheduledList = await getScheduled();
    console.log(`📅 Procesando ${scheduledList.length} agendados...`);
    
    // Programar notificaciones para cada agendado
    for (const scheduled of scheduledList) {
      await scheduleScheduledNotification(scheduled);
    }

    // Programar notificaciones de suscripción
    await scheduleSubscriptionNotifications();

    // Verificar cuántas se programaron
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`✅ Total de notificaciones programadas: ${allScheduled.length}`);
  } catch (error) {
    console.log('❌ Error sincronizando notificaciones:', error.message);
  }
}

// Mostrar notificación inmediata (para pruebas)
export async function showTestNotification() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✅ Notificaciones activadas',
        body: 'Limpio te enviará alertas cuando tus alquileres estén por vencer.',
        data: { type: 'test' },
        sound: true,
      },
      trigger: null, // null = mostrar inmediatamente
    });
    console.log('✅ Notificación de prueba enviada');
  } catch (error) {
    console.log('❌ Error mostrando notificación de prueba:', error.message);
  }
}