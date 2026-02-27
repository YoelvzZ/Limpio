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
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  getScheduled, 
  addScheduled, 
  updateScheduled, 
  deleteScheduled 
} from '../services/firestoreService';
import { 
  scheduleScheduledNotification, 
  cancelScheduledNotifications 
} from '../services/notificationService';

export default function ScheduledScreen({ navigation }) {
  const [scheduled, setScheduled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingScheduled, setEditingScheduled] = useState(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [formData, setFormData] = useState({
    address: '',
    scheduledDate: new Date(Date.now() + 60*60*1000),
    notes: ''
  });

  useEffect(() => {
    loadScheduled();
  }, []);

  const loadScheduled = async () => {
    try {
      setLoading(true);
      const data = await getScheduled();
      data.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
      setScheduled(data);
    } catch (error) {
      console.error('Error al cargar agendados:', error);
      Alert.alert('Error', 'No se pudieron cargar los agendados');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScheduled = async () => {
    if (!formData.address) {
      Alert.alert('Error', 'Ingresa la dirección');
      return;
    }

    if (formData.scheduledDate <= new Date()) {
      Alert.alert('Error', 'La fecha debe ser futura');
      return;
    }

    try {
      const scheduledData = {
        address: formData.address,
        scheduledDate: formData.scheduledDate.toISOString(),
        notes: formData.notes
      };

      if (editingScheduled) {
        await updateScheduled(editingScheduled.id, scheduledData);
        
        // Cancelar notificación anterior y programar nueva
        await cancelScheduledNotifications(editingScheduled.id);
        await scheduleScheduledNotification({ ...scheduledData, id: editingScheduled.id });
        
        Alert.alert('¡Listo! ✅', 'Agendado actualizado');
      } else {
        const newScheduled = await addScheduled(scheduledData);
        
        // Programar notificación para el nuevo agendado
        await scheduleScheduledNotification({ ...scheduledData, id: newScheduled.id });
        
        Alert.alert('¡Genial! 🎉', 'Alquiler agendado correctamente. Recibirás una notificación 40 minutos antes.');
      }

      setShowForm(false);
      setEditingScheduled(null);
      resetForm();
      loadScheduled();
    } catch (error) {
      console.error('Error al guardar agendado:', error);
      Alert.alert('Error', 'No se pudo guardar el agendado');
    }
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Eliminar Agendado',
      '¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteScheduled(item.id);
              
              // Cancelar notificaciones de este agendado
              await cancelScheduledNotifications(item.id);
              
              Alert.alert('¡Eliminado! 🗑️', 'Agendado eliminado correctamente');
              loadScheduled();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar');
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      address: '',
      scheduledDate: new Date(Date.now() + 60*60*1000),
      notes: ''
    });
  };

  const getTimeUntil = (scheduledDate) => {
    const now = new Date();
    const scheduled = new Date(scheduledDate);
    const diff = scheduled - now;

    if (diff < 0) {
      return { text: 'VENCIDO', color: '#DC2626', urgent: true };
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours < 1) {
      return { text: `En ${minutes}m`, color: '#DC2626', urgent: true };
    } else if (hours < 3) {
      return { text: `En ${hours}h ${minutes}m`, color: '#F59E0B', urgent: true };
    } else if (hours < 24) {
      return { text: `En ${hours}h`, color: '#3B82F6', urgent: false };
    } else {
      const days = Math.floor(hours / 24);
      return { text: `En ${days}d`, color: '#6366F1', urgent: false };
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(formData.scheduledDate);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setFormData({ ...formData, scheduledDate: newDate });
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(formData.scheduledDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setFormData({ ...formData, scheduledDate: newDate });
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Atrás</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Agendados</Text>
          <View style={{ width: 70 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366F1" />
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
          <Text style={styles.headerTitle}>Agendados 🔔</Text>
          <Text style={styles.headerSubtitle}>{scheduled.length} programados</Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setEditingScheduled(null);
            setShowForm(true);
          }}
        >
          <Text style={styles.addButtonText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {scheduled.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No hay alquileres agendados</Text>
            <Text style={styles.emptySubtext}>Programa entregas futuras</Text>
          </View>
        ) : (
          scheduled.map(item => {
            const timeUntil = getTimeUntil(item.scheduledDate);

            return (
              <View 
                key={item.id} 
                style={[
                  styles.scheduledCard,
                  timeUntil.urgent && styles.scheduledCardUrgent
                ]}
              >
                <View style={styles.scheduledHeader}>
                  <View style={styles.scheduledLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: timeUntil.color }]}>
                      <Text style={styles.iconText}>🔔</Text>
                    </View>
                    <View style={styles.scheduledInfo}>
                      <Text style={styles.scheduledAddress}>📍 {item.address}</Text>
                      {item.notes && (
                        <Text style={styles.scheduledNotes}>📝 {item.notes}</Text>
                      )}
                    </View>
                  </View>
                  <View style={[styles.timeBadge, { backgroundColor: timeUntil.color }]}>
                    <Text style={styles.timeText}>{timeUntil.text}</Text>
                  </View>
                </View>

                <View style={styles.scheduledDate}>
                  <Text style={styles.dateLabel}>📅 Programado para:</Text>
                  <Text style={styles.dateValue}>
                    {new Date(item.scheduledDate).toLocaleString('es-CO', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>

                <View style={styles.scheduledActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => {
                      setEditingScheduled(item);
                      setFormData({
                        address: item.address,
                        scheduledDate: new Date(item.scheduledDate),
                        notes: item.notes || ''
                      });
                      setShowForm(true);
                    }}
                  >
                    <Text style={styles.actionButtonText}>✏️ Editar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDelete(item)}
                  >
                    <Text style={styles.actionButtonText}>🗑️ Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal de Formulario */}
      <Modal visible={showForm} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editingScheduled ? '✏️ Editar Agendado' : '➕ Agendar Alquiler'}
              </Text>

              <Text style={styles.label}>Dirección *</Text>
              <TextInput
                style={styles.input}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                placeholder="Calle 45 #12-34"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Fecha y Hora de Entrega *</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity 
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    📅 {formData.scheduledDate.toLocaleDateString('es-CO')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.timeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    🕐 {formData.scheduledDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={formData.scheduledDate}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                  minimumDate={new Date()}
                />
              )}

              {showTimePicker && (
                <DateTimePicker
                  value={formData.scheduledDate}
                  mode="time"
                  display="default"
                  onChange={onTimeChange}
                />
              )}

              <Text style={styles.label}>Notas (Opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                placeholder="Ej: Llamar 30 min antes"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowForm(false);
                    setEditingScheduled(null);
                    resetForm();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveScheduled}
                >
                  <Text style={styles.saveButtonText}>
                    {editingScheduled ? 'Actualizar' : 'Agendar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
    backgroundColor: '#6366F1',
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
  scheduledCard: {
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
  scheduledCardUrgent: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  scheduledHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  scheduledLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 24,
  },
  scheduledInfo: {
    flex: 1,
  },
  scheduledAddress: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  scheduledNotes: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 3,
  },
  timeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  timeText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
  },
  scheduledDate: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
  },
  dateLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
    fontWeight: '600',
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    textTransform: 'capitalize',
  },
  scheduledActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#DBEAFE',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
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
    maxHeight: '80%',
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
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateButton: {
    flex: 1,
    backgroundColor: '#EDE9FE',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  timeButton: {
    flex: 1,
    backgroundColor: '#EDE9FE',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  dateButtonText: {
    color: '#6366F1',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 13,
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
    backgroundColor: '#6366F1',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
});