import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  Platform
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { getMachines, addMachine, updateMachine, deleteMachine, getMachineStats } from '../services/firestoreService';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

export default function MachinesScreen({ navigation }) {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [showStats, setShowStats] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showQR, setShowQR] = useState(null);
  const [businessName, setBusinessName] = useState('LaundryManager');
  const [downloadingQR, setDownloadingQR] = useState(false);

  const qrRef = useRef();

  const [formData, setFormData] = useState({
    number: '',
    brand: '',
    capacity: '18',
    status: 'disponible'
  });

  useEffect(() => {
    loadMachines();
    loadBusinessName();
  }, []);

  const loadBusinessName = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setBusinessName(userDoc.data().businessName || 'LaundryManager');
      }
    } catch (error) {
      console.error('Error al cargar nombre de empresa:', error);
    }
  };

  const loadMachines = async () => {
    try {
      setLoading(true);
      const data = await getMachines();
      setMachines(data);
    } catch (error) {
      console.error('Error al cargar:', error);
      Alert.alert('Error', 'No se pudieron cargar las lavadoras');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMachine = async () => {
    if (!formData.number || !formData.brand) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    try {
      const machineData = {
        number: String(formData.number),
        brand: String(formData.brand),
        capacity: Number(formData.capacity) || 18,
        status: String(formData.status)
      };

      if (editingMachine) {
        await updateMachine(editingMachine.id, machineData);
        Alert.alert('¡Listo! ✅', 'Lavadora actualizada');
      } else {
        await addMachine(machineData);
        Alert.alert('¡Genial! 🎉', 'Lavadora agregada exitosamente');
      }
      
      setShowForm(false);
      setEditingMachine(null);
      setFormData({ number: '', brand: '', capacity: '18', status: 'disponible' });
      loadMachines();
    } catch (error) {
      console.error('Error al guardar:', error);
      Alert.alert('Error', 'No se pudo guardar: ' + error.message);
    }
  };

  const handleEdit = (machine) => {
    setEditingMachine(machine);
    setFormData({
      number: String(machine.number),
      brand: String(machine.brand),
      capacity: String(machine.capacity),
      status: String(machine.status)
    });
    setShowForm(true);
  };

  const handleDelete = (machineId) => {
    Alert.alert(
      'Eliminar Lavadora',
      '¿Estás seguro? Esta acción no se puede deshacer',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMachine(machineId);
              Alert.alert('¡Eliminado! 🗑️', 'Lavadora eliminada correctamente');
              loadMachines();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la lavadora');
            }
          }
        }
      ]
    );
  };

  const handleShowStats = async (machine) => {
    setShowStats(machine);
    setLoadingStats(true);
    
    try {
      const stats = await getMachineStats(machine.id);
      setStatsData(stats);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      setStatsData({
        timesRented: 0,
        totalRevenue: 0,
        maintenanceDays: 0
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const handleDownloadQR = async () => {
  try {
    setDownloadingQR(true);

    // IMPORTANTE: Pedimos permisos de escritura únicamente
    const { status } = await MediaLibrary.requestPermissionsAsync(true); 
    
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Para guardar el QR necesitamos acceso a tu galería.');
      return;
    }

    // Capturamos el componente
    const uri = await qrRef.current.capture();

    if (uri) {
      // Guardamos la imagen
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('¡Éxito! ✅', 'Código QR guardado en la galería.');
    }
  } catch (error) {
    console.error('Error al descargar:', error);
    // Si sigue fallando por permisos de Android, usamos el plan B: Compartir
    handleShareQR(); 
  } finally {
    setDownloadingQR(false);
  }
};

  const filteredMachines = machines.filter(m =>
    String(m.number).toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(m.brand).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'disponible': return '#10B981';
      case 'alquilada': return '#3B82F6';
      case 'mantenimiento': return '#F97316';
      default: return '#64748B';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'disponible': return 'Disponible';
      case 'alquilada': return 'Alquilada';
      case 'mantenimiento': return 'Mantenimiento';
      default: return status;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Atrás</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lavadoras</Text>
          <View style={{ width: 70 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Cargando lavadoras...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Atrás</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Lavadoras</Text>
          <Text style={styles.headerSubtitle}>{machines.length} en total</Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            setEditingMachine(null);
            setFormData({ number: '', brand: '', capacity: '18', status: 'disponible' });
            setShowForm(true);
          }}
        >
          <Text style={styles.addButtonText}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar lavadora..."
          placeholderTextColor="#94A3B8"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {/* Lista de lavadoras */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {filteredMachines.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No hay lavadoras</Text>
            <Text style={styles.emptySubtext}>Agrega tu primera lavadora</Text>
          </View>
        ) : (
          filteredMachines.map(machine => (
            <View key={machine.id} style={styles.machineCard}>
              <View style={styles.machineHeader}>
                <View style={styles.machineInfo}>
                  <View style={styles.machineNumberBadge}>
                    <Text style={styles.machineNumberText}>#{machine.number}</Text>
                  </View>
                  <Text style={styles.machineBrand}>{machine.brand}</Text>
                  <Text style={styles.machineCapacity}>{machine.capacity}kg</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(machine.status) }]}>
                  <Text style={styles.statusText}>{getStatusText(machine.status)}</Text>
                </View>
              </View>

              <View style={styles.machineActions}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => handleEdit(machine)}
                >
                  <Text style={styles.actionIcon}>✏️</Text>
                  <Text style={styles.actionButtonText}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionButton, styles.statsButton]}
                  onPress={() => handleShowStats(machine)}
                >
                  <Text style={styles.actionIcon}>📊</Text>
                  <Text style={styles.actionButtonText}>Stats</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionButton, styles.qrButton]}
                  onPress={() => setShowQR(machine)}
                >
                  <Text style={styles.actionIcon}>📱</Text>
                  <Text style={styles.actionButtonText}>QR</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal de Formulario */}
      <Modal visible={showForm} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingMachine ? '✏️ Editar Lavadora' : '➕ Nueva Lavadora'}
            </Text>

            <Text style={styles.label}>Número de Lavadora</Text>
            <TextInput
              style={styles.input}
              placeholder="001"
              placeholderTextColor="#94A3B8"
              value={formData.number}
              onChangeText={(text) => setFormData({ ...formData, number: text })}
            />

            <Text style={styles.label}>Marca</Text>
            <TextInput
              style={styles.input}
              placeholder="Samsung, LG, etc."
              placeholderTextColor="#94A3B8"
              value={formData.brand}
              onChangeText={(text) => setFormData({ ...formData, brand: text })}
            />

            <Text style={styles.label}>Capacidad (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder="18"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={formData.capacity}
              onChangeText={(text) => setFormData({ ...formData, capacity: text })}
            />

            <Text style={styles.label}>Estado</Text>
            <View style={styles.statusSelector}>
              {['disponible', 'mantenimiento'].map(status => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusOption,
                    formData.status === status && styles.statusOptionActive
                  ]}
                  onPress={() => setFormData({ ...formData, status: status })}
                >
                  <Text style={[
                    styles.statusOptionText,
                    formData.status === status && styles.statusOptionTextActive
                  ]}>
                    {getStatusText(status)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowForm(false);
                  setEditingMachine(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddMachine}
              >
                <Text style={styles.saveButtonText}>
                  {editingMachine ? 'Actualizar' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>

            {editingMachine && (
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => {
                  setShowForm(false);
                  handleDelete(editingMachine.id);
                }}
              >
                <Text style={styles.deleteButtonText}>🗑️ Eliminar Lavadora</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de Estadísticas */}
      <Modal visible={showStats !== null} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📊 Estadísticas</Text>
            
            {showStats && (
              <>
                <View style={styles.statsHeader}>
                  <View style={styles.statsHeaderBadge}>
                    <Text style={styles.statsHeaderNumber}>#{showStats.number}</Text>
                  </View>
                  <View style={styles.statsHeaderInfo}>
                    <Text style={styles.statsHeaderBrand}>{showStats.brand}</Text>
                    <Text style={styles.statsHeaderCapacity}>{showStats.capacity}kg</Text>
                  </View>
                </View>

                {loadingStats ? (
                  <View style={styles.loadingStats}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Cargando estadísticas...</Text>
                  </View>
                ) : statsData ? (
                  <>
                    <View style={styles.statsGrid}>
                      <View style={[styles.statCard, { backgroundColor: '#8B5CF6' }]}>
                        <Text style={styles.statCardIcon}>🔄</Text>
                        <Text style={styles.statCardNumber}>{statsData.timesRented}</Text>
                        <Text style={styles.statCardLabel}>Veces Alquilada</Text>
                      </View>

                      <View style={[styles.statCard, { backgroundColor: '#10B981' }]}>
                        <Text style={styles.statCardIcon}>💰</Text>
                        <Text style={styles.statCardNumber}>
                          ${(statsData.totalRevenue / 1000).toFixed(0)}k
                        </Text>
                        <Text style={styles.statCardLabel}>Ingresos Generados</Text>
                      </View>

                      <View style={[styles.statCard, { backgroundColor: '#F97316' }]}>
                        <Text style={styles.statCardIcon}>🔧</Text>
                        <Text style={styles.statCardNumber}>{statsData.maintenanceDays}</Text>
                        <Text style={styles.statCardLabel}>Días Mantenimiento</Text>
                      </View>
                    </View>

                    {statsData.timesRented === 0 && (
                      <View style={styles.noStatsBox}>
                        <Text style={styles.noStatsIcon}>📊</Text>
                        <Text style={styles.noStatsText}>
                          Esta lavadora aún no ha sido alquilada
                        </Text>
                      </View>
                    )}
                  </>
                ) : null}
              </>
            )}

            <TouchableOpacity 
  style={styles.closeButton}
  onPress={() => {
    setShowStats(null);
    setStatsData(null);
  }}
>
  <Text style={styles.closeButtonText}>Cerrar</Text>
</TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de QR */}
      <Modal visible={showQR !== null} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            <Text style={styles.modalTitle}>📱 Código QR</Text>
            
            {showQR && (
              <>
                <ViewShot ref={qrRef} options={{ format: 'png', quality: 1.0 }}>
                  <View style={styles.qrDownloadContainer}>
                    {/* QR Code */}
                    <View style={styles.qrCodeWrapper}>
                      <QRCode
                        value={showQR.id}
                        size={200}
                        backgroundColor="white"
                        color="#1F2937"
                      />
                    </View>

                    {/* Texto debajo del QR */}
                    <View style={styles.qrTextContainer}>
                      <Text style={styles.qrBusinessName}>{businessName}</Text>
                      <Text style={styles.qrMachineNumber}>Lavadora #{showQR.number}</Text>
                      <Text style={styles.qrCapacityText}>{showQR.capacity}kg</Text>
                      
                      <View style={styles.qrDivider} />
                      
                      <Text style={styles.qrWarning}>No sobrecargar</Text>
                      <Text style={styles.qrWarningSubtext}>
                        "No va a lavar bien y dañas el equipo"
                      </Text>
                      <Text style={styles.qrFooter}>
                        De tu cuidado también depende nuestro servicio
                      </Text>
                    </View>
                  </View>
                </ViewShot>

                {/* Botones */}
                <TouchableOpacity 
                  style={[styles.downloadButton, downloadingQR && styles.downloadButtonDisabled]}
                  onPress={handleDownloadQR}
                  disabled={downloadingQR}
                >
                  {downloadingQR ? (
                    <>
                      <ActivityIndicator size="small" color="white" />
                      <Text style={styles.downloadButtonText}>  Descargando...</Text>
                    </>
                  ) : (
                    <Text style={styles.downloadButtonText}>📥 Descargar QR</Text>
                  )}
                </TouchableOpacity>

               <TouchableOpacity 
  style={styles.closeButton}
  onPress={() => setShowQR(null)}
>
  <Text style={styles.closeButtonText}>Cerrar</Text>
</TouchableOpacity>
              </>
            )}
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
    backgroundColor: '#3B82F6',
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  addButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyContainer: {
    paddingTop: 100,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#64748B',
  },
  machineCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  machineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  machineInfo: {
    flex: 1,
  },
  machineNumberBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 10,
  },
  machineNumberText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  machineBrand: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  machineCapacity: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  machineActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  editButton: {
    backgroundColor: '#DBEAFE',
  },
  statsButton: {
    backgroundColor: '#F3E8FF',
  },
  qrButton: {
    backgroundColor: '#D1FAE5',
  },
  actionIcon: {
    fontSize: 16,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
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
    padding: 16,
    maxHeight: '60%',
  },
  qrModalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
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
    marginTop: 12,
  },
  input: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    color: '#1F2937',
  },
  statusSelector: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  statusOption: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  statusOptionActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  statusOptionText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
  },
  statusOptionTextActive: {
    color: '#3B82F6',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 13,
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
    backgroundColor: '#3B82F6',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  deleteButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 16,
  },
  closeButton: {
  backgroundColor: '#3B82F6',
  marginTop: 12,
  padding: 16,
  borderRadius: 12,
  alignItems: 'center',
  width: '100%',
},
closeButtonText: {
  color: 'white',
  fontWeight: '700',
  fontSize: 15,
},
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  statsHeaderBadge: {
    backgroundColor: '#3B82F6',
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  statsHeaderNumber: {
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
  },
  statsHeaderInfo: {
    flex: 1,
  },
  statsHeaderBrand: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  statsHeaderCapacity: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  loadingStats: {
    padding: 20,
    alignItems: 'center',
  },
  statsGrid: {
    gap: 8,
    marginBottom: 8,
  },
  statCard: {
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  statCardIcon: {
    fontSize: 20,
    marginBottom: 5,
  },
  statCardNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: 'white',
    marginBottom: 2,
  },
  statCardLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  noStatsBox: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  noStatsIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  noStatsText: {
    fontSize: 11,
    color: '#92400E',
    textAlign: 'center',
    fontWeight: '600',
  },
  // Estilos del QR descargable
  qrDownloadContainer: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    borderRadius: 16,
  },
  qrCodeWrapper: {
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrTextContainer: {
    alignItems: 'center',
    width: 240,
  },
  qrBusinessName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#3B82F6',
    marginBottom: 8,
    textAlign: 'center',
  },
  qrMachineNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  qrCapacityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
  },
  qrDivider: {
    width: '80%',
    height: 2,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  qrWarning: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
    marginBottom: 6,
    textAlign: 'center',
  },
  qrWarningSubtext: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  qrFooter: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 14,
  },
  downloadButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  downloadButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  downloadButtonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 16,
  },
});