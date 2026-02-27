import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { getPayments, getPendingPayments, getMachines, getRentals, getPartners, getScheduled } from '../services/firestoreService';
import { Camera } from 'expo-camera';
import { CameraView } from 'expo-camera';

export default function DashboardScreen({ navigation }) {
  const [businessName, setBusinessName] = useState('');
  const [stats, setStats] = useState({
    totalMachines: 0,
    available: 0,
    rented: 0,
    todayIncome: 0,
    pendingAmount: 0,
    totalPartners: 0,
    totalScheduled: 0
  });
  const [loading, setLoading] = useState(true);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [machines, setMachines] = useState([]);

  useEffect(() => {
    loadUserData();
    loadStats();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadUserData();
      loadStats();
    });
    return unsubscribe;
  }, [navigation]);

  const loadUserData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setBusinessName(userDoc.data().businessName || 'Usuario');
      }
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
    }
  };

  const loadStats = async () => {
    try {
      const [payments, pending, machinesData, rentals, partners, scheduled] = await Promise.all([
        getPayments(),
        getPendingPayments(),
        getMachines(),
        getRentals(),
        getPartners(),
        getScheduled()
      ]);

      setMachines(machinesData);

      const today = new Date().toISOString().split('T')[0];
      const todayIncome = payments
        .filter(p => p.date === today)
        .reduce((sum, p) => sum + p.amount, 0);

      const pendingAmount = pending.reduce((sum, p) => sum + p.amount, 0);

      setStats({
        totalMachines: machinesData.length,
        available: machinesData.filter(m => m.status === 'disponible').length,
        rented: rentals.length,
        todayIncome,
        pendingAmount,
        totalPartners: partners.length,
        totalScheduled: scheduled.length
      });
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
    return status === 'granted';
  };

  const handleOpenQRScanner = async () => {
    const hasPermission = await requestCameraPermission();
    
    if (!hasPermission) {
      Alert.alert(
        'Permiso Necesario',
        'Necesitamos acceso a la cámara para escanear códigos QR.',
        [{ text: 'OK' }]
      );
      return;
    }

    setScanned(false);
    setShowQRScanner(true);
  };

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    
    setScanned(true);
    console.log('QR escaneado:', data);

    // Buscar la lavadora por ID
    const machine = machines.find(m => m.id === data);

    if (machine) {
      if (machine.status !== 'disponible') {
        Alert.alert(
          'Lavadora No Disponible',
          `La lavadora #${machine.number} está actualmente ${machine.status}.`,
          [
            { 
              text: 'Buscar Otra', 
              onPress: () => setScanned(false) 
            },
            {
              text: 'Cerrar',
              onPress: () => setShowQRScanner(false)
            }
          ]
        );
        return;
      }

      Alert.alert(
        '¡Escaneado! ✅',
        `Lavadora #${machine.number} - ${machine.brand} (${machine.capacity}kg)\n\nAhora completa los datos del alquiler.`,
        [
          {
            text: 'Continuar',
            onPress: () => {
              setShowQRScanner(false);
              // Navegar a RentalsScreen con la lavadora preseleccionada
              navigation.navigate('Rentals', { scannedMachineId: machine.id });
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'QR No Reconocido',
        'Este código QR no corresponde a ninguna lavadora registrada.',
        [
          { 
            text: 'Escanear Otro', 
            onPress: () => setScanned(false) 
          },
          {
            text: 'Cerrar',
            onPress: () => setShowQRScanner(false)
          }
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header con gradiente visual */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.welcomeText}>¡Bienvenido! ✨</Text>
            <Text style={styles.businessName}>{businessName}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Profile')} 
            style={styles.profileButton}
          >
            <Text style={styles.profileEmoji}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
          </View>
        ) : (
          <>
            {/* Cards vibrantes principales */}
            <View style={styles.mainCardsRow}>
              <TouchableOpacity 
                style={[styles.mainCard, styles.purpleCard]}
                onPress={() => navigation.navigate('Income')}
              >
                <Text style={styles.mainCardEmoji}>💰</Text>
                <Text style={styles.mainCardLabel}>Hoy</Text>
                <Text style={styles.mainCardValue}>
                  ${(stats.todayIncome/1000).toFixed(0)}k
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.mainCard, styles.orangeCard]}
                onPress={() => navigation.navigate('Pending')}
              >
                <Text style={styles.mainCardEmoji}>⏰</Text>
                <Text style={styles.mainCardLabel}>Pendiente</Text>
                <Text style={styles.mainCardValue}>
                  ${(stats.pendingAmount/1000).toFixed(0)}k
                </Text>
              </TouchableOpacity>
            </View>

            {/* Grid colorido */}
            <View style={styles.statsSection}>
              <Text style={styles.sectionTitle}>Tu Negocio 🚀</Text>
              
              <View style={styles.statsGrid}>
                <TouchableOpacity 
                  style={[styles.statCard, styles.blueCard]}
                  onPress={() => navigation.navigate('Machines')}
                >
                  <View style={styles.statCardTop}>
                    <Text style={styles.statEmoji}>🧺</Text>
                    <Text style={styles.statBadge}>{stats.available} libres</Text>
                  </View>
                  <Text style={styles.statNumber}>{stats.totalMachines}</Text>
                  <Text style={styles.statLabel}>Lavadoras</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.statCard, styles.cyanCard]}
                  onPress={() => navigation.navigate('Rentals')}
                >
                  <View style={styles.statCardTop}>
                    <Text style={styles.statEmoji}>🧼</Text>
                  </View>
                  <Text style={styles.statNumber}>{stats.rented}</Text>
                  <Text style={styles.statLabel}>Activos</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.statCard, styles.pinkCard]}
                  onPress={() => navigation.navigate('Partners')}
                >
                  <View style={styles.statCardTop}>
                    <Text style={styles.statEmoji}>🤝</Text>
                  </View>
                  <Text style={styles.statNumber}>{stats.totalPartners}</Text>
                  <Text style={styles.statLabel}>Socios</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.statCard, styles.greenCard]}
                  onPress={() => navigation.navigate('Scheduled')}
                >
                  <View style={styles.statCardTop}>
                    <Text style={styles.statEmoji}>📅</Text>
                  </View>
                  <Text style={styles.statNumber}>{stats.totalScheduled}</Text>
                  <Text style={styles.statLabel}>Agendados</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* NUEVO: Botón de escaneo QR grande y llamativo */}
            <View style={styles.qrSection}>
              <Text style={styles.sectionTitle}>Acción Rápida ⚡</Text>
              
              <TouchableOpacity 
                style={styles.qrButton}
                onPress={handleOpenQRScanner}
                activeOpacity={0.8}
              >
                <View style={styles.qrButtonContent}>
                  <View style={styles.qrIconContainer}>
                    <Text style={styles.qrIcon}>📱</Text>
                    <View style={styles.qrPulse} />
                  </View>
                  <View style={styles.qrTextContainer}>
                    <Text style={styles.qrButtonTitle}>Escanear QR</Text>
                    <Text style={styles.qrButtonSubtitle}>Alquiler instantáneo</Text>
                  </View>
                  <View style={styles.qrArrow}>
                    <Text style={styles.qrArrowText}>→</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal de QR Scanner */}
      <Modal visible={showQRScanner} animationType="slide">
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Escanear QR de Lavadora</Text>
            <TouchableOpacity 
              style={styles.closeScanner}
              onPress={() => {
                setShowQRScanner(false);
                setScanned(false);
              }}
            >
              <Text style={styles.closeScannerText}>✕ Cerrar</Text>
            </TouchableOpacity>
          </View>

          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          >
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerFrame}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              
              <Text style={styles.scannerInstructions}>
                Apunta la cámara al código QR de la lavadora
              </Text>
            </View>
          </CameraView>

          {scanned && (
            <View style={styles.scannedOverlay}>
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.scannedText}>Procesando...</Text>
            </View>
          )}
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
    paddingBottom: 30,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: '#E9D5FF',
    marginBottom: 4,
    fontWeight: '500',
  },
  businessName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileEmoji: {
    fontSize: 26,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingTop: 100,
    alignItems: 'center',
  },
  mainCardsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    marginTop: -40,
  },
  mainCard: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  purpleCard: {
    backgroundColor: '#10B981',
  },
  orangeCard: {
    backgroundColor: '#F97316',
  },
  mainCardEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  mainCardLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    marginBottom: 4,
  },
  mainCardValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  blueCard: {
    backgroundColor: '#3B82F6',
  },
  cyanCard: {
    backgroundColor: '#06B6D4',
  },
  pinkCard: {
    backgroundColor: '#EC4899',
  },
  greenCard: {
    backgroundColor: '#8B5CF6',
  },
  statCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statEmoji: {
    fontSize: 28,
  },
  statBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  // NUEVO: Estilos del botón QR
  qrSection: {
    marginBottom: 24,
  },
  qrButton: {
    backgroundColor: '#0691b4',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#0691b4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  qrButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qrIconContainer: {
    position: 'relative',
    width: 70,
    height: 70,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrIcon: {
    fontSize: 38,
  },
  qrPulse: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    opacity: 0.5,
  },
  qrTextContainer: {
    flex: 1,
    marginLeft: 20,
  },
  qrButtonTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  qrButtonSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  qrArrow: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrArrowText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  // Estilos del escáner
  scannerContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  scannerHeader: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scannerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeScanner: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeScannerText: {
    color: 'white',
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#0691b4',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  scannerInstructions: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 15,
    borderRadius: 10,
  },
  scannedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannedText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
  },
});