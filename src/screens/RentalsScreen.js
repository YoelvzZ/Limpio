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
  Platform,
  ActivityIndicator
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  getRentals, 
  addRental, 
  finishRental, 
  getMachines,
  addPayment,
  addPendingPayment,
  getPartners
} from '../services/firestoreService';

import { 
  scheduleRentalNotification, 
  cancelRentalNotifications
  } from '../services/notificationService';

export default function RentalsScreen({ navigation }) {
  const [rentals, setRentals] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(null);
  const [showExtendModal, setShowExtendModal] = useState(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);

  // Para selectores de fecha
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showMachineDropdown, setShowMachineDropdown] = useState(false);
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);

  // Para el modal de extender
  const [extendPrice, setExtendPrice] = useState('16000');

  // Formulario
  const [formData, setFormData] = useState({
    addressType: 'Calle',
    address: '',
    startDate: new Date(),
    endDate: new Date(Date.now() + 24*60*60*1000),
    machineId: '',
    partnerId: null,
    price: ''
  });

  // Lista de socios desde Firebase
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    loadData();
    
    const interval = setInterval(() => {
      setRentals(prev => [...prev]);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rentalsData, machinesData, partnersData] = await Promise.all([
        getRentals(),
        getMachines(),
        getPartners()
      ]);
      setRentals(rentalsData);
      setMachines(machinesData);
      setPartners(partnersData);
      const availableMachines = machinesData.filter(m => m.status === 'disponible');
      if (availableMachines.length > 0 && !formData.machineId) {
        setFormData(prev => ({ ...prev, machineId: availableMachines[0].id }));
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
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

      // Cargar la lavadora en el formulario
      setFormData({
        ...formData,
        machineId: machine.id,
        partnerId: null
      });

      Alert.alert(
        '¡Escaneado! ✅',
        `Lavadora #${machine.number} - ${machine.brand} (${machine.capacity}kg)\n\nAhora completa los datos del alquiler.`,
        [
          {
            text: 'Continuar',
            onPress: () => {
              setShowQRScanner(false);
              setShowForm(true);
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

  const handleAddRental = async () => {
  if (!formData.address || (!formData.machineId && !formData.partnerId) || !formData.price) {
    Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
    return;
  }

  try {
    const rentalData = {
      addressType: formData.addressType,
      address: formData.address,
      startDate: formData.startDate.toISOString(),
      endDate: formData.endDate.toISOString(),
      machineId: formData.machineId || null,
      partnerId: formData.partnerId || null,
      price: Number(formData.price),
      status: 'activo'
    };

    const newRental = await addRental(rentalData);
    
    if (formData.machineId) {
      const { updateMachine } = require('../services/firestoreService');
      await updateMachine(formData.machineId, { status: 'alquilada' });
    }

    // NUEVO: Programar notificaciones para este alquiler
    const machine = machines.find(m => m.id === formData.machineId);
    await scheduleRentalNotification(
      { ...rentalData, id: newRental.id }, 
      machine?.number || 'Sin número'
    );

    Alert.alert('Éxito', 'Alquiler creado correctamente');
    setShowForm(false);
    setShowQRScanner(false);
    resetForm();
    loadData();
  } catch (error) {
    console.error('Error al crear alquiler:', error);
    Alert.alert('Error', 'No se pudo crear el alquiler');
  }
};

  const handleExtendRental = async () => {
    if (!showExtendModal || !extendPrice) {
      Alert.alert('Error', 'Ingresa el precio a agregar');
      return;
    }

    try {
      const rental = showExtendModal;
      const { updateDoc, doc } = require('firebase/firestore');
      const { db, auth } = require('../services/firebase');
      const { extendRental } = require('../services/firestoreService');
      
      const newEndDate = new Date(new Date(rental.endDate).getTime() + 24*60*60*1000).toISOString();
      const newPrice = rental.price + Number(extendPrice);

      const rentalRef = doc(db, 'users', auth.currentUser.uid, 'rentals', rental.id);
      await updateDoc(rentalRef, {
        endDate: newEndDate,
        price: newPrice
      });

      // Actualizar estadísticas de la lavadora si existe
      if (rental.machineId) {
        await extendRental(rental.id, rental.machineId, Number(extendPrice));
      }

      Alert.alert('Éxito', `24 horas agregadas. Nuevo precio: $${newPrice.toLocaleString()}`);
      setShowExtendModal(null);
      setExtendPrice('16000');
      loadData();
    } catch (error) {
      Alert.alert('Error', 'No se pudo extender el alquiler');
    }
  };

  const handleFinishRental = async (paid) => {
  if (!showFinishModal) return;

  try {
    const rental = showFinishModal;
    const machine = machines.find(m => m.id === rental.machineId);

    if (paid) {
      // VERIFICAR SI HAY SOCIO INVOLUCRADO
      if (rental.partnerId) {
        const partner = partners.find(p => p.id === rental.partnerId);
        
        if (partner) {
          // CALCULAR DIVISIÓN
          const partnerAmount = Math.floor(rental.price * (partner.percentage / 100));
          const yourAmount = rental.price - partnerAmount;

          // TU PARTE
          await addPayment({
            amount: yourAmount,
            date: new Date().toISOString().split('T')[0],
            machineNumber: machine?.number || 'Socio',
            address: `${rental.addressType} ${rental.address}`,
            type: 'pagado',
            notes: `Tu ${100 - partner.percentage}% (Socio: ${partner.name})`
          });

          // PARTE DEL SOCIO (guardar para estadísticas)
          // Nota: Esta función la crearemos después en firestoreService
          console.log(`💰 Socio ${partner.name} gana: $${partnerAmount}`);
          
          Alert.alert(
            '💰 Pago Dividido',
            `Total: $${rental.price.toLocaleString()}\n\n` +
            `• Tú (${100 - partner.percentage}%): $${yourAmount.toLocaleString()}\n` +
            `• ${partner.name} (${partner.percentage}%): $${partnerAmount.toLocaleString()}`
          );
        } else {
          // SOCIO NO ENCONTRADO - TODO PARA TI
          await addPayment({
            amount: rental.price,
            date: new Date().toISOString().split('T')[0],
            machineNumber: machine?.number || 'Socio',
            address: `${rental.addressType} ${rental.address}`,
            type: 'pagado'
          });
        }
      } else {
        // SIN SOCIO - TODO PARA TI
        await addPayment({
          amount: rental.price,
          date: new Date().toISOString().split('T')[0],
          machineNumber: machine?.number || 'Socio',
          address: `${rental.addressType} ${rental.address}`,
          type: 'pagado'
        });
      }
    } else {
      // CLIENTE DEBE
      await addPendingPayment({
        clientName: 'Cliente',
        address: `${rental.addressType} ${rental.address}`,
        amount: rental.price,
        machineNumber: machine?.number || 'Socio',
        date: new Date().toISOString().split('T')[0],
        partnerId: rental.partnerId || null
      });
    }

    await finishRental(rental.id, paid);

    if (rental.machineId) {
      const { updateMachine } = require('../services/firestoreService');
      await updateMachine(rental.machineId, { status: 'disponible' });
    }

    // Cancelar notificaciones
    await cancelRentalNotifications(rental.id);

    if (!paid || !rental.partnerId) {
      Alert.alert('Éxito', paid ? 'Pago registrado' : 'Agregado a pendientes');
    }
    
    setShowFinishModal(null);
    loadData();
  } catch (error) {
    console.error('Error al finalizar:', error);
    Alert.alert('Error', 'No se pudo finalizar el alquiler');
  }
};

  const resetForm = () => {
  const availableMachines = machines
    .filter(m => m.status === 'disponible')
    .sort((a, b) => Number(a.number) - Number(b.number));
    setFormData({
      addressType: 'Calle',
      address: '',
      startDate: new Date(),
      endDate: new Date(Date.now() + 24*60*60*1000),
      machineId: availableMachines[0]?.id || '',
      partnerId: null,
      price: ''
    });
  };

  const getTimeRemaining = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;

    if (diff <= 0) {
      return { text: 'VENCIDO', color: '#DC2626' };
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const color = hours < 2 ? '#DC2626' : hours < 6 ? '#F59E0B' : '#10B981';

    return { text: `${hours}h ${minutes}m`, color };
  };

  const formatDateTime = (date) => {
    return date.toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const onStartDateChange = (event, selectedDate) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(formData.startDate);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setFormData({ ...formData, startDate: newDate });
    }
  };

  const onStartTimeChange = (event, selectedTime) => {
    setShowStartTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(formData.startDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setFormData({ ...formData, startDate: newDate });
    }
  };

  const onEndDateChange = (event, selectedDate) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(formData.endDate);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setFormData({ ...formData, endDate: newDate });
    }
  };

  const onEndTimeChange = (event, selectedTime) => {
    setShowEndTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(formData.endDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setFormData({ ...formData, endDate: newDate });
    }
  };

  const availableMachines = machines
  .filter(m => m.status === 'disponible')
  .sort((a, b) => Number(a.number) - Number(b.number));
const selectedMachine = machines.find(m => m.id === formData.machineId);
const selectedPartner = partners.find(p => p.id === formData.partnerId);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Atrás</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Alquileres</Text>
          <View style={{ width: 70 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0691b4ff" />
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
          <Text style={styles.headerTitle}>Alquileres</Text>
          <Text style={styles.headerSubtitle}>{rentals.length} activos</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.qrButton}
            onPress={handleOpenQRScanner}
          >
            <Text style={styles.qrButtonText}>📱</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            <Text style={styles.addButtonText}>+ Nuevo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {rentals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>📦</Text>
            <Text style={styles.emptyTitle}>No hay alquileres activos</Text>
            <Text style={styles.emptySubtitle}>Crea tu primer alquiler</Text>
          </View>
        ) : (
          rentals.map(rental => {
            const machine = machines.find(m => m.id === rental.machineId);
            const timeData = getTimeRemaining(rental.endDate);

            return (
              <View key={rental.id} style={styles.rentalCard}>
                <View style={styles.rentalHeader}>
                  <View style={styles.rentalInfo}>
                    <Text style={styles.rentalAddress}>
                      {rental.addressType} {rental.address}
                    </Text>
                    <Text style={styles.rentalMachine}>
                      {rental.machineId ? `Lavadora #${machine?.number} - ${machine?.brand}` : 'Lavadora de Socio'}
                    </Text>
                    <View style={styles.rentalDates}>
                      <Text style={styles.dateText}>
                        📅 {formatDateTime(new Date(rental.startDate))}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rentalPrice}>
                    <Text style={styles.priceAmount}>${rental.price.toLocaleString()}</Text>
                    <View style={[styles.timeRemaining, { backgroundColor: timeData.color }]}>
                      <Text style={styles.timeText}>⏱️ {timeData.text}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.rentalActions}>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.extendButton]}
                    onPress={() => {
                      setShowExtendModal(rental);
                      setExtendPrice('16000');
                    }}
                  >
                    <Text style={styles.actionButtonText}>⏰ +24h</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.actionButton, styles.finishButton]}
                    onPress={() => setShowFinishModal(rental)}
                  >
                    <Text style={styles.actionButtonText}>✅ Finalizar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
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

      {/* Modal de Formulario */}
      <Modal visible={showForm} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Nuevo Alquiler</Text>

              <Text style={styles.label}>Tipo de Dirección</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                {['Calle', 'Carrera', 'Torre', 'Diagonal', 'Transversal', 'Otro'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      formData.addressType === type && styles.typeButtonActive
                    ]}
                    onPress={() => setFormData({ ...formData, addressType: type })}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      formData.addressType === type && styles.typeButtonTextActive
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Dirección *</Text>
              <TextInput
                style={styles.input}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                placeholder="45 #12-34"
              />

              <Text style={styles.label}>Fecha y Hora de Entrega *</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity 
                  style={styles.dateButton}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    📅 {formData.startDate.toLocaleDateString('es-CO')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.timeButton}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    🕐 {formData.startDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>

              {showStartDatePicker && (
                <DateTimePicker
                  value={formData.startDate}
                  mode="date"
                  display="default"
                  onChange={onStartDateChange}
                />
              )}

              {showStartTimePicker && (
                <DateTimePicker
                  value={formData.startDate}
                  mode="time"
                  display="default"
                  onChange={onStartTimeChange}
                />
              )}

              <Text style={styles.label}>Fecha y Hora de Retiro *</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity 
                  style={styles.dateButton}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    📅 {formData.endDate.toLocaleDateString('es-CO')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.timeButton}
                  onPress={() => setShowEndTimePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    🕐 {formData.endDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>

              {showEndDatePicker && (
                <DateTimePicker
                  value={formData.endDate}
                  mode="date"
                  display="default"
                  onChange={onEndDateChange}
                  minimumDate={formData.startDate}
                />
              )}

              {showEndTimePicker && (
                <DateTimePicker
                  value={formData.endDate}
                  mode="time"
                  display="default"
                  onChange={onEndTimeChange}
                />
              )}

              <Text style={styles.label}>Seleccionar Lavadora Propia</Text>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowMachineDropdown(!showMachineDropdown)}
              >
                <Text style={styles.dropdownText}>
                  {selectedMachine ? `#${selectedMachine.number} - ${selectedMachine.brand}` : 'Ninguna (usar socio)'}
                </Text>
                <Text style={styles.dropdownArrow}>{showMachineDropdown ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showMachineDropdown && (
  <ScrollView style={styles.dropdownList} nestedScrollEnabled={true}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setFormData({ ...formData, machineId: null });
                      setShowMachineDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>Ninguna (usar socio)</Text>
                  </TouchableOpacity>
                  {availableMachines.map(machine => (
                    <TouchableOpacity
                      key={machine.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormData({ ...formData, machineId: machine.id, partnerId: null });
                        setShowMachineDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>
                        #{machine.number} - {machine.brand} ({machine.capacity}kg)
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={styles.label}>O Seleccionar Socio</Text>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowPartnerDropdown(!showPartnerDropdown)}
              >
                <Text style={styles.dropdownText}>
                  {selectedPartner ? selectedPartner.name : 'Ninguno'}
                </Text>
                <Text style={styles.dropdownArrow}>{showPartnerDropdown ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showPartnerDropdown && (
                <View style={styles.dropdownList}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setFormData({ ...formData, partnerId: null });
                      setShowPartnerDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>Ninguno</Text>
                  </TouchableOpacity>
                  {partners.map(partner => (
                    <TouchableOpacity
                      key={partner.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormData({ ...formData, partnerId: partner.id, machineId: null });
                        setShowPartnerDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{partner.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>Precio (COP) *</Text>
              <TextInput
                style={styles.input}
                value={formData.price}
                onChangeText={(text) => setFormData({ ...formData, price: text })}
                keyboardType="numeric"
                placeholder="16000"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowForm(false);
                    setShowMachineDropdown(false);
                    setShowPartnerDropdown(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleAddRental}
                >
                  <Text style={styles.saveButtonText}>Crear Alquiler</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Extender */}
      <Modal visible={showExtendModal !== null} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 400 }]}>
            <Text style={styles.modalTitle}>Extender Alquiler</Text>
            <Text style={styles.extendQuestion}>Se agregarán 24 horas más</Text>

            <Text style={styles.label}>¿Cuánto cobrará? (COP)</Text>
            <TextInput
              style={styles.input}
              value={extendPrice}
              onChangeText={setExtendPrice}
              keyboardType="numeric"
              placeholder="16000"
            />

            <TouchableOpacity 
              style={[styles.finishButton, styles.confirmButton]}
              onPress={handleExtendRental}
            >
              <Text style={styles.finishButtonText}>✅ Confirmar Extensión</Text>
            </TouchableOpacity>

            <TouchableOpacity 
  style={styles.cancelButton}
  onPress={() => {
    setShowExtendModal(null);
    setExtendPrice('16000');
  }}
>
  <Text style={styles.cancelButtonText}>Cancelar</Text>
</TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Finalizar */}
      <Modal visible={showFinishModal !== null} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 350 }]}>
            <Text style={styles.modalTitle}>Finalizar Alquiler</Text>
            <Text style={styles.finishQuestion}>¿El cliente pagó el servicio?</Text>

        <TouchableOpacity 
          style={[styles.finishButton, styles.paidButton]}
          onPress={() => handleFinishRental(true)}
        >
          <Text style={styles.finishButtonText}>✅ Cliente Pagó</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.finishButton, styles.debtButton]}
          onPress={() => handleFinishRental(false)}
        >
          <Text style={styles.finishButtonText}>⏰ Cliente Debe</Text>
        </TouchableOpacity>

        <TouchableOpacity 
  style={styles.cancelButton}
  onPress={() => setShowFinishModal(null)}
>
  <Text style={styles.cancelButtonText}>Cancelar</Text>
</TouchableOpacity>
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
backgroundColor: '#0691b4ff',
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
headerButtons: {
flexDirection: 'row',
gap: 10,
},
qrButton: {
width: 44,
height: 44,
borderRadius: 12,
backgroundColor: 'rgba(255,255,255,0.25)',
justifyContent: 'center',
alignItems: 'center',
},
qrButtonText: {
fontSize: 22,
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
padding: 15,
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
padding: 60,
alignItems: 'center',
},
emptyText: {
fontSize: 64,
marginBottom: 15,
},
emptyTitle: {
fontSize: 18,
fontWeight: 'bold',
color: '#6B7280',
marginBottom: 5,
},
emptySubtitle: {
fontSize: 14,
color: '#9CA3AF',
},
rentalCard: {
backgroundColor: 'white',
borderRadius: 15,
padding: 15,
marginBottom: 15,
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.1,
shadowRadius: 3,
elevation: 3,
},
rentalHeader: {
flexDirection: 'row',
justifyContent: 'space-between',
marginBottom: 15,
},
rentalInfo: {
flex: 1,
},
rentalAddress: {
fontSize: 18,
fontWeight: 'bold',
color: '#1F2937',
marginBottom: 5,
},
rentalMachine: {
fontSize: 14,
color: '#6B7280',
marginBottom: 8,
},
rentalDates: {
marginTop: 5,
},
dateText: {
fontSize: 12,
color: '#9CA3AF',
},
rentalPrice: {
alignItems: 'flex-end',
},
priceAmount: {
fontSize: 24,
fontWeight: 'bold',
color: '#10B981',
marginBottom: 8,
},
timeRemaining: {
paddingHorizontal: 12,
paddingVertical: 6,
borderRadius: 20,
},
timeText: {
color: 'white',
fontSize: 12,
fontWeight: 'bold',
},
rentalActions: {
flexDirection: 'row',
gap: 10,
},
actionButton: {
flex: 1,
padding: 12,
borderRadius: 10,
alignItems: 'center',
},
extendButton: {
backgroundColor: '#DBEAFE',
},
finishButton: {
backgroundColor: '#D1FAE5',
},
actionButtonText: {
fontWeight: 'bold',
fontSize: 14,
},
// Estilos del escáner QR
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
borderColor: '#0691b4ff',
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
// Resto de estilos (modales)
modalOverlay: {
flex: 1,
backgroundColor: 'rgba(0,0,0,0.5)',
justifyContent: 'center',
padding: 20,
},
modalContent: {
backgroundColor: 'white',
borderRadius: 20,
padding: 20,
maxHeight: '90%',
},
modalTitle: {
fontSize: 24,
fontWeight: 'bold',
marginBottom: 20,
textAlign: 'center',
color: '#1F2937',
},
label: {
fontSize: 14,
fontWeight: 'bold',
color: '#374151',
marginBottom: 8,
marginTop: 15,
},
input: {
borderWidth: 1,
borderColor: '#D1D5DB',
borderRadius: 10,
padding: 12,
fontSize: 16,
backgroundColor: '#F9FAFB',
},
typeScroll: {
marginBottom: 10,
},
typeButton: {
paddingHorizontal: 15,
paddingVertical: 10,
borderRadius: 8,
borderWidth: 2,
borderColor: '#E5E7EB',
marginRight: 8,
backgroundColor: '#F9FAFB',
},
typeButtonActive: {
borderColor: '#0691b4ff',
backgroundColor: '#E0F2FE',
},
typeButtonText: {
color: '#6B7280',
fontWeight: 'bold',
fontSize: 14,
},
typeButtonTextActive: {
color: '#0691b4ff',
},
dateTimeRow: {
flexDirection: 'row',
gap: 10,
},
dateButton: {
flex: 1,
backgroundColor: '#E0F2FE',
padding: 15,
borderRadius: 10,
borderWidth: 2,
borderColor: '#0691b4ff',
},
timeButton: {
flex: 1,
backgroundColor: '#E0F2FE',
padding: 15,
borderRadius: 10,
borderWidth: 2,
borderColor: '#0691b4ff',
},
dateButtonText: {
color: '#0691b4ff',
fontWeight: 'bold',
textAlign: 'center',
},
dropdown: {
borderWidth: 1,
borderColor: '#D1D5DB',
borderRadius: 10,
padding: 15,
backgroundColor: '#F9FAFB',
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
},
dropdownText: {
fontSize: 16,
color: '#374151',
},
dropdownArrow: {
fontSize: 12,
color: '#6B7280',
},
dropdownList: {
  borderWidth: 1,
  borderColor: '#D1D5DB',
  borderRadius: 10,
  marginTop: 5,
  backgroundColor: 'white',
  maxHeight: 200,
  zIndex: 1000,
},
dropdownItem: {
padding: 15,
borderBottomWidth: 1,
borderBottomColor: '#F3F4F6',
},
dropdownItemText: {
fontSize: 14,
color: '#374151',
},
modalButtons: {
flexDirection: 'row',
marginTop: 20,
marginBottom: 10,
gap: 10,
},
modalButton: {
flex: 1,
padding: 15,
borderRadius: 10,
alignItems: 'center',
},
cancelButton: {
  backgroundColor: '#F3F4F6',
  marginTop: 10,
  padding: 15,
  borderRadius: 10,
  alignItems: 'center',
  width: '100%',
},
cancelButtonText: {
  color: '#374151',
  fontWeight: 'bold',
  fontSize: 16,
},
saveButton: {
backgroundColor: '#0691b4ff',
},
saveButtonText: {
color: 'white',
fontWeight: 'bold',
fontSize: 16,
},
extendQuestion: {
fontSize: 16,
textAlign: 'center',
color: '#6B7280',
marginBottom: 20,
},
finishQuestion: {
fontSize: 16,
textAlign: 'center',
color: '#6B7280',
marginBottom: 20,
},
paidButton: {
backgroundColor: '#10B981',
padding: 15,
borderRadius: 10,
marginBottom: 10,
},
debtButton: {
backgroundColor: '#F59E0B',
padding: 15,
borderRadius: 10,
marginBottom: 10,
},
confirmButton: {
backgroundColor: '#0691b4ff',
padding: 15,
borderRadius: 10,
marginBottom: 10,
},
finishButtonText: {
color: 'white',
fontWeight: 'bold',
fontSize: 16,
textAlign: 'center',
},
});