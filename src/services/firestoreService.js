import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  increment,
} from "firebase/firestore";
import { db, auth } from "./firebase";

// ==================== LAVADORAS ====================

// Obtener todas las lavadoras del usuario
export const getMachines = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const machinesRef = collection(db, "users", userId, "machines");
    const snapshot = await getDocs(machinesRef);
    const machines = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Ajustar estado visual usando alquileres activos por si falló la escritura
    // de estado en la lavadora al sincronizar entre cuentas.
    const rentalsRef = collection(db, "users", userId, "rentals");
    const activeRentalsQ = query(rentalsRef, where("status", "==", "activo"));
    const activeRentalsSnap = await getDocs(activeRentalsQ);
    const rentedMachineIds = new Set(
      activeRentalsSnap.docs
        .map((rentalDoc) => rentalDoc.data()?.machineId)
        .filter(Boolean),
    );

    return machines.map((machine) =>
      rentedMachineIds.has(machine.id)
        ? { ...machine, status: "alquilada" }
        : machine,
    );
  } catch (error) {
    console.error("Error al obtener lavadoras:", error);
    throw error;
  }
};

// Agregar una lavadora
export const addMachine = async (machineData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const machinesRef = collection(db, "users", userId, "machines");
    const docRef = await addDoc(machinesRef, {
      ...machineData,
      // Inicializar estadísticas
      stats: {
        timesRented: 0,
        totalRevenue: 0,
        maintenanceDays: 0,
        lastMaintenanceDate: null,
      },
      createdAt: new Date().toISOString(),
    });

    return { id: docRef.id, ...machineData };
  } catch (error) {
    console.error("Error al agregar lavadora:", error);
    throw error;
  }
};

// Actualizar una lavadora
export const updateMachine = async (machineId, machineData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const machineRef = doc(db, "users", userId, "machines", machineId);

    // Si cambia a mantenimiento, registrar la fecha
    if (machineData.status === "mantenimiento") {
      await updateDoc(machineRef, {
        ...machineData,
        "stats.lastMaintenanceDate": new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      await updateDoc(machineRef, {
        ...machineData,
        updatedAt: new Date().toISOString(),
      });
    }

    return { id: machineId, ...machineData };
  } catch (error) {
    console.error("Error al actualizar lavadora:", error);
    throw error;
  }
};

// Eliminar una lavadora
export const deleteMachine = async (machineId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const machineRef = doc(db, "users", userId, "machines", machineId);
    await deleteDoc(machineRef);

    return machineId;
  } catch (error) {
    console.error("Error al eliminar lavadora:", error);
    throw error;
  }
};

// Actualizar estadísticas cuando se alquila una lavadora
export const incrementMachineStats = async (machineId, revenue) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const machineRef = doc(db, "users", userId, "machines", machineId);

    await updateDoc(machineRef, {
      "stats.timesRented": increment(1),
      "stats.totalRevenue": increment(revenue),
    });

    return true;
  } catch (error) {
    console.error("Error al actualizar estadísticas:", error);
    throw error;
  }
};

// Obtener estadísticas de una lavadora
export const getMachineStats = async (machineId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const machines = await getMachines();
    const machine = machines.find((m) => m.id === machineId);

    if (!machine) {
      return {
        timesRented: 0,
        totalRevenue: 0,
        maintenanceDays: 0,
      };
    }

    // Calcular días en mantenimiento
    let maintenanceDays = 0;
    if (machine.stats?.lastMaintenanceDate) {
      const lastDate = new Date(machine.stats.lastMaintenanceDate);
      const now = new Date();

      if (machine.status === "mantenimiento") {
        const diffTime = Math.abs(now - lastDate);
        maintenanceDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    return {
      timesRented: machine.stats?.timesRented || 0,
      totalRevenue: machine.stats?.totalRevenue || 0,
      maintenanceDays: maintenanceDays,
    };
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    return {
      timesRented: 0,
      totalRevenue: 0,
      maintenanceDays: 0,
    };
  }
};

// ==================== ALQUILERES ====================

// Obtener todos los alquileres activos
export const getRentals = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const rentalsRef = collection(db, "users", userId, "rentals");
    const q = query(rentalsRef, where("status", "==", "activo"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error al obtener alquileres:", error);
    throw error;
  }
};

// Agregar un alquiler
export const addRental = async (rentalData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const rentalsRef = collection(db, "users", userId, "rentals");
    const docRef = await addDoc(rentalsRef, {
      ...rentalData,
      status: "activo",
      createdAt: new Date().toISOString(),
    });

    // Si hay una lavadora asignada, incrementar sus estadísticas
    if (rentalData.machineId && rentalData.price) {
      await incrementMachineStats(rentalData.machineId, rentalData.price);
    }

    return { id: docRef.id, ...rentalData };
  } catch (error) {
    console.error("Error al agregar alquiler:", error);
    throw error;
  }
};

// Finalizar un alquiler
export const finishRental = async (rentalId, paid) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const rentalRef = doc(db, "users", userId, "rentals", rentalId);
    await updateDoc(rentalRef, {
      status: "finalizado",
      paid: paid,
      finishedAt: new Date().toISOString(),
    });

    return { id: rentalId, paid };
  } catch (error) {
    console.error("Error al finalizar alquiler:", error);
    throw error;
  }
};

// Extender alquiler y actualizar estadísticas
export const extendRental = async (rentalId, machineId, additionalPrice) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    // Si hay lavadora, actualizar sus ingresos
    if (machineId && additionalPrice) {
      await incrementMachineStats(machineId, additionalPrice);
    }

    return true;
  } catch (error) {
    console.error("Error al extender alquiler:", error);
    throw error;
  }
};

// ==================== HISTORIAL DE PAGOS ====================

// Agregar un pago al historial
export const addPayment = async (paymentData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const paymentsRef = collection(db, "users", userId, "payments");
    const docRef = await addDoc(paymentsRef, {
      ...paymentData,
      createdAt: new Date().toISOString(),
    });

    return { id: docRef.id, ...paymentData };
  } catch (error) {
    console.error("Error al agregar pago:", error);
    throw error;
  }
};

// Obtener historial de pagos
export const getPayments = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const paymentsRef = collection(db, "users", userId, "payments");
    const snapshot = await getDocs(paymentsRef);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error al obtener pagos:", error);
    throw error;
  }
};

// ==================== PENDIENTES DE COBRO ====================

// Agregar pendiente de cobro
export const addPendingPaymentWithSync = async (pendingData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const pendingRef = collection(db, "users", userId, "pendingPayments");
    const createdAt = new Date().toISOString();

    const localDoc = await addDoc(pendingRef, {
      ...pendingData,
      ownerUserId: userId,
      createdAt,
    });

    if (pendingData.linkedUserId) {
      try {
        const remotePendingRef = collection(
          db,
          "users",
          pendingData.linkedUserId,
          "pendingPayments",
        );

        const remoteDoc = await addDoc(remotePendingRef, {
          ...pendingData,
          isSharedViewOnly: true,
          linkedUserId: userId,
          linkedPendingId: localDoc.id,
          createdAt,
        });

        await updateDoc(doc(db, "users", userId, "pendingPayments", localDoc.id), {
          linkedPendingId: remoteDoc.id,
        });

        return { id: localDoc.id, ...pendingData, linkedPendingId: remoteDoc.id };
      } catch (remoteError) {
        console.log("Pendiente local creado; sync remoto pendiente:", remoteError);
      }
    }

    return { id: localDoc.id, ...pendingData };
  } catch (error) {
    console.error("Error al agregar pendiente sincronizado:", error);
    throw error;
  }
};

// Obtener pendientes de cobro
export const getPendingPayments = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const pendingRef = collection(db, "users", userId, "pendingPayments");
    const snapshot = await getDocs(pendingRef);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error al obtener pendientes:", error);
    throw error;
  }
};

// Eliminar pendiente (cuando se paga o se cancela)
export const deletePendingPaymentWithSync = async (pendingId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const localRef = doc(db, "users", userId, "pendingPayments", pendingId);
    const localSnap = await getDoc(localRef);
    if (!localSnap.exists()) return pendingId;

    const localData = localSnap.data();
    await deleteDoc(localRef);

    if (localData.linkedUserId && localData.linkedPendingId) {
      try {
        const remoteRef = doc(
          db,
          "users",
          localData.linkedUserId,
          "pendingPayments",
          localData.linkedPendingId,
        );
        await deleteDoc(remoteRef);
      } catch (remoteError) {
        console.log("Pendiente local eliminado; delete remoto pendiente:", remoteError);
      }
    }

    return pendingId;
  } catch (error) {
    console.error("Error al eliminar pendiente sincronizado:", error);
    throw error;
  }
};

// ==================== SOCIOS ====================

// Obtener todos los socios
export const getPartners = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const partnersRef = collection(db, "users", userId, "partners");
    const snapshot = await getDocs(partnersRef);

    const partners = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    await Promise.all(
      partners.map(async (partner) => {
        if (
          partner.relationshipType !== "outgoing" ||
          partner.status !== "pending" ||
          !partner.partnerUserId ||
          !partner.relationshipId
        ) {
          return;
        }

        try {
          let hasAccepted = false;

          if (partner.counterpartDocId) {
            const counterpartRef = doc(
              db,
              "users",
              partner.partnerUserId,
              "partners",
              partner.counterpartDocId,
            );
            const counterpartSnap = await getDoc(counterpartRef);
            hasAccepted =
              counterpartSnap.exists() &&
              counterpartSnap.data()?.status === "active";
          }

          if (!hasAccepted) {
            const remotePartnersRef = collection(
              db,
              "users",
              partner.partnerUserId,
              "partners",
            );
            const remoteQ = query(
              remotePartnersRef,
              where("relationshipId", "==", partner.relationshipId),
            );
            const remoteSnapshot = await getDocs(remoteQ);
            hasAccepted = remoteSnapshot.docs.some(
              (remoteDoc) => remoteDoc.data().status === "active",
            );
          }

          if (hasAccepted) {
            await updateDoc(doc(db, "users", userId, "partners", partner.id), {
              status: "active",
              canUsePartnerMachines: true,
              acceptedAt: new Date().toISOString(),
              reconciledAt: new Date().toISOString(),
            });
            partner.status = "active";
            partner.canUsePartnerMachines = true;
          }
        } catch (reconcileError) {
          console.log("No se pudo reconciliar estado del socio:", reconcileError);
        }
      }),
    );

    return partners;
  } catch (error) {
    console.error("Error al obtener socios:", error);
    throw error;
  }
};

// Agregar un socio (crea invitación espejo en ambas cuentas)
export const addPartner = async (partnerData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const partnerUserId = (partnerData.partnerUserId || "").trim();
    if (!partnerUserId)
      throw new Error("Debes ingresar el código de usuario del socio");
    if (partnerUserId === userId)
      throw new Error("No puedes agregarte como socio");

    const partnerUserDoc = await getDoc(doc(db, "users", partnerUserId));
    if (!partnerUserDoc.exists())
      throw new Error("No existe una cuenta con ese código");

    const userDoc = await getDoc(doc(db, "users", userId));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const partnerUserData = partnerUserDoc.data();

    const relationshipId = `${Date.now()}_${userId}_${partnerUserId}`;
    const createdAt = new Date().toISOString();

    const myPartnersRef = collection(db, "users", userId, "partners");
    const existingQ = query(
      myPartnersRef,
      where("partnerUserId", "==", partnerUserId),
    );
    const existing = await getDocs(existingQ);
    if (!existing.empty) {
      throw new Error(
        "Ya tienes una relación con este socio (activa o pendiente)",
      );
    }

    const senderDoc = await addDoc(myPartnersRef, {
      name: partnerData.name,
      phone: partnerData.phone,
      notes: partnerData.notes || "",
      percentage: partnerData.percentage,
      partnerUserId,
      relationshipId,
      relationshipType: "outgoing",
      status: "pending",
      canUsePartnerMachines: false,
      createdBy: userId,
      createdAt,
      invitedByName:
        userData.businessName || auth.currentUser?.email || "Usuario",
    });

    const partnerPartnersRef = collection(
      db,
      "users",
      partnerUserId,
      "partners",
    );
    const receiverDoc = await addDoc(partnerPartnersRef, {
      name: userData.businessName || auth.currentUser?.email || "Socio",
      phone: userData.phone || "",
      notes: `Invitación enviada por ${partnerData.name || "un socio"}`,
      percentage: partnerData.percentage,
      partnerUserId: userId,
      relationshipId,
      relationshipType: "incoming",
      status: "pending",
      canUsePartnerMachines: false,
      createdBy: userId,
      createdAt,
      invitedByName:
        userData.businessName || auth.currentUser?.email || "Usuario",
      partnerBusinessName: partnerUserData.businessName || "",
      counterpartDocId: senderDoc.id,
    });

    await updateDoc(doc(db, "users", userId, "partners", senderDoc.id), {
      counterpartDocId: receiverDoc.id,
    });

    return {
      id: senderDoc.id,
      ...partnerData,
      partnerUserId,
      relationshipId,
      status: "pending",
      counterpartDocId: receiverDoc.id,
    };
  } catch (error) {
    console.error("Error al agregar socio:", error);
    throw error;
  }
};

// Actualizar un socio
export const updatePartner = async (partnerId, partnerData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const partnerRef = doc(db, "users", userId, "partners", partnerId);
    const partnerSnap = await getDoc(partnerRef);
    if (!partnerSnap.exists()) throw new Error("Socio no encontrado");
    const currentPartner = partnerSnap.data();

    await updateDoc(partnerRef, {
      ...partnerData,
      updatedAt: new Date().toISOString(),
    });

    if (currentPartner.relationshipId) {
      const partnerRefPath = collection(
        db,
        "users",
        currentPartner.partnerUserId,
        "partners",
      );
      const q = query(
        partnerRefPath,
        where("relationshipId", "==", currentPartner.relationshipId),
      );
      const partnerMatch = await getDocs(q);
      await Promise.all(
        partnerMatch.docs.map((partnerDoc) =>
          updateDoc(partnerDoc.ref, {
            percentage: partnerData.percentage,
            updatedAt: new Date().toISOString(),
          }),
        ),
      );
    }

    return { id: partnerId, ...partnerData };
  } catch (error) {
    console.error("Error al actualizar socio:", error);
    throw error;
  }
};

// Eliminar un socio (elimina ambos lados de la relación)
export const deletePartner = async (partnerId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const partnerRef = doc(db, "users", userId, "partners", partnerId);
    const partnerSnap = await getDoc(partnerRef);
    if (!partnerSnap.exists()) {
      return partnerId;
    }
    const partnerData = partnerSnap.data();
    await deleteDoc(partnerRef);

    if (partnerData.relationshipId && partnerData.partnerUserId) {
      const otherPartnersRef = collection(
        db,
        "users",
        partnerData.partnerUserId,
        "partners",
      );
      const q = query(
        otherPartnersRef,
        where("relationshipId", "==", partnerData.relationshipId),
      );
      const snapshot = await getDocs(q);
      await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
    }

    return partnerId;
  } catch (error) {
    console.error("Error al eliminar socio:", error);
    throw error;
  }
};

export const acceptPartnerInvitation = async (partnerId) => {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("No hay usuario autenticado");

  const myRef = doc(db, "users", userId, "partners", partnerId);
  const mySnap = await getDoc(myRef);
  if (!mySnap.exists()) throw new Error("Invitación no encontrada");
  const invitation = mySnap.data();

  await updateDoc(myRef, {
    status: "active",
    canUsePartnerMachines: true,
    acceptedAt: new Date().toISOString(),
  });

  try {
    if (invitation.counterpartDocId) {
      const counterpartRef = doc(
        db,
        "users",
        invitation.partnerUserId,
        "partners",
        invitation.counterpartDocId,
      );
      await updateDoc(counterpartRef, {
        status: "active",
        canUsePartnerMachines: true,
        acceptedAt: new Date().toISOString(),
      });
    } else {
      const otherRef = collection(
        db,
        "users",
        invitation.partnerUserId,
        "partners",
      );
      const q = query(
        otherRef,
        where("relationshipId", "==", invitation.relationshipId),
      );
      const other = await getDocs(q);
      await Promise.all(
        other.docs.map((item) =>
          updateDoc(item.ref, {
            status: "active",
            canUsePartnerMachines: true,
            acceptedAt: new Date().toISOString(),
          }),
        ),
      );
    }
  } catch (syncError) {
    console.log("Aceptación local completada; sync remoto pendiente:", syncError);
  }

  return true;
};

export const rejectPartnerInvitation = async (partnerId) => {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("No hay usuario autenticado");

  const myRef = doc(db, "users", userId, "partners", partnerId);
  const mySnap = await getDoc(myRef);
  if (!mySnap.exists()) throw new Error("Invitación no encontrada");
  const invitation = mySnap.data();

  await deleteDoc(myRef);

  try {
    if (invitation.counterpartDocId) {
      await deleteDoc(
        doc(
          db,
          "users",
          invitation.partnerUserId,
          "partners",
          invitation.counterpartDocId,
        ),
      );
    } else {
      const otherRef = collection(
        db,
        "users",
        invitation.partnerUserId,
        "partners",
      );
      const q = query(
        otherRef,
        where("relationshipId", "==", invitation.relationshipId),
      );
      const other = await getDocs(q);
      await Promise.all(other.docs.map((item) => deleteDoc(item.ref)));
    }
  } catch (syncError) {
    console.log("Rechazo local completado; sync remoto pendiente:", syncError);
  }

  return true;
};

export const getSharedPartnerMachines = async () => {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("No hay usuario autenticado");

  const partners = await getPartners();
  const activePartners = partners.filter(
    (partner) =>
      partner.status === "active" &&
      partner.canUsePartnerMachines &&
      partner.partnerUserId,
  );

  const machineGroups = await Promise.all(
    activePartners.map(async (partner) => {
      try {
        const machinesRef = collection(
          db,
          "users",
          partner.partnerUserId,
          "machines",
        );
        const snapshot = await getDocs(machinesRef);
        return snapshot.docs
          .map((machineDoc) => ({ id: machineDoc.id, ...machineDoc.data() }))
          .filter((machine) => machine.status === "disponible")
          .map((machine) => ({
            ...machine,
            ownerUserId: partner.partnerUserId,
            ownerPartnerId: partner.id,
            ownerPartnerName: partner.name,
            ownerPercentage: partner.percentage,
          }));
      } catch (error) {
        console.log("No se pudieron leer lavadoras compartidas:", error);
        return [];
      }
    }),
  );

  return machineGroups.flat();
};

export const addRentalWithSync = async (rentalData) => {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("No hay usuario autenticado");

  const createdAt = new Date().toISOString();
  const localPayload = {
    ...rentalData,
    status: "activo",
    createdAt,
  };

  const rentalsRef = collection(db, "users", userId, "rentals");
  const localDoc = await addDoc(rentalsRef, localPayload);

  if (
    rentalData.machineId &&
    rentalData.machineOwnerUserId &&
    rentalData.machineOwnerUserId !== userId
  ) {
    try {
      const remoteRentalPayload = {
        ...rentalData,
        machineId: rentalData.machineId,
        status: "activo",
        createdAt,
        createdByUserId: userId,
        createdByPartnerName: rentalData.partnerName || "Socio",
        isSharedViewOnly: true,
        linkedRentalId: localDoc.id,
      };

      const remoteRentalsRef = collection(
        db,
        "users",
        rentalData.machineOwnerUserId,
        "rentals",
      );
      const remoteDoc = await addDoc(remoteRentalsRef, remoteRentalPayload);

      await updateDoc(doc(db, "users", userId, "rentals", localDoc.id), {
        linkedRentalId: remoteDoc.id,
        linkedUserId: rentalData.machineOwnerUserId,
        sharedMode: true,
      });

      try {
        await updateDoc(
          doc(
            db,
            "users",
            rentalData.machineOwnerUserId,
            "machines",
            rentalData.machineId,
          ),
          {
            status: "alquilada",
            updatedAt: new Date().toISOString(),
          },
        );
      } catch (machineSyncError) {
        console.log("Alquiler sincronizado; estado remoto de máquina pendiente:", machineSyncError);
      }

      return { id: localDoc.id, ...rentalData, linkedRentalId: remoteDoc.id };
    } catch (remoteError) {
      console.log("Alquiler local creado; sync remoto pendiente:", remoteError);
    }
  }

  if (rentalData.machineId && rentalData.price) {
    await incrementMachineStats(rentalData.machineId, rentalData.price);
  }

  return { id: localDoc.id, ...rentalData };
};

export const finishRentalWithSync = async (rentalId, paid) => {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("No hay usuario autenticado");

  const rentalRef = doc(db, "users", userId, "rentals", rentalId);
  const rentalSnap = await getDoc(rentalRef);
  if (!rentalSnap.exists()) throw new Error("Alquiler no encontrado");
  const rental = rentalSnap.data();

  await updateDoc(rentalRef, {
    status: "finalizado",
    paid,
    finishedAt: new Date().toISOString(),
  });

  if (rental.linkedRentalId && rental.linkedUserId) {
    try {
      const linkedRef = doc(
        db,
        "users",
        rental.linkedUserId,
        "rentals",
        rental.linkedRentalId,
      );
      await updateDoc(linkedRef, {
        status: "finalizado",
        paid,
        finishedAt: new Date().toISOString(),
      });

      if (rental.machineId) {
        try {
          await updateDoc(
            doc(db, "users", rental.linkedUserId, "machines", rental.machineId),
            {
              status: "disponible",
              updatedAt: new Date().toISOString(),
            },
          );
        } catch (machineSyncError) {
          console.log("Alquiler finalizado; estado remoto de máquina pendiente:", machineSyncError);
        }
      }
    } catch (remoteError) {
      console.log("Finalización local completada; sync remoto pendiente:", remoteError);
    }
  } else if (rental.machineId) {
    await updateMachine(rental.machineId, { status: "disponible" });
  }

  return { id: rentalId, paid };
};

// Obtener estadísticas de un socio (cuánto ha ganado)
export const getPartnerStats = async (partnerId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const partnerRef = doc(db, "users", userId, "partners", partnerId);
    const partnerSnap = await getDoc(partnerRef);
    const partner = partnerSnap.exists() ? partnerSnap.data() : null;

    // Cargar alquileres del usuario y calcular por varios criterios para soportar
    // relaciones sincronizadas entre cuentas.
    const rentalsRef = collection(db, "users", userId, "rentals");
    const snapshot = await getDocs(rentalsRef);
    const rentals = snapshot
      .docs
      .map((rentalDoc) => rentalDoc.data())
      .filter((rental) => {
        if (rental.partnerId === partnerId) return true;
        if (partner?.partnerUserId && rental.createdByUserId === partner.partnerUserId) return true;
        if (partner?.partnerUserId && rental.linkedUserId === partner.partnerUserId) return true;
        return false;
      });

    const totalRentals = rentals.length;
    const totalRevenue = rentals.reduce((sum, rental) => sum + (rental.price || 0), 0);

    return {
      totalRentals,
      totalRevenue,
    };
  } catch (error) {
    console.error("Error al obtener estadísticas del socio:", error);
    return {
      totalRentals: 0,
      totalRevenue: 0,
    };
  }
};

// ==================== AGENDADOS ====================

// Obtener todos los agendados
export const getScheduled = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const scheduledRef = collection(db, "users", userId, "scheduled");
    const snapshot = await getDocs(scheduledRef);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error al obtener agendados:", error);
    throw error;
  }
};

// Agregar un agendado
export const addScheduled = async (scheduledData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const scheduledRef = collection(db, "users", userId, "scheduled");
    const docRef = await addDoc(scheduledRef, {
      ...scheduledData,
      createdAt: new Date().toISOString(),
    });

    return { id: docRef.id, ...scheduledData };
  } catch (error) {
    console.error("Error al agregar agendado:", error);
    throw error;
  }
};

// Actualizar un agendado
export const updateScheduled = async (scheduledId, scheduledData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const scheduledRef = doc(db, "users", userId, "scheduled", scheduledId);
    await updateDoc(scheduledRef, {
      ...scheduledData,
      updatedAt: new Date().toISOString(),
    });

    return { id: scheduledId, ...scheduledData };
  } catch (error) {
    console.error("Error al actualizar agendado:", error);
    throw error;
  }
};

// Eliminar un agendado
export const deleteScheduled = async (scheduledId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("No hay usuario autenticado");

    const scheduledRef = doc(db, "users", userId, "scheduled", scheduledId);
    await deleteDoc(scheduledRef);

    return scheduledId;
  } catch (error) {
    console.error("Error al eliminar agendado:", error);
    throw error;
  }
};