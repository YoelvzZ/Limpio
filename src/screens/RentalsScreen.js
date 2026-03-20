import React, { useState, useEffect } from "react";
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
} from "react-native";
import { CameraView, Camera } from "expo-camera";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  getRentals,
  addRentalWithSync,
  finishRentalWithSync,
  getMachines,
  addPayment,
  addPendingPayment,
  addPendingPaymentWithSync,
  getPartners,
  getSharedPartnerMachines,
} from "../services/firestoreService";

import {
  scheduleRentalNotification,
  cancelRentalNotifications,
} from "../services/notificationService";

export default function RentalsScreen({ navigation }) {
  const [rentals, setRentals] = useState([]);
  const [machines, setMachines] = useState([]);
  const [sharedMachines, setSharedMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(null);
  const [showExtendModal, setShowExtendModal] = useState(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showMachineDropdown, setShowMachineDropdown] = useState(false);
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);

  const [extendPrice, setExtendPrice] = useState("16000");

  const [formData, setFormData] = useState({
    addressType: "Calle",
    address: "",
    startDate: new Date(),
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    machineId: "",
    partnerId: null,
    partnerName: null,
    machineOwnerUserId: null,
    price: "",
  });

  const [partners, setPartners] = useState([]);

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      setRentals((prev) => [...prev]);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rentalsData, machinesData, partnersData, sharedMachinesData] =
        await Promise.all([
          getRentals(),
          getMachines(),
          getPartners(),
          getSharedPartnerMachines(),
        ]);

      setRentals(rentalsData);
      setMachines(machinesData);
      setPartners(partnersData);
      setSharedMachines(sharedMachinesData);

      const availableMachines = machinesData.filter(
        (m) => m.status === "disponible",
      );
      if (availableMachines.length > 0 && !formData.machineId) {
        setFormData((prev) => ({ ...prev, machineId: availableMachines[0].id }));
      }
    } catch (error) {
      console.error("Error al cargar datos:", error);
      Alert.alert("Error", "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === "granted");
    return status === "granted";
  };

  const handleOpenQRScanner = async () => {
    const granted = await requestCameraPermission();

    if (!granted) {
      Alert.alert(
        "Permiso Necesario",
        "Necesitamos acceso a la cámara para escanear códigos QR.",
        [{ text: "OK" }],
      );
      return;
    }

    setScanned(false);
    setShowQRScanner(true);
  };

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;

    setScanned(true);
    const machine = machines.find((m) => m.id === data);

    if (machine) {
      if (machine.status !== "disponible") {
        Alert.alert(
          "Lavadora No Disponible",
          `La lavadora #${machine.number} está actualmente ${machine.status}.`,
          [
            { text: "Buscar Otra", onPress: () => setScanned(false) },
            { text: "Cerrar", onPress: () => setShowQRScanner(false) },
          ],
        );
        return;
      }

      setFormData((prev) => ({
        ...prev,
        machineId: machine.id,
        partnerId: null,
        partnerName: null,
        machineOwnerUserId: null,
      }));

      Alert.alert(
        "¡Escaneado! ✅",
        `Lavadora #${machine.number} - ${machine.brand} (${machine.capacity}kg)\n\nAhora completa los datos del alquiler.`,
        [
          {
            text: "Continuar",
            onPress: () => {
              setShowQRScanner(false);
              setShowForm(true);
            },
          },
        ],
      );
    } else {
      Alert.alert(
        "QR No Reconocido",
        "Este código QR no corresponde a ninguna lavadora registrada.",
        [
          { text: "Escanear Otro", onPress: () => setScanned(false) },
          { text: "Cerrar", onPress: () => setShowQRScanner(false) },
        ],
      );
    }
  };

  const handleAddRental = async () => {
    if (
      !formData.address ||
      (!formData.machineId && !formData.partnerId) ||
      !formData.price
    ) {
      Alert.alert("Error", "Por favor completa todos los campos obligatorios");
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
        partnerName: formData.partnerName || null,
        machineOwnerUserId: formData.machineOwnerUserId || null,
        price: Number(formData.price),
        status: "activo",
      };

      const newRental = await addRentalWithSync(rentalData);

      if (formData.machineId && !formData.machineOwnerUserId) {
        await updateMachine(formData.machineId, { status: "alquilada" });
      }

      const machine = machines.find((m) => m.id === formData.machineId);
      await scheduleRentalNotification(
        { ...rentalData, id: newRental.id },
        machine?.number || "Sin número",
      );

      Alert.alert("Éxito", "Alquiler creado correctamente");
      setShowForm(false);
      setShowQRScanner(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error al crear alquiler:", error);
      Alert.alert("Error", error.message || "No se pudo crear el alquiler");
    }
  };

  const handleExtendRental = async () => {
    if (!showExtendModal || !extendPrice) {
      Alert.alert("Error", "Ingresa el precio a agregar");
      return;
    }

    try {
      const rental = showExtendModal;
      const { updateDoc, doc } = require("firebase/firestore");
      const { db, auth } = require("../services/firebase");

      const newEndDate = new Date(
        new Date(rental.endDate).getTime() + 24 * 60 * 60 * 1000,
      ).toISOString();
      const newPrice = rental.price + Number(extendPrice);

      const rentalRef = doc(db, "users", auth.currentUser.uid, "rentals", rental.id);
      await updateDoc(rentalRef, {
        endDate: newEndDate,
        price: newPrice,
      });

      if (rental.machineId && !rental.isSharedViewOnly) {
        await extendRental(rental.id, rental.machineId, Number(extendPrice));
      }

      Alert.alert(
        "Éxito",
        `24 horas agregadas. Nuevo precio: $${newPrice.toLocaleString()}`,
      );
      setShowExtendModal(null);
      setExtendPrice("16000");
      loadData();
    } catch (error) {
      Alert.alert("Error", "No se pudo extender el alquiler");
    }
  };

  const handleFinishRental = async (paid) => {
  if (!showFinishModal) return;

  try {
    const rental = showFinishModal;
    const machine = machines.find((m) => m.id === rental.machineId);

    if (paid) {
      // VERIFICAR SI HAY SOCIO INVOLUCRADO
      if (rental.partnerId) {
        const partner = partners.find((p) => p.id === rental.partnerId);

        if (partner) {
          // CALCULAR DIVISIÓN
          const partnerAmount = Math.floor(
            rental.price * (partner.percentage / 100),
          );
          const yourAmount = rental.price - partnerAmount;

          // TU PARTE
          await addPayment({
            amount: yourAmount,
            date: new Date().toISOString().split("T")[0],
            machineNumber: machine?.number || "Socio",
            address: `${rental.addressType} ${rental.address}`,
            type: "pagado",
            notes: `Tu ${100 - partner.percentage}% (Socio: ${partner.name})`,
          });

          Alert.alert(
            "💰 Pago Dividido",
            `Total: $${rental.price.toLocaleString()}\n\n` +
              `• Tú (${100 - partner.percentage}%): $${yourAmount.toLocaleString()}\n` +
              `• ${partner.name} (${partner.percentage}%): $${partnerAmount.toLocaleString()}`,
          );
        } else {
          // SOCIO NO ENCONTRADO - TODO PARA TI
          await addPayment({
            amount: rental.price,
            date: new Date().toISOString().split("T")[0],
            machineNumber: machine?.number || "Socio",
            address: `${rental.addressType} ${rental.address}`,
            type: "pagado",
          });
        }
      } else {
        // SIN SOCIO - TODO PARA TI
        await addPayment({
          amount: rental.price,
          date: new Date().toISOString().split("T")[0],
          machineNumber: machine?.number || "Socio",
          address: `${rental.addressType} ${rental.address}`,
          type: "pagado",
        });
      }
    } else {
      const pendingPayload = {
        clientName: "Cliente",
        address: `${rental.addressType} ${rental.address}`,
        amount: rental.price,
        machineNumber: machine?.number || "Socio",
        date: new Date().toISOString().split("T")[0],
        partnerId: rental.partnerId || null,
        linkedUserId: rental.linkedUserId || null,
        linkedRentalId: rental.linkedRentalId || null,
      };

      if (rental.partnerId) {
        const partner = partners.find((p) => p.id === rental.partnerId);
        if (partner) {
          const partnerAmount = Math.floor(
            rental.price * (partner.percentage / 100),
          );
          pendingPayload.ownerAmount = rental.price - partnerAmount;
          pendingPayload.partnerAmount = partnerAmount;
          pendingPayload.partnerName = partner.name;
          pendingPayload.partnerPercentage = partner.percentage;
        }
      }

      const savePending =
        addPendingPaymentWithSync || addPendingPayment;
      await savePending(pendingPayload);
    }

    await finishRentalWithSync(rental.id, paid);

    // Cancelar notificaciones
    await cancelRentalNotifications(rental.id);

    if (!paid || !rental.partnerId) {
      Alert.alert(
        "Éxito",
        paid ? "Pago registrado" : "Agregado a pendientes",
      );
    }

    setShowFinishModal(null);
    loadData();
  } catch (error) {
    console.error("Error al finalizar:", error);
    Alert.alert("Error", "No se pudo finalizar el alquiler");
  }
};

  const resetForm = () => {
    const availableMachines = machines
      .filter((m) => m.status === "disponible")
      .sort((a, b) => Number(a.number) - Number(b.number));

    setFormData({
      addressType: "Calle",
      address: "",
      startDate: new Date(),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      machineId: availableMachines[0]?.id || "",
      partnerId: null,
      partnerName: null,
      machineOwnerUserId: null,
      price: "",
    });
  };

  const getTimeRemaining = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;

    if (diff <= 0) return { text: "VENCIDO", color: "#DC2626" };

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const color = hours < 2 ? "#DC2626" : hours < 6 ? "#F59E0B" : "#10B981";

    return { text: `${hours}h ${minutes}m`, color };
  };

  const formatDateTime = (date) => {
    return date.toLocaleString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
    .filter((m) => m.status === "disponible")
    .sort((a, b) => Number(a.number) - Number(b.number));

  const selectedMachine =
    machines.find((m) => m.id === formData.machineId) ||
    sharedMachines.find(
      (m) =>
        m.id === formData.machineId &&
        m.ownerUserId === formData.machineOwnerUserId,
    );

  const selectedPartner = partners.find((p) => p.id === formData.partnerId);
  
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
          <ActivityIndicator size="large" color="#2563EB" />
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
          <Text style={styles.headerTitle}>Alquileres 🚚</Text>
          <Text style={styles.headerSubtitle}>{rentals.length} activos</Text>
        </View>

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

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.qrButton} onPress={handleOpenQRScanner}>
          <Text style={styles.qrButtonText}>📷 Escanear QR</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {rentals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🧺</Text>
            <Text style={styles.emptyTitle}>No hay alquileres activos</Text>
            <Text style={styles.emptySubtitle}>Crea tu primer alquiler</Text>
          </View>
        ) : (
          rentals.map((rental) => {
            const machine = machines.find((m) => m.id === rental.machineId);
            const timeData = getTimeRemaining(rental.endDate);

            return (
              <View key={rental.id} style={styles.rentalCard}>
                <View style={styles.rentalHeader}>
                  <View style={styles.rentalInfo}>
                    <Text style={styles.rentalAddress}>
                      {rental.addressType} {rental.address}
                    </Text>
                    <Text style={styles.rentalMachine}>
                      {rental.machineId
                        ? `Lavadora #${machine?.number || rental.machineId} - ${
                            machine?.brand || rental.partnerName || "Socio"
                          }`
                        : "Lavadora de Socio"}
                    </Text>
                    <View style={styles.rentalDates}>
                      <Text style={styles.dateText}>
                        📅 {formatDateTime(new Date(rental.startDate))}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rentalPrice}>
                    <Text style={styles.priceAmount}>
                      ${Number(rental.price || 0).toLocaleString()}
                    </Text>
                    <View
                      style={[styles.timeRemaining, { backgroundColor: timeData.color }]}
                    >
                      <Text style={styles.timeText}>⏱️ {timeData.text}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.rentalActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.extendButton,
                      rental.isSharedViewOnly && styles.disabledAction,
                    ]}
                    disabled={rental.isSharedViewOnly}
                    onPress={() => {
                      setShowExtendModal(rental);
                      setExtendPrice("16000");
                    }}
                  >
                    <Text style={styles.actionButtonText}>⏰ +24h</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.finishButton,
                      rental.isSharedViewOnly && styles.disabledAction,
                    ]}
                    disabled={rental.isSharedViewOnly}
                    onPress={() => setShowFinishModal(rental)}
                  >
                    <Text style={styles.actionButtonText}>
                      {rental.isSharedViewOnly ? "👁️ Solo lectura" : "✅ Finalizar"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal QR */}
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
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
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

      {/* Modal Formulario */}
      <Modal visible={showForm} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Nuevo Alquiler</Text>

              <Text style={styles.label}>Tipo de Dirección</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {["Calle", "Carrera", "Torre", "Diagonal", "Transversal", "Otro"].map(
                  (type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        formData.addressType === type && styles.typeButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, addressType: type })}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          formData.addressType === type &&
                            styles.typeButtonTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </ScrollView>              <Text style={styles.label}>Dirección *</Text>
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
                    📅 {formData.startDate.toLocaleDateString("es-CO")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    🕐{" "}
                    {formData.startDate.toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
                    📅 {formData.endDate.toLocaleDateString("es-CO")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setShowEndTimePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    🕐{" "}
                    {formData.endDate.toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
                  {selectedMachine
                    ? `#${selectedMachine.number} - ${selectedMachine.brand}`
                    : "Ninguna (usar socio)"}
                </Text>
                <Text style={styles.dropdownArrow}>
                  {showMachineDropdown ? "▲" : "▼"}
                </Text>
              </TouchableOpacity>

              {showMachineDropdown && (
                <ScrollView style={styles.dropdownList} nestedScrollEnabled={true}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setFormData({
                        ...formData,
                        machineId: null,
                        machineOwnerUserId: null,
                        partnerName: null,
                      });
                      setShowMachineDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>
                      Ninguna (usar socio)
                    </Text>
                  </TouchableOpacity>
                  {availableMachines.map((machine) => (
                    <TouchableOpacity
                      key={machine.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormData({
                          ...formData,
                          machineId: machine.id,
                          partnerId: null,
                          machineOwnerUserId: null,
                          partnerName: null,
                        });
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
                  {selectedPartner ? selectedPartner.name : "Ninguno"}
                </Text>
                <Text style={styles.dropdownArrow}>
                  {showPartnerDropdown ? "▲" : "▼"}
                </Text>
              </TouchableOpacity>

              {showPartnerDropdown && (
                <View style={styles.dropdownList}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setFormData({
                        ...formData,
                        partnerId: null,
                        machineId: null,
                        partnerName: null,
                        machineOwnerUserId: null,
                      });
                      setShowPartnerDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>Ninguno</Text>
                  </TouchableOpacity>
                  {partners
                    .filter(
                      (partner) =>
                        partner.status === "active" && partner.canUsePartnerMachines,
                    )
                    .map((partner) => (
                      <TouchableOpacity
                        key={partner.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          const partnerMachines = sharedMachines.filter(
                            (machine) => machine.ownerPartnerId === partner.id,
                          );
                          setFormData({
                            ...formData,
                            partnerId: partner.id,
                            partnerName: partner.name,
                            machineId: partnerMachines[0]?.id || null,
                            machineOwnerUserId:
                              partnerMachines[0]?.ownerUserId || null,
                          });
                          setShowPartnerDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{partner.name}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              )}

              {formData.partnerId && (
                <>
                  <Text style={styles.label}>Lavadora de Socio</Text>
                  <View style={styles.dropdownList}>
                    {sharedMachines
                      .filter((machine) => machine.ownerPartnerId === formData.partnerId)
                      .map((machine) => (
                        <TouchableOpacity
                          key={`${machine.ownerUserId}_${machine.id}`}
                          style={styles.dropdownItem}
                          onPress={() =>
                            setFormData({
                              ...formData,
                              machineId: machine.id,
                              machineOwnerUserId: machine.ownerUserId,
                              partnerName: machine.ownerPartnerName,
                            })
                          }
                        >
                          <Text style={styles.dropdownItemText}>
                            {machine.machineName ||
                              `#${machine.number} - ${machine.brand}`}{" "}
                            ({machine.capacity}kg)
                          </Text>
                        </TouchableOpacity>
                      ))}
                    {sharedMachines.filter(
                      (machine) => machine.ownerPartnerId === formData.partnerId,
                    ).length === 0 && (
                      <Text style={styles.hint}>
                        Este socio no tiene lavadoras disponibles ahora.
                      </Text>
                    )}
                  </View>
                </>
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

      {/* Modal Extender */}
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
              <Text style={styles.actionButtonText}>✅ Confirmar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, styles.confirmButton]}
              onPress={() => setShowExtendModal(null)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Finalizar */}
      <Modal visible={showFinishModal !== null} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 360 }]}>
            <Text style={styles.modalTitle}>Finalizar Alquiler</Text>
            <Text style={styles.extendQuestion}>
              ¿Cómo deseas finalizar este alquiler?
            </Text>

            <TouchableOpacity
              style={[styles.finishButton, styles.confirmButton]}
              onPress={() => handleFinishRental(true)}
            >
              <Text style={styles.actionButtonText}>💰 Pagado</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.extendButton, styles.confirmButton]}
              onPress={() => handleFinishRental(false)}
            >
              <Text style={styles.actionButtonText}>🕒 Pago pendiente</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, styles.confirmButton]}
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
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    backgroundColor: "#2563EB",
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backText: { color: "white", fontWeight: "600", fontSize: 16 },
  headerTitle: { color: "white", fontWeight: "800", fontSize: 22 },
  headerSubtitle: { color: "rgba(255,255,255,0.85)", textAlign: "center" },
  addButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addButtonText: { color: "white", fontWeight: "700" },
  quickActions: { paddingHorizontal: 20, paddingTop: 14 },
  qrButton: {
    backgroundColor: "#0EA5E9",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  qrButtonText: { color: "white", fontWeight: "700" },
  content: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#64748B" },
  empty: { alignItems: "center", paddingTop: 90 },
  emptyIcon: { fontSize: 52, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#1F2937" },
  emptySubtitle: { color: "#64748B", marginTop: 6 },
  rentalCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
  },
  rentalHeader: { flexDirection: "row", justifyContent: "space-between" },
  rentalInfo: { flex: 1, paddingRight: 12 },
  rentalAddress: { fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  rentalMachine: { color: "#475569", marginBottom: 6 },
  rentalDates: { marginTop: 4 },
  dateText: { color: "#64748B", fontSize: 12 },
  rentalPrice: { alignItems: "flex-end" },
  priceAmount: { fontWeight: "800", fontSize: 18, color: "#0F172A" },
  timeRemaining: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, marginTop: 6 },
  timeText: { color: "white", fontWeight: "700", fontSize: 11 },
  rentalActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionButton: { flex: 1, borderRadius: 10, padding: 11, alignItems: "center" },
  extendButton: { backgroundColor: "#0284C7" },
  finishButton: { backgroundColor: "#10B981" },
  actionButtonText: { color: "white", fontWeight: "700" },
  disabledAction: { opacity: 0.55 },

  scannerContainer: { flex: 1, backgroundColor: "black" },
  scannerHeader: {
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  scannerTitle: { color: "white", fontWeight: "700", fontSize: 16 },
  closeScanner: { backgroundColor: "rgba(255,255,255,0.2)", padding: 8, borderRadius: 8 },
  closeScannerText: { color: "white", fontWeight: "700" },
  camera: { flex: 1 },
  scannerOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  scannerFrame: { width: 250, height: 250 },
  corner: { position: "absolute", width: 32, height: 32, borderColor: "#22D3EE" },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scannerInstructions: {
    color: "white",
    marginTop: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scannedOverlay: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  scannedText: { color: "white", marginTop: 8, fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 16,
    maxHeight: "88%",
  },
  modalTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A", marginBottom: 12, textAlign: "center" },
  label: { marginTop: 12, marginBottom: 6, fontWeight: "700", color: "#334155" },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  hint: { color: "#64748B", marginTop: 8, fontSize: 12 },
  typeButton: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 4,
  },
  typeButtonActive: { backgroundColor: "#DBEAFE", borderColor: "#2563EB" },
  typeButtonText: { color: "#334155" },
  typeButtonTextActive: { color: "#1D4ED8", fontWeight: "700" },
  dateTimeRow: { flexDirection: "row", gap: 8 },
  dateButton: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  timeButton: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  dateButtonText: { color: "#0F172A", fontWeight: "600", fontSize: 13 },

  dropdown: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
  },
  dropdownText: { color: "#0F172A", flex: 1, paddingRight: 10 },
  dropdownArrow: { color: "#64748B", fontWeight: "800" },
  dropdownList: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    marginTop: 8,
    maxHeight: 180,
    backgroundColor: "white",
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownItemText: { color: "#0F172A" },

  modalButtons: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalButton: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center" },
  cancelButton: { backgroundColor: "#E2E8F0" },
  cancelButtonText: { color: "#334155", fontWeight: "700" },
  saveButton: { backgroundColor: "#2563EB" },
  saveButtonText: { color: "white", fontWeight: "700" },

  extendQuestion: {
    textAlign: "center",
    marginBottom: 14,
    color: "#64748B",
    fontSize: 14,
  },
  confirmButton: { marginTop: 10, borderRadius: 12, paddingVertical: 12 },
});