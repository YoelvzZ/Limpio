import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator
} from 'react-native';
import { 
  getPartners, 
  addPartner, 
  updatePartner, 
  deletePartner,
  getPartnerStats 
} from '../services/firestoreService';

export default function PartnersScreen({ navigation }) {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [showStats, setShowStats] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [formData, setFormData] = useState({
  name: '',
  phone: '',
  percentage: '30',
  notes: '',
  partnerUserId: ''  // ← NUEVO
});

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      setLoading(true);
      const data = await getPartners();
      setPartners(data);
    } catch (error) {
      console.error('Error al cargar socios:', error);
      Alert.alert('Error', 'No se pudieron cargar los socios');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePartner = async () => {
    if (!formData.name || !formData.phone || !formData.percentage) {
      Alert.alert('Error', 'Completa al menos nombre, teléfono y porcentaje');
      return;
    }

    const percentage = parseInt(formData.percentage);
    if (percentage < 1 || percentage > 100) {
      Alert.alert('Error', 'El porcentaje debe estar entre 1 y 100');
      return;
    }

    try {
      const partnerData = {
  name: formData.name,
  phone: formData.phone,
  percentage: percentage,
  notes: formData.notes,
  partnerUserId: formData.partnerUserId || null  // ← NUEVO
};

      if (editingPartner) {
        await updatePartner(editingPartner.id, partnerData);
        Alert.alert('¡Listo! ✅', 'Socio actualizado');
      } else {
        await addPartner(partnerData);
        Alert.alert('¡Genial! 🎉', 'Socio agregado exitosamente');
      }

      setShowForm(false);
      setEditingPartner(null);
      resetForm();
      loadPartners();
    } catch (error) {
      console.error('Error al guardar socio:', error);
      Alert.alert('Error', 'No se pudo guardar el socio');
    }
  };

  const handleDelete = (partner) => {
    Alert.alert(
      'Eliminar Socio',
      `¿Eliminar a ${partner.name}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePartner(partner.id);
              Alert.alert('¡Eliminado! 🗑️', 'Socio eliminado correctamente');
              loadPartners();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar el socio');
            }
          }
        }
      ]
    );
  };

  const handleShowStats = async (partner) => {
    setShowStats(partner);
    setLoadingStats(true);
    
    try {
      const stats = await getPartnerStats(partner.id);
      
      const partnerEarnings = Math.floor(stats.totalRevenue * (partner.percentage / 100));
      const yourEarnings = stats.totalRevenue - partnerEarnings;

      setStatsData({
        totalRentals: stats.totalRentals,
        totalRevenue: stats.totalRevenue,
        partnerEarnings: partnerEarnings,
        yourEarnings: yourEarnings
      });
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      setStatsData({
        totalRentals: 0,
        totalRevenue: 0,
        partnerEarnings: 0,
        yourEarnings: 0
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const resetForm = () => {
  setFormData({
    name: '',
    phone: '',
    percentage: '30',
    notes: '',
    partnerUserId: ''  // ← NUEVO
  });
};

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Atrás</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Socios</Text>
          <View style={{ width: 70 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Atrás</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Socios 👥</Text>
          <Text style={styles.headerSubtitle}>{partners.length} colaboradores</Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setEditingPartner(null);
            setShowForm(true);
          }}
        >
          <Text style={styles.addButtonText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {partners.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No hay socios registrados</Text>
            <Text style={styles.emptySubtext}>Agrega tu primer socio</Text>
          </View>
        ) : (
          partners.map(partner => (
            <View key={partner.id} style={styles.partnerCard}>
              <View style={styles.partnerHeader}>
                <View style={styles.partnerAvatar}>
                  <Text style={styles.partnerAvatarText}>
                    {partner.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.partnerInfo}>
                  <Text style={styles.partnerName}>{partner.name}</Text>
                  <Text style={styles.partnerPhone}>📱 {partner.phone}</Text>
                  {partner.notes && (
                    <Text style={styles.partnerNotes}>📝 {partner.notes}</Text>
                  )}
                </View>
                <View style={styles.partnerPercentage}>
                  <Text style={styles.percentageNumber}>{partner.percentage}%</Text>
                  <Text style={styles.percentageLabel}>Comisión</Text>
                </View>
              </View>

              <View style={styles.partnerActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.statsButton]}
                  onPress={() => handleShowStats(partner)}
                >
                  <Text style={styles.actionButtonText}>📊 Estadísticas</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => {
                    setEditingPartner(partner);
                    setFormData({
  name: partner.name,
  phone: partner.phone,
  percentage: partner.percentage.toString(),
  notes: partner.notes || '',
  partnerUserId: partner.partnerUserId || ''  // ← NUEVO
});
                    setShowForm(true);
                  }}
                >
                  <Text style={styles.actionButtonText}>✏️ Editar</Text>
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
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editingPartner ? '✏️ Editar Socio' : '➕ Nuevo Socio'}
              </Text>

              <Text style={styles.label}>Nombre Completo *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Carlos Méndez"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Teléfono *</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                placeholder="3001234567"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Porcentaje de Comisión (%) *</Text>
              <TextInput
                style={styles.input}
                value={formData.percentage}
                onChangeText={(text) => setFormData({ ...formData, percentage: text })}
                placeholder="30"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
              />
              <Text style={styles.hint}>
                Ejemplo: Si es 30%, el socio recibe $4,500 de un alquiler de $15,000
              </Text>

              <Text style={styles.label}>Notas (Opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                placeholder="Ej: Tiene 2 lavadoras de 20kg"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>ID de Usuario del Socio (Opcional)</Text>
<TextInput
  style={styles.input}
  value={formData.partnerUserId}
  onChangeText={(text) => setFormData({ ...formData, partnerUserId: text })}
  placeholder="Ej: abc123def456"
  placeholderTextColor="#94A3B8"
  autoCapitalize="none"
/>
<Text style={styles.hint}>
  💡 Si el socio tiene cuenta en la app, ingresa su ID para vincular las cuentas y que pueda ver sus lavadoras en tiempo real.
</Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowForm(false);
                    setEditingPartner(null);
                    resetForm();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSavePartner}
                >
                  <Text style={styles.saveButtonText}>
                    {editingPartner ? 'Actualizar' : 'Guardar'}
                  </Text>
                </TouchableOpacity>
              </View>

              {editingPartner && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    setShowForm(false);
                    handleDelete(editingPartner);
                  }}
                >
                  <Text style={styles.deleteButtonText}>🗑️ Eliminar Socio</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Estadísticas */}
      <Modal visible={showStats !== null} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {showStats && (
              <>
                <Text style={styles.modalTitle}>📊 Estadísticas</Text>
                
                <View style={styles.statsHeader}>
                  <View style={styles.statsAvatar}>
                    <Text style={styles.statsAvatarText}>
                      {showStats.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.statsHeaderInfo}>
                    <Text style={styles.statsName}>{showStats.name}</Text>
                    <View style={styles.statsPercentageBadge}>
                      <Text style={styles.statsPercentageText}>{showStats.percentage}%</Text>
                    </View>
                  </View>
                </View>

                {loadingStats ? (
                  <View style={styles.loadingStats}>
                    <ActivityIndicator size="large" color="#EC4899" />
                    <Text style={styles.loadingText}>Cargando estadísticas...</Text>
                  </View>
                ) : statsData && (
                  <>
                    <View style={styles.statsGrid}>
                      <View style={[styles.statCard, { backgroundColor: '#EC4899' }]}>
                        <Text style={styles.statCardIcon}>🔄</Text>
                        <Text style={styles.statCardNumber}>{statsData.totalRentals}</Text>
                        <Text style={styles.statCardLabel}>Alquileres</Text>
                      </View>

                      <View style={[styles.statCard, { backgroundColor: '#3B82F6' }]}>
                        <Text style={styles.statCardIcon}>💰</Text>
                        <Text style={styles.statCardNumber}>${(statsData.totalRevenue/1000).toFixed(0)}k</Text>
                        <Text style={styles.statCardLabel}>Ingresos Totales</Text>
                      </View>

                      <View style={[styles.statCard, { backgroundColor: '#F59E0B' }]}>
                        <Text style={styles.statCardIcon}>💵</Text>
                        <Text style={styles.statCardNumber}>${(statsData.partnerEarnings/1000).toFixed(0)}k</Text>
                        <Text style={styles.statCardLabel}>Para el Socio</Text>
                      </View>

                      <View style={[styles.statCard, { backgroundColor: '#10B981' }]}>
                        <Text style={styles.statCardIcon}>💎</Text>
                        <Text style={styles.statCardNumber}>${(statsData.yourEarnings/1000).toFixed(0)}k</Text>
                        <Text style={styles.statCardLabel}>Para Ti</Text>
                      </View>
                    </View>

                    {statsData.totalRevenue > 0 && (
                      <View style={styles.calculationBox}>
                        <Text style={styles.calculationTitle}>💡 Cálculo de Comisión:</Text>
                        <Text style={styles.calculationText}>
                          • Ingresos totales: ${statsData.totalRevenue.toLocaleString()}
                        </Text>
                        <Text style={styles.calculationText}>
                          • Socio ({showStats.percentage}%): ${statsData.partnerEarnings.toLocaleString()}
                        </Text>
                        <Text style={styles.calculationText}>
                          • Tú ({100 - showStats.percentage}%): ${statsData.yourEarnings.toLocaleString()}
                        </Text>
                      </View>
                    )}

                    {statsData.totalRentals === 0 && (
                      <View style={styles.noDataBox}>
                        <Text style={styles.noDataIcon}>📊</Text>
                        <Text style={styles.noDataText}>
                          No hay alquileres registrados para este socio todavía
                        </Text>
                      </View>
                    )}
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
    backgroundColor: '#EC4899',
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
  empty: {
    paddingTop: 100,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
  },
  partnerCard: {
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
  partnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  partnerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#EC4899',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  partnerAvatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  partnerPhone: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 3,
  },
  partnerNotes: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 3,
  },
  partnerPercentage: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  percentageNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#92400E',
  },
  percentageLabel: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '600',
  },
  partnerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  statsButton: {
    backgroundColor: '#FCE7F3',
  },
  editButton: {
    backgroundColor: '#DBEAFE',
  },
  actionButtonText: {
    fontWeight: '700',
    fontSize: 14,
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
    padding: 20,
    maxHeight: '85%',
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
    marginTop: 14,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 24,
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
    backgroundColor: '#EC4899',
  },
  closeButton: {
  backgroundColor: '#EC4899',
  marginTop: 20,
  padding: 16,
  borderRadius: 12,
  alignItems: 'center',
  width: '100%',
},
closeButtonText: {
  color: 'white',
  fontWeight: '700',
  fontSize: 16,
},
  saveButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  deleteButton: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 15,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  statsAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#EC4899',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  statsAvatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: 'white',
  },
  statsHeaderInfo: {
    flex: 1,
  },
  statsName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  statsPercentageBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statsPercentageText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  loadingStats: {
    padding: 40,
    alignItems: 'center',
  },
  statsGrid: {
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCardIcon: {
    fontSize: 20,
  },
  statCardNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  statCardLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    textAlign: 'right',
  },
  calculationBox: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  calculationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  calculationText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 5,
    lineHeight: 18,
  },
  noDataBox: {
    backgroundColor: '#FEF3C7',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  noDataIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  noDataText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
    fontWeight: '600',
  },
});