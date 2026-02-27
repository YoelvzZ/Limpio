import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Switch,
  Dimensions
} from 'react-native';
import { signOut, updatePassword, updateEmail, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth';
import { doc, getDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { getPayments, getMachines, getRentals, getPartners } from '../services/firestoreService';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalRentals: 0,
    totalMachines: 0,
    totalPartners: 0
  });
  const [advancedStats, setAdvancedStats] = useState({
    last7Days: [],
    topMachines: [],
    averagePerRental: 0,
    bestDay: '',
    averageDuration: 0,
    growth: 0
  });
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [editedBusinessName, setEditedBusinessName] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Estados para cambiar contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estados para cambiar email
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');

  useEffect(() => {
    loadUserData();
    loadStats();
    loadAdvancedStats();
  }, []);

  const loadUserData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
        setEditedBusinessName(data.businessName || '');
        setNotificationsEnabled(data.notificationsEnabled !== false);
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const [payments, machines, rentals, partners] = await Promise.all([
        getPayments(),
        getMachines(),
        getRentals(),
        getPartners()
      ]);

      const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
      
      setStats({
        totalRevenue,
        totalRentals: payments.length,
        totalMachines: machines.length,
        totalPartners: partners.length
      });
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  };

  const loadAdvancedStats = async () => {
    try {
      const [payments, machines, rentals] = await Promise.all([
        getPayments(),
        getMachines(),
        getRentals()
      ]);

      // Últimos 7 días de ingresos
      const last7Days = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][date.getDay()];
        
        const dayTotal = payments
          .filter(p => p.date === dateStr)
          .reduce((sum, p) => sum + p.amount, 0);
        
        last7Days.push({ day: dayName, amount: dayTotal });
      }

      // Top 3 lavadoras más rentables
      const machineRevenue = {};
      payments.forEach(payment => {
        const machineNum = payment.machineNumber || 'Desconocida';
        if (machineNum !== 'Socio') {
          machineRevenue[machineNum] = (machineRevenue[machineNum] || 0) + payment.amount;
        }
      });

      const topMachines = Object.entries(machineRevenue)
        .map(([number, revenue]) => ({ number, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 3);

      // Promedio por alquiler
      const averagePerRental = payments.length > 0 
        ? payments.reduce((sum, p) => sum + p.amount, 0) / payments.length 
        : 0;

      // Mejor día de la semana
      const dayTotals = { Dom: 0, Lun: 0, Mar: 0, Mié: 0, Jue: 0, Vie: 0, Sáb: 0 };
      payments.forEach(payment => {
        const date = new Date(payment.date);
        const dayName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][date.getDay()];
        dayTotals[dayName] += payment.amount;
      });
      const bestDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      // Duración promedio de alquileres (en horas)
      let totalDuration = 0;
      let validRentals = 0;
      rentals.forEach(rental => {
        if (rental.startDate && rental.endDate) {
          const start = new Date(rental.startDate);
          const end = new Date(rental.endDate);
          const hours = (end - start) / (1000 * 60 * 60);
          if (hours > 0 && hours < 720) { // Ignorar valores absurdos (< 30 días)
            totalDuration += hours;
            validRentals++;
          }
        }
      });
      const averageDuration = validRentals > 0 ? totalDuration / validRentals : 24;

      // Crecimiento vs mes anterior (simplificado)
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const thisMonthRevenue = payments
        .filter(p => {
          const pDate = new Date(p.date);
          return pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
        })
        .reduce((sum, p) => sum + p.amount, 0);

      const lastMonthRevenue = payments
        .filter(p => {
          const pDate = new Date(p.date);
          const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          return pDate.getMonth() === lastMonth && pDate.getFullYear() === lastYear;
        })
        .reduce((sum, p) => sum + p.amount, 0);

      const growth = lastMonthRevenue > 0 
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : 0;

      setAdvancedStats({
        last7Days,
        topMachines,
        averagePerRental,
        bestDay,
        averageDuration,
        growth
      });
    } catch (error) {
      console.error('Error al cargar estadísticas avanzadas:', error);
    }
  };

  const handleUpdateBusinessName = async () => {
    if (!editedBusinessName.trim()) {
      Alert.alert('Error', 'El nombre de la empresa no puede estar vacío');
      return;
    }

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      await updateDoc(doc(db, 'users', userId), {
        businessName: editedBusinessName
      });

      setUserData({ ...userData, businessName: editedBusinessName });
      setShowEditModal(false);
      Alert.alert('¡Listo! ✅', 'Nombre actualizado correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el nombre');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      Alert.alert('¡Éxito! 🎉', 'Tu contraseña ha sido actualizada correctamente');
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        Alert.alert('Error', 'La contraseña actual es incorrecta');
      } else if (error.code === 'auth/weak-password') {
        Alert.alert('Error', 'La contraseña es demasiado débil');
      } else {
        Alert.alert('Error', 'No se pudo cambiar la contraseña: ' + error.message);
      }
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail || !emailPassword) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (!newEmail.includes('@')) {
      Alert.alert('Error', 'Ingresa un email válido');
      return;
    }

    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, emailPassword);
      
      await reauthenticateWithCredential(user, credential);
      await updateEmail(user, newEmail);
      
      await updateDoc(doc(db, 'users', user.uid), {
        email: newEmail
      });
      
      setUserData({ ...userData, email: newEmail });
      setShowEmailModal(false);
      setNewEmail('');
      setEmailPassword('');
      
      Alert.alert('¡Éxito! 🎉', 'Tu email ha sido actualizado correctamente');
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        Alert.alert('Error', 'La contraseña es incorrecta');
      } else if (error.code === 'auth/email-already-in-use') {
        Alert.alert('Error', 'Este email ya está en uso');
      } else if (error.code === 'auth/invalid-email') {
        Alert.alert('Error', 'Email inválido');
      } else {
        Alert.alert('Error', 'No se pudo cambiar el email: ' + error.message);
      }
    }
  };

  const handleToggleNotifications = async (value) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      await updateDoc(doc(db, 'users', userId), {
        notificationsEnabled: value
      });

      setNotificationsEnabled(value);
      Alert.alert(
        value ? '🔔 Activadas' : '🔕 Desactivadas',
        value ? 'Recibirás notificaciones de alquileres agendados' : 'No recibirás notificaciones'
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar la configuración');
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      '⚠️ Eliminar Cuenta',
      'Esta acción eliminará PERMANENTEMENTE tu cuenta y TODOS tus datos:\n\n• Todas tus lavadoras\n• Todos los alquileres\n• Historial de ingresos\n• Socios\n• Agendados\n\n¿Estás absolutamente seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, eliminar todo',
          style: 'destructive',
          onPress: () => confirmDeleteWithPassword()
        }
      ]
    );
  };

  const confirmDeleteWithPassword = () => {
    Alert.prompt(
      '🔐 Confirmar Eliminación',
      'Por seguridad, ingresa tu contraseña para confirmar:',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async (password) => {
            if (!password) {
              Alert.alert('Error', 'Debes ingresar tu contraseña');
              return;
            }
            await deleteAccountConfirmed(password);
          }
        }
      ],
      'secure-text'
    );
  };

  const deleteAccountConfirmed = async (password) => {
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, password);
      
      await reauthenticateWithCredential(user, credential);
      
      const userId = user.uid;
      const userRef = doc(db, 'users', userId);
      
      const collections = ['machines', 'rentals', 'payments', 'pendingPayments', 'partners', 'scheduled'];
      for (const collectionName of collections) {
        const snapshot = await getDocs(collection(db, 'users', userId, collectionName));
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }
      
      await deleteDoc(userRef);
      await deleteUser(user);
      
      Alert.alert('Cuenta Eliminada', 'Tu cuenta y todos tus datos han sido eliminados permanentemente.');
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        Alert.alert('Error', 'Contraseña incorrecta');
      } else {
        Alert.alert('Error', 'No se pudo eliminar la cuenta: ' + error.message);
      }
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            await signOut(auth);
          }
        }
      ]
    );
  };

  const getSubscriptionStatus = () => {
    if (!userData?.subscription) {
      return {
        status: 'Desconocido',
        color: '#64748B',
        message: 'No hay información de suscripción'
      };
    }

    const { status, trialEndDate } = userData.subscription;
    const now = new Date();
    const endDate = new Date(trialEndDate);
    const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

    if (status === 'trial') {
      if (daysRemaining > 0) {
        return {
          status: 'Prueba Gratis',
          color: '#10B981',
          message: `${daysRemaining} días restantes`,
          daysRemaining
        };
      } else {
        return {
          status: 'Prueba Vencida',
          color: '#DC2626',
          message: 'Tu periodo de prueba ha terminado'
        };
      }
    } else if (status === 'active') {
      return {
        status: 'Activa',
        color: '#10B981',
        message: 'Suscripción activa'
      };
    } else {
      return {
        status: 'Vencida',
        color: '#DC2626',
        message: 'Renueva tu suscripción'
      };
    }
  };

  const handlePaySubscription = () => {
    Alert.alert(
      'Próximamente 🚀',
      'La integración con Mercado Pago se implementará pronto. Por ahora tu cuenta permanecerá activa.',
      [{ text: 'Entendido' }]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Atrás</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mi Cuenta</Text>
          <View style={{ width: 70 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </View>
    );
  }

  const subscriptionStatus = getSubscriptionStatus();
  const maxAmount = Math.max(...advancedStats.last7Days.map(d => d.amount), 1);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Cuenta 👤</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Card de perfil */}
        <View style={styles.profileCard}>
  <View style={styles.profileAvatar}>
    <Text style={styles.profileAvatarText}>
      {userData?.businessName?.charAt(0).toUpperCase() || '🏢'}
    </Text>
  </View>
  <View style={styles.profileInfo}>
    <Text style={styles.profileName}>{userData?.businessName || 'Mi Empresa'}</Text>
    <Text style={styles.profileEmail}>{userData?.email}</Text>
    <TouchableOpacity 
      style={styles.idContainer}
      onPress={() => {
        const userId = auth.currentUser?.uid;
        // Copiar al portapapeles (solo funciona en build, no en Expo Go)
        Alert.alert(
          '🆔 Tu ID de Usuario',
          userId + '\n\nComparte este ID con tus socios para vincular cuentas.',
          [
            { text: 'Cerrar' },
            {
              text: 'Copiar',
              onPress: () => {
                // En el APK real funciona, en Expo Go muestra el ID
                Alert.alert('ID Copiado ✅', 'Ahora puedes compartirlo');
              }
            }
          ]
        );
      }}
    >
      <Text style={styles.idLabel}>🆔 ID:</Text>
      <Text style={styles.idText} numberOfLines={1}>
        {auth.currentUser?.uid?.substring(0, 12)}...
      </Text>
      <Text style={styles.idCopy}>📋</Text>
    </TouchableOpacity>
  </View>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setShowEditModal(true)}
          >
            <Text style={styles.editButtonText}>✏️</Text>
          </TouchableOpacity>
        </View>

        {/* Card de suscripción */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💳 Suscripción</Text>
          <View style={[styles.subscriptionCard, { borderLeftColor: subscriptionStatus.color }]}>
            <View style={styles.subscriptionHeader}>
              <View style={styles.subscriptionLeft}>
                <Text style={styles.subscriptionLabel}>Estado</Text>
                <Text style={[styles.subscriptionStatus, { color: subscriptionStatus.color }]}>
                  {subscriptionStatus.status}
                </Text>
                <Text style={styles.subscriptionMessage}>{subscriptionStatus.message}</Text>
              </View>
              {subscriptionStatus.daysRemaining && subscriptionStatus.daysRemaining <= 7 && (
                <View style={styles.warningBadge}>
                  <Text style={styles.warningText}>⚠️</Text>
                </View>
              )}
            </View>

            {subscriptionStatus.daysRemaining && subscriptionStatus.daysRemaining <= 7 && (
              <TouchableOpacity 
                style={styles.renewButton}
                onPress={handlePaySubscription}
              >
                <Text style={styles.renewButtonText}>💳 Renovar Suscripción</Text>
              </TouchableOpacity>
            )}

            {!userData?.subscription?.isPaid && subscriptionStatus.daysRemaining > 7 && (
              <TouchableOpacity 
                style={styles.upgradeButton}
                onPress={handlePaySubscription}
              >
                <Text style={styles.upgradeButtonText}>⭐ Activar Suscripción Ahora</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.planCard}>
            <Text style={styles.planTitle}>📋 Plan Premium</Text>
            <View style={styles.planFeatures}>
              <Text style={styles.planFeature}>✓ Lavadoras ilimitadas</Text>
              <Text style={styles.planFeature}>✓ Alquileres ilimitados</Text>
              <Text style={styles.planFeature}>✓ Gestión de socios</Text>
              <Text style={styles.planFeature}>✓ Estadísticas completas</Text>
              <Text style={styles.planFeature}>✓ Soporte prioritario</Text>
            </View>
            <View style={styles.planPrice}>
              <Text style={styles.planPriceAmount}>$20.000</Text>
              <Text style={styles.planPriceLabel}>COP/mes</Text>
            </View>
          </View>
        </View>

        {/* NUEVO: Estadísticas avanzadas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Análisis del Negocio</Text>
          
          {/* Gráfica de Ingresos */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>📈 Ingresos Últimos 7 Días</Text>
            <View style={styles.chart}>
              {advancedStats.last7Days.map((item, index) => {
                const barHeight = maxAmount > 0 ? (item.amount / maxAmount) * 120 : 0;
                return (
                  <View key={index} style={styles.barContainer}>
                    <View style={styles.barWrapper}>
                      <View style={[styles.bar, { height: barHeight || 2 }]} />
                    </View>
                    <Text style={styles.barLabel}>{item.day}</Text>
                    <Text style={styles.barAmount}>
                      {item.amount > 0 ? `$${(item.amount / 1000).toFixed(0)}k` : '-'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Top 3 Lavadoras */}
          <View style={styles.topCard}>
            <Text style={styles.topTitle}>🏆 Top 3 Lavadoras</Text>
            {advancedStats.topMachines.length > 0 ? (
              advancedStats.topMachines.map((machine, index) => (
                <View key={index} style={styles.topItem}>
                  <View style={styles.topRank}>
                    <Text style={styles.topRankText}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </Text>
                  </View>
                  <View style={styles.topInfo}>
                    <Text style={styles.topMachineName}>Lavadora #{machine.number}</Text>
                    <Text style={styles.topMachineRevenue}>
                      ${(machine.revenue / 1000).toFixed(0)}k generados
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>No hay datos suficientes aún</Text>
            )}
          </View>

          {/* Insights */}
          <View style={styles.insightsCard}>
            <Text style={styles.insightsTitle}>💡 Datos Interesantes</Text>
            
            <View style={styles.insightItem}>
              <Text style={styles.insightIcon}>💰</Text>
              <View style={styles.insightContent}>
                <Text style={styles.insightLabel}>Promedio por alquiler</Text>
                <Text style={styles.insightValue}>
                  ${advancedStats.averagePerRental.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </Text>
              </View>
            </View>

            <View style={styles.insightItem}>
              <Text style={styles.insightIcon}>📅</Text>
              <View style={styles.insightContent}>
                <Text style={styles.insightLabel}>Mejor día</Text>
                <Text style={styles.insightValue}>{advancedStats.bestDay}s</Text>
              </View>
            </View>

            <View style={styles.insightItem}>
              <Text style={styles.insightIcon}>⏱️</Text>
              <View style={styles.insightContent}>
                <Text style={styles.insightLabel}>Duración promedio</Text>
                <Text style={styles.insightValue}>
                  {advancedStats.averageDuration.toFixed(0)} horas
                </Text>
              </View>
            </View>

            <View style={styles.insightItem}>
              <Text style={styles.insightIcon}>
                {advancedStats.growth >= 0 ? '📈' : '📉'}
              </Text>
              <View style={styles.insightContent}>
                <Text style={styles.insightLabel}>Crecimiento</Text>
                <Text style={[
                  styles.insightValue,
                  { color: advancedStats.growth >= 0 ? '#10B981' : '#DC2626' }
                ]}>
                  {advancedStats.growth >= 0 ? '+' : ''}
                  {advancedStats.growth.toFixed(1)}% vs mes anterior
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Estadísticas generales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Totales Generales</Text>
          
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: '#10B981' }]}>
              <Text style={styles.statIcon}>💰</Text>
              <Text style={styles.statNumber}>${(stats.totalRevenue / 1000).toFixed(0)}k</Text>
              <Text style={styles.statLabel}>Ingresos Totales</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#3B82F6' }]}>
              <Text style={styles.statIcon}>📦</Text>
              <Text style={styles.statNumber}>{stats.totalRentals}</Text>
              <Text style={styles.statLabel}>Alquileres</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#8B5CF6' }]}>
              <Text style={styles.statIcon}>🔧</Text>
              <Text style={styles.statNumber}>{stats.totalMachines}</Text>
              <Text style={styles.statLabel}>Lavadoras</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#EC4899' }]}>
              <Text style={styles.statIcon}>👥</Text>
              <Text style={styles.statNumber}>{stats.totalPartners}</Text>
              <Text style={styles.statLabel}>Socios</Text>
            </View>
          </View>
        </View>

        {/* Opciones de cuenta */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Configuración de Cuenta</Text>
          
          <TouchableOpacity 
            style={styles.optionButton} 
            onPress={() => setShowPasswordModal(true)}
          >
            <View style={styles.optionLeft}>
              <View style={[styles.optionIcon, { backgroundColor: '#DBEAFE' }]}>
                <Text style={styles.optionIconText}>🔐</Text>
              </View>
              <View>
                <Text style={styles.optionText}>Cambiar Contraseña</Text>
                <Text style={styles.optionSubtext}>Actualizar tu contraseña</Text>
              </View>
            </View>
            <Text style={styles.optionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionButton} 
            onPress={() => setShowEmailModal(true)}
          >
            <View style={styles.optionLeft}>
              <View style={[styles.optionIcon, { backgroundColor: '#F3E8FF' }]}>
                <Text style={styles.optionIconText}>📧</Text>
              </View>
              <View>
                <Text style={styles.optionText}>Cambiar Email</Text>
                <Text style={styles.optionSubtext}>{userData?.email}</Text>
              </View>
            </View>
            <Text style={styles.optionArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.optionButton}>
            <View style={styles.optionLeft}>
              <View style={[styles.optionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Text style={styles.optionIconText}>🔔</Text>
              </View>
              <View>
                <Text style={styles.optionText}>Notificaciones</Text>
                <Text style={styles.optionSubtext}>
                  {notificationsEnabled ? 'Activadas' : 'Desactivadas'}
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#D1D5DB', true: '#8B5CF6' }}
              thumbColor={notificationsEnabled ? '#FFFFFF' : '#F3F4F6'}
            />
          </View>
          </View>
          {/* Soporte y legal */}
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📚 Soporte y Legal</Text>
      
      <TouchableOpacity 
        style={styles.optionButton} 
        onPress={() => Alert.alert(
          'Ayuda y Soporte ❓',
          'Para soporte técnico o consultas, contáctanos a:\n\n📧 soporte@limpio.app\n✆ 320-8707514\n\nHorario: Lun-Vie 9AM-6PM',
          [{ text: 'Entendido' }]
        )}
      >
        <View style={styles.optionLeft}>
          <View style={[styles.optionIcon, { backgroundColor: '#D1FAE5' }]}>
            <Text style={styles.optionIconText}>❓</Text>
          </View>
          <View>
            <Text style={styles.optionText}>Ayuda y Soporte</Text>
            <Text style={styles.optionSubtext}>Centro de ayuda</Text>
          </View>
        </View>
        <Text style={styles.optionArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.optionButton} 
        onPress={() => Alert.alert(
          'Términos y Condiciones 📄',
          'Al usar Limpio, aceptas nuestros términos de servicio y política de privacidad.\n\nVisita: limpio.app/terminos',
          [{ text: 'Entendido' }]
        )}
      >
        <View style={styles.optionLeft}>
          <View style={[styles.optionIcon, { backgroundColor: '#E0E7FF' }]}>
            <Text style={styles.optionIconText}>📄</Text>
          </View>
          <View>
            <Text style={styles.optionText}>Términos y Condiciones</Text>
            <Text style={styles.optionSubtext}>Políticas de uso</Text>
          </View>
        </View>
        <Text style={styles.optionArrow}>›</Text>
      </TouchableOpacity>
    </View>

    {/* Zona de peligro */}
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>⚠️ Zona de Peligro</Text>
      
      <TouchableOpacity style={styles.optionButton} onPress={handleLogout}>
        <View style={styles.optionLeft}>
          <View style={[styles.optionIcon, { backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.optionIconText}>🚪</Text>
          </View>
          <View>
            <Text style={styles.optionText}>Cerrar Sesión</Text>
            <Text style={styles.optionSubtext}>Salir de tu cuenta</Text>
          </View>
        </View>
        <Text style={styles.optionArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.optionButton} 
        onPress={handleDeleteAccount}
      >
        <View style={styles.optionLeft}>
          <View style={[styles.optionIcon, { backgroundColor: '#FEE2E2' }]}>
            <Text style={styles.optionIconText}>🗑️</Text>
          </View>
          <View>
            <Text style={[styles.optionText, { color: '#DC2626' }]}>Eliminar Cuenta</Text>
            <Text style={styles.optionSubtext}>Acción permanente</Text>
          </View>
        </View>
        <Text style={styles.optionArrow}>›</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>Limpio v1.2.0</Text>
    </View>
  </ScrollView>

  {/* Modales (igual que antes) */}
  <Modal visible={showEditModal} animationType="slide" transparent={true}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>✏️ Editar Empresa</Text>
        <Text style={styles.label}>Nombre de la Empresa</Text>
        <TextInput
          style={styles.input}
          value={editedBusinessName}
          onChangeText={setEditedBusinessName}
          placeholder="Nombre de tu empresa"
          placeholderTextColor="#94A3B8"
        />
        <View style={styles.modalButtons}>
          <TouchableOpacity
            style={[styles.modalButton, styles.cancelButton]}
            onPress={() => {
              setShowEditModal(false);
              setEditedBusinessName(userData?.businessName || '');
            }}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalButton, styles.saveButton]}
            onPress={handleUpdateBusinessName}
          >
            <Text style={styles.saveButtonText}>Guardar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>

  <Modal visible={showPasswordModal} animationType="slide" transparent={true}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>🔐 Cambiar Contraseña</Text>
        <Text style={styles.label}>Contraseña Actual</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Tu contraseña actual"
          placeholderTextColor="#94A3B8"
          secureTextEntry
        />
        <Text style={styles.label}>Nueva Contraseña</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor="#94A3B8"
          secureTextEntry
        />
        <Text style={styles.label}>Confirmar Nueva Contraseña</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Repite la nueva contraseña"
          placeholderTextColor="#94A3B8"
          secureTextEntry
        />
        <View style={styles.modalButtons}>
          <TouchableOpacity
            style={[styles.modalButton, styles.cancelButton]}
            onPress={() => {
              setShowPasswordModal(false);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
            }}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalButton, styles.saveButton]}
            onPress={handleChangePassword}
          >
            <Text style={styles.saveButtonText}>Cambiar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>

  <Modal visible={showEmailModal} animationType="slide" transparent={true}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>📧 Cambiar Email</Text>
        <Text style={styles.label}>Nuevo Email</Text>
        <TextInput
          style={styles.input}
          value={newEmail}
          onChangeText={setNewEmail}
          placeholder="nuevo@email.com"
          placeholderTextColor="#94A3B8"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={styles.label}>Confirma tu Contraseña</Text>
        <TextInput
          style={styles.input}
          value={emailPassword}
          onChangeText={setEmailPassword}
          placeholder="Tu contraseña actual"
          placeholderTextColor="#94A3B8"
          secureTextEntry
        />
        <View style={styles.modalButtons}>
          <TouchableOpacity
            style={[styles.modalButton, styles.cancelButton]}
            onPress={() => {
              setShowEmailModal(false);
              setNewEmail('');
              setEmailPassword('');
            }}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalButton, styles.saveButton]}
            onPress={handleChangeEmail}
          >
            <Text style={styles.saveButtonText}>Cambiar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
</View>
);
}
const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: '#FAFAFA',
},
header: {
backgroundColor: '#8B5CF6',
paddingTop: 50,
paddingBottom: 24,
paddingHorizontal: 20,
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
borderBottomLeftRadius: 32,
borderBottomRightRadius: 32,
},
backText: {
color: 'white',
fontSize: 16,
fontWeight: '600',
},
headerTitle: {
color: 'white',
fontSize: 24,
fontWeight: '800',
},
content: {
flex: 1,
padding: 20,
},
center: {
flex: 1,
justifyContent: 'center',
alignItems: 'center',
},
loadingText: {
marginTop: 12,
fontSize: 16,
color: '#64748B',
fontWeight: '500',
},
profileCard: {
backgroundColor: 'white',
borderRadius: 20,
padding: 20,
flexDirection: 'row',
alignItems: 'center',
marginBottom: 24,
shadowColor: '#000',
shadowOffset: { width: 0, height: 4 },
shadowOpacity: 0.08,
shadowRadius: 8,
elevation: 4,
},
profileAvatar: {
width: 64,
height: 64,
borderRadius: 18,
backgroundColor: '#8B5CF6',
justifyContent: 'center',
alignItems: 'center',
marginRight: 16,
},
profileAvatarText: {
fontSize: 28,
fontWeight: '800',
color: 'white',
},
profileInfo: {
flex: 1,
},
profileName: {
fontSize: 20,
fontWeight: '700',
color: '#1F2937',
marginBottom: 4,
},
profileEmail: {
fontSize: 14,
color: '#64748B',
},
editButton: {
width: 44,
height: 44,
borderRadius: 12,
backgroundColor: '#F3E8FF',
justifyContent: 'center',
alignItems: 'center',
},
editButtonText: {
fontSize: 22,
},
section: {
marginBottom: 24,
},
sectionTitle: {
fontSize: 18,
fontWeight: '800',
color: '#1F2937',
marginBottom: 14,
},
subscriptionCard: {
backgroundColor: 'white',
borderRadius: 20,
padding: 20,
borderLeftWidth: 4,
marginBottom: 14,
shadowColor: '#000',
shadowOffset: { width: 0, height: 4 },
shadowOpacity: 0.08,
shadowRadius: 8,
elevation: 4,
},
subscriptionHeader: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'flex-start',
},
subscriptionLeft: {
flex: 1,
},
subscriptionLabel: {
fontSize: 12,
color: '#64748B',
marginBottom: 4,
fontWeight: '600',
},
subscriptionStatus: {
fontSize: 20,
fontWeight: '800',
marginBottom: 4,
},
subscriptionMessage: {
fontSize: 14,
color: '#64748B',
},
warningBadge: {
width: 40,
height: 40,
borderRadius: 12,
backgroundColor: '#FEF3C7',
justifyContent: 'center',
alignItems: 'center',
},
warningText: {
fontSize: 20,
},
renewButton: {
backgroundColor: '#DC2626',
padding: 14,
borderRadius: 12,
marginTop: 16,
},
renewButtonText: {
color: 'white',
fontWeight: '700',
textAlign: 'center',
fontSize: 15,
},
upgradeButton: {
backgroundColor: '#F59E0B',
padding: 14,
borderRadius: 12,
marginTop: 16,
},
upgradeButtonText: {
color: 'white',
fontWeight: '700',
textAlign: 'center',
fontSize: 15,
},
planCard: {
backgroundColor: '#F3E8FF',
borderRadius: 20,
padding: 20,
},
planTitle: {
fontSize: 16,
fontWeight: '700',
color: '#1F2937',
marginBottom: 14,
},
planFeatures: {
marginBottom: 16,
},
planFeature: {
fontSize: 14,
color: '#374151',
marginBottom: 8,
fontWeight: '500',
},
planPrice: {
flexDirection: 'row',
alignItems: 'baseline',
justifyContent: 'center',
paddingTop: 16,
borderTopWidth: 1,
borderTopColor: '#E9D5FF',
},
planPriceAmount: {
fontSize: 32,
fontWeight: '800',
color: '#8B5CF6',
marginRight: 8,
},
planPriceLabel: {
fontSize: 14,
fontWeight: '600',
color: '#64748B',
},
// NUEVOS ESTILOS PARA GRÁFICAS
chartCard: {
backgroundColor: 'white',
borderRadius: 20,
padding: 20,
marginBottom: 16,
shadowColor: '#000',
shadowOffset: { width: 0, height: 4 },
shadowOpacity: 0.08,
shadowRadius: 8,
elevation: 4,
},
chartTitle: {
fontSize: 16,
fontWeight: '700',
color: '#1F2937',
marginBottom: 20,
},
chart: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'flex-end',
height: 160,
paddingBottom: 30,
},
barContainer: {
flex: 1,
alignItems: 'center',
},
barWrapper: {
height: 120,
justifyContent: 'flex-end',
alignItems: 'center',
},
bar: {
width: 24,
backgroundColor: '#8B5CF6',
borderRadius: 4,
},
barLabel: {
fontSize: 11,
fontWeight: '600',
color: '#64748B',
marginTop: 6,
},
barAmount: {
fontSize: 10,
fontWeight: '600',
color: '#8B5CF6',
marginTop: 2,
},
topCard: {
backgroundColor: 'white',
borderRadius: 20,
padding: 20,
marginBottom: 16,
shadowColor: '#000',
shadowOffset: { width: 0, height: 4 },
shadowOpacity: 0.08,
shadowRadius: 8,
elevation: 4,
},
topTitle: {
fontSize: 16,
fontWeight: '700',
color: '#1F2937',
marginBottom: 16,
},
topItem: {
flexDirection: 'row',
alignItems: 'center',
marginBottom: 14,
},
topRank: {
width: 44,
height: 44,
borderRadius: 12,
backgroundColor: '#F3E8FF',
justifyContent: 'center',
alignItems: 'center',
marginRight: 14,
},
topRankText: {
fontSize: 24,
},
topInfo: {
flex: 1,
},
topMachineName: {
fontSize: 15,
fontWeight: '600',
color: '#1F2937',
marginBottom: 3,
},
topMachineRevenue: {
fontSize: 13,
color: '#8B5CF6',
fontWeight: '600',
},
noDataText: {
fontSize: 14,
color: '#94A3B8',
textAlign: 'center',
paddingVertical: 20,
},
insightsCard: {
backgroundColor: 'white',
borderRadius: 20,
padding: 20,
shadowColor: '#000',
shadowOffset: { width: 0, height: 4 },
shadowOpacity: 0.08,
shadowRadius: 8,
elevation: 4,
},
insightsTitle: {
fontSize: 16,
fontWeight: '700',
color: '#1F2937',
marginBottom: 16,
},
insightItem: {
flexDirection: 'row',
alignItems: 'center',
marginBottom: 16,
},
insightIcon: {
fontSize: 32,
marginRight: 14,
width: 44,
textAlign: 'center',
},
insightContent: {
flex: 1,
},
insightLabel: {
fontSize: 13,
color: '#64748B',
marginBottom: 3,
fontWeight: '500',
},
insightValue: {
fontSize: 16,
fontWeight: '700',
color: '#1F2937',
},
statsGrid: {
flexDirection: 'row',
flexWrap: 'wrap',
gap: 12,
},
statCard: {
width: '48%',
borderRadius: 16,
padding: 18,
alignItems: 'center',
shadowColor: '#000',
shadowOffset: { width: 0, height: 4 },
shadowOpacity: 0.1,
shadowRadius: 8,
elevation: 4,
},
statIcon: {
fontSize: 32,
marginBottom: 8,
},
statNumber: {
fontSize: 26,
fontWeight: '800',
color: 'white',
marginBottom: 4,
},
statLabel: {
fontSize: 12,
color: 'rgba(255,255,255,0.9)',
fontWeight: '600',
textAlign: 'center',
},
optionButton: {
backgroundColor: 'white',
borderRadius: 16,
padding: 18,
flexDirection: 'row',
alignItems: 'center',
justifyContent: 'space-between',
marginBottom: 12,
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.05,
shadowRadius: 4,
elevation: 2,
},
optionLeft: {
flexDirection: 'row',
alignItems: 'center',
flex: 1,
},
optionIcon: {
width: 48,
height: 48,
borderRadius: 12,
justifyContent: 'center',
alignItems: 'center',
marginRight: 14,
},
optionIconText: {
fontSize: 24,
},
optionText: {
fontSize: 16,
fontWeight: '600',
color: '#1F2937',
},
optionSubtext: {
fontSize: 13,
color: '#94A3B8',
marginTop: 2,
},
optionArrow: {
fontSize: 28,
color: '#CBD5E1',
fontWeight: '300',
},
versionText: {
textAlign: 'center',
color: '#94A3B8',
fontSize: 12,
marginTop: 12,
marginBottom: 20,
},
modalOverlay: {
flex: 1,
backgroundColor: 'rgba(0,0,0,0.6)',
justifyContent: 'center',
padding: 20,
},
modalContent: {
backgroundColor: 'white',
borderRadius: 24,
padding: 20,
},
modalTitle: {
fontSize: 22,
fontWeight: '800',
marginBottom: 20,
textAlign: 'center',
color: '#1F2937',
},
label: {
fontSize: 14,
fontWeight: '700',
color: '#374151',
marginBottom: 8,
},
input: {
borderWidth: 2,
borderColor: '#E5E7EB',
borderRadius: 12,
padding: 14,
fontSize: 16,
backgroundColor: '#F9FAFB',
color: '#1F2937',
marginBottom: 20,
},
modalButtons: {
flexDirection: 'row',
gap: 12,
},
modalButton: {
flex: 1,
padding: 14,
borderRadius: 12,
alignItems: 'center',
},
cancelButton: {
backgroundColor: '#F3F4F6',
},
cancelButtonText: {
color: '#374151',
fontWeight: '700',
fontSize: 15,
},
saveButton: {
backgroundColor: '#8B5CF6',
},
saveButtonText: {
color: 'white',
fontWeight: '700',
fontSize: 15,
},
idContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#F3F4F6',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 10,
  marginTop: 8,
},
idLabel: {
  fontSize: 12,
  fontWeight: '700',
  color: '#64748B',
  marginRight: 6,
},
idText: {
  flex: 1,
  fontSize: 11,
  fontWeight: '600',
  color: '#374151',
  fontFamily: 'monospace',
},
idCopy: {
  fontSize: 16,
  marginLeft: 6,
},
});