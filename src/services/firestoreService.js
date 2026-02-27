import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where,
  onSnapshot,
  increment 
} from 'firebase/firestore';
import { db, auth } from './firebase';

// ==================== LAVADORAS ====================

// Obtener todas las lavadoras del usuario
export const getMachines = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const machinesRef = collection(db, 'users', userId, 'machines');
    const snapshot = await getDocs(machinesRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error al obtener lavadoras:', error);
    throw error;
  }
};

// Agregar una lavadora
export const addMachine = async (machineData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const machinesRef = collection(db, 'users', userId, 'machines');
    const docRef = await addDoc(machinesRef, {
      ...machineData,
      // Inicializar estadísticas
      stats: {
        timesRented: 0,
        totalRevenue: 0,
        maintenanceDays: 0,
        lastMaintenanceDate: null
      },
      createdAt: new Date().toISOString()
    });

    return { id: docRef.id, ...machineData };
  } catch (error) {
    console.error('Error al agregar lavadora:', error);
    throw error;
  }
};

// Actualizar una lavadora
export const updateMachine = async (machineId, machineData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const machineRef = doc(db, 'users', userId, 'machines', machineId);
    
    // Si cambia a mantenimiento, registrar la fecha
    if (machineData.status === 'mantenimiento') {
      await updateDoc(machineRef, {
        ...machineData,
        'stats.lastMaintenanceDate': new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      await updateDoc(machineRef, {
        ...machineData,
        updatedAt: new Date().toISOString()
      });
    }

    return { id: machineId, ...machineData };
  } catch (error) {
    console.error('Error al actualizar lavadora:', error);
    throw error;
  }
};

// Eliminar una lavadora
export const deleteMachine = async (machineId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const machineRef = doc(db, 'users', userId, 'machines', machineId);
    await deleteDoc(machineRef);

    return machineId;
  } catch (error) {
    console.error('Error al eliminar lavadora:', error);
    throw error;
  }
};

// Actualizar estadísticas cuando se alquila una lavadora
export const incrementMachineStats = async (machineId, revenue) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const machineRef = doc(db, 'users', userId, 'machines', machineId);
    
    await updateDoc(machineRef, {
      'stats.timesRented': increment(1),
      'stats.totalRevenue': increment(revenue)
    });

    return true;
  } catch (error) {
    console.error('Error al actualizar estadísticas:', error);
    throw error;
  }
};

// Obtener estadísticas de una lavadora
export const getMachineStats = async (machineId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const machines = await getMachines();
    const machine = machines.find(m => m.id === machineId);
    
    if (!machine) {
      return {
        timesRented: 0,
        totalRevenue: 0,
        maintenanceDays: 0
      };
    }

    // Calcular días en mantenimiento
    let maintenanceDays = 0;
    if (machine.stats?.lastMaintenanceDate) {
      const lastDate = new Date(machine.stats.lastMaintenanceDate);
      const now = new Date();
      
      if (machine.status === 'mantenimiento') {
        const diffTime = Math.abs(now - lastDate);
        maintenanceDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    return {
      timesRented: machine.stats?.timesRented || 0,
      totalRevenue: machine.stats?.totalRevenue || 0,
      maintenanceDays: maintenanceDays
    };
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return {
      timesRented: 0,
      totalRevenue: 0,
      maintenanceDays: 0
    };
  }
};

// ==================== ALQUILERES ====================

// Obtener todos los alquileres activos
export const getRentals = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const rentalsRef = collection(db, 'users', userId, 'rentals');
    const q = query(rentalsRef, where('status', '==', 'activo'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error al obtener alquileres:', error);
    throw error;
  }
};

// Agregar un alquiler
export const addRental = async (rentalData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const rentalsRef = collection(db, 'users', userId, 'rentals');
    const docRef = await addDoc(rentalsRef, {
      ...rentalData,
      status: 'activo',
      createdAt: new Date().toISOString()
    });

    // Si hay una lavadora asignada, incrementar sus estadísticas
    if (rentalData.machineId && rentalData.price) {
      await incrementMachineStats(rentalData.machineId, rentalData.price);
    }

    return { id: docRef.id, ...rentalData };
  } catch (error) {
    console.error('Error al agregar alquiler:', error);
    throw error;
  }
};

// Finalizar un alquiler
export const finishRental = async (rentalId, paid) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const rentalRef = doc(db, 'users', userId, 'rentals', rentalId);
    await updateDoc(rentalRef, {
      status: 'finalizado',
      paid: paid,
      finishedAt: new Date().toISOString()
    });

    return { id: rentalId, paid };
  } catch (error) {
    console.error('Error al finalizar alquiler:', error);
    throw error;
  }
};

// Extender alquiler y actualizar estadísticas
export const extendRental = async (rentalId, machineId, additionalPrice) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    // Si hay lavadora, actualizar sus ingresos
    if (machineId && additionalPrice) {
      await incrementMachineStats(machineId, additionalPrice);
    }

    return true;
  } catch (error) {
    console.error('Error al extender alquiler:', error);
    throw error;
  }
};

// ==================== HISTORIAL DE PAGOS ====================

// Agregar un pago al historial
export const addPayment = async (paymentData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const paymentsRef = collection(db, 'users', userId, 'payments');
    const docRef = await addDoc(paymentsRef, {
      ...paymentData,
      createdAt: new Date().toISOString()
    });

    return { id: docRef.id, ...paymentData };
  } catch (error) {
    console.error('Error al agregar pago:', error);
    throw error;
  }
};

// Obtener historial de pagos
export const getPayments = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const paymentsRef = collection(db, 'users', userId, 'payments');
    const snapshot = await getDocs(paymentsRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error al obtener pagos:', error);
    throw error;
  }
};

// ==================== PENDIENTES DE COBRO ====================

// Agregar pendiente de cobro
export const addPendingPayment = async (pendingData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const pendingRef = collection(db, 'users', userId, 'pendingPayments');
    const docRef = await addDoc(pendingRef, {
      ...pendingData,
      createdAt: new Date().toISOString()
    });

    return { id: docRef.id, ...pendingData };
  } catch (error) {
    console.error('Error al agregar pendiente:', error);
    throw error;
  }
};

// Obtener pendientes de cobro
export const getPendingPayments = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const pendingRef = collection(db, 'users', userId, 'pendingPayments');
    const snapshot = await getDocs(pendingRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error al obtener pendientes:', error);
    throw error;
  }
};

// Eliminar pendiente (cuando se paga o se cancela)
export const deletePendingPayment = async (pendingId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const pendingRef = doc(db, 'users', userId, 'pendingPayments', pendingId);
    await deleteDoc(pendingRef);

    return pendingId;
  } catch (error) {
    console.error('Error al eliminar pendiente:', error);
    throw error;
  }
};

// ==================== SOCIOS ====================

// Obtener todos los socios
export const getPartners = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const partnersRef = collection(db, 'users', userId, 'partners');
    const snapshot = await getDocs(partnersRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error al obtener socios:', error);
    throw error;
  }
};

// Agregar un socio
export const addPartner = async (partnerData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const partnersRef = collection(db, 'users', userId, 'partners');
    const docRef = await addDoc(partnersRef, {
      ...partnerData,
      createdAt: new Date().toISOString()
    });

    return { id: docRef.id, ...partnerData };
  } catch (error) {
    console.error('Error al agregar socio:', error);
    throw error;
  }
};

// Actualizar un socio
export const updatePartner = async (partnerId, partnerData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const partnerRef = doc(db, 'users', userId, 'partners', partnerId);
    await updateDoc(partnerRef, {
      ...partnerData,
      updatedAt: new Date().toISOString()
    });

    return { id: partnerId, ...partnerData };
  } catch (error) {
    console.error('Error al actualizar socio:', error);
    throw error;
  }
};

// Eliminar un socio
export const deletePartner = async (partnerId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const partnerRef = doc(db, 'users', userId, 'partners', partnerId);
    await deleteDoc(partnerRef);

    return partnerId;
  } catch (error) {
    console.error('Error al eliminar socio:', error);
    throw error;
  }
};

// Obtener estadísticas de un socio (cuánto ha ganado)
export const getPartnerStats = async (partnerId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    // Obtener todos los alquileres del socio (finalizados)
    const rentalsRef = collection(db, 'users', userId, 'rentals');
    const q = query(rentalsRef, where('partnerId', '==', partnerId));
    const snapshot = await getDocs(q);

    const rentals = snapshot.docs.map(doc => doc.data());
    
    // Calcular totales
    const totalRentals = rentals.length;
    const totalRevenue = rentals.reduce((sum, r) => sum + (r.price || 0), 0);

    return {
      totalRentals,
      totalRevenue
    };
  } catch (error) {
    console.error('Error al obtener estadísticas del socio:', error);
    return {
      totalRentals: 0,
      totalRevenue: 0
    };
  }
};

// ==================== AGENDADOS ====================

// Obtener todos los agendados
export const getScheduled = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const scheduledRef = collection(db, 'users', userId, 'scheduled');
    const snapshot = await getDocs(scheduledRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error al obtener agendados:', error);
    throw error;
  }
};

// Agregar un agendado
export const addScheduled = async (scheduledData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const scheduledRef = collection(db, 'users', userId, 'scheduled');
    const docRef = await addDoc(scheduledRef, {
      ...scheduledData,
      createdAt: new Date().toISOString()
    });

    return { id: docRef.id, ...scheduledData };
  } catch (error) {
    console.error('Error al agregar agendado:', error);
    throw error;
  }
};

// Actualizar un agendado
export const updateScheduled = async (scheduledId, scheduledData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const scheduledRef = doc(db, 'users', userId, 'scheduled', scheduledId);
    await updateDoc(scheduledRef, {
      ...scheduledData,
      updatedAt: new Date().toISOString()
    });

    return { id: scheduledId, ...scheduledData };
  } catch (error) {
    console.error('Error al actualizar agendado:', error);
    throw error;
  }
};

// Eliminar un agendado
export const deleteScheduled = async (scheduledId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No hay usuario autenticado');

    const scheduledRef = doc(db, 'users', userId, 'scheduled', scheduledId);
    await deleteDoc(scheduledRef);

    return scheduledId;
  } catch (error) {
    console.error('Error al eliminar agendado:', error);
    throw error;
  }
};