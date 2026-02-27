import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { 
  getPendingPayments, 
  deletePendingPayment,
  addPayment 
} from '../services/firestoreService';

export default function PendingScreen({ navigation }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    try {
      setLoading(true);
      const data = await getPendingPayments();
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setPending(data);
    } catch (error) {
      console.error('Error al cargar pendientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (pendingItem) => {
  Alert.alert(
    'Marcar como Pagado',
    `¿El cliente pagó $${pendingItem.amount.toLocaleString()}?`,
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sí, Pagó',
        onPress: async () => {
          try {
            // VERIFICAR SI HAY SOCIO (partnerId guardado en el pendiente)
            if (pendingItem.partnerId) {
              const { getPartners } = require('../services/firestoreService');
              const partners = await getPartners();
              const partner = partners.find(p => p.id === pendingItem.partnerId);
              
              if (partner) {
                // CALCULAR DIVISIÓN
                const partnerAmount = Math.floor(pendingItem.amount * (partner.percentage / 100));
                const yourAmount = pendingItem.amount - partnerAmount;

                // TU PARTE
                await addPayment({
                  amount: yourAmount,
                  date: new Date().toISOString().split('T')[0],
                  machineNumber: pendingItem.machineNumber,
                  address: pendingItem.address,
                  type: 'pagado',
                  notes: `Tu ${100 - partner.percentage}% (Socio: ${partner.name})`
                });

                console.log(`💰 Socio ${partner.name} gana: $${partnerAmount}`);
                
                await deletePendingPayment(pendingItem.id);

                Alert.alert(
                  '💰 Pago Dividido',
                  `Total: $${pendingItem.amount.toLocaleString()}\n\n` +
                  `• Tú (${100 - partner.percentage}%): $${yourAmount.toLocaleString()}\n` +
                  `• ${partner.name} (${partner.percentage}%): $${partnerAmount.toLocaleString()}`
                );
                loadPending();
                return;
              }
            }

            // SIN SOCIO - TODO PARA TI
            await addPayment({
              amount: pendingItem.amount,
              date: new Date().toISOString().split('T')[0],
              machineNumber: pendingItem.machineNumber,
              address: pendingItem.address,
              type: 'pagado'
            });

            await deletePendingPayment(pendingItem.id);

            Alert.alert('¡Perfecto! ✅', 'Pago registrado correctamente');
            loadPending();
          } catch (error) {
            Alert.alert('Error', 'No se pudo registrar el pago');
          }
        }
      }
    ]
  );
};

  const handleDelete = (pendingItem) => {
    Alert.alert(
      'Eliminar Pendiente',
      '¿Estás seguro? Esta acción no se puede deshacer',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePendingPayment(pendingItem.id);
              Alert.alert('¡Eliminado! 🗑️', 'Pendiente eliminado correctamente');
              loadPending();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar');
            }
          }
        }
      ]
    );
  };

  const total = pending.reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Atrás</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pendientes</Text>
          <View style={{ width: 70 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#F97316" />
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
          <Text style={styles.headerTitle}>Pendientes ⏰</Text>
          <Text style={styles.headerSubtitle}>{pending.length} por cobrar</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.content}>
        {/* Total pendiente */}
        <View style={styles.totalCard}>
          <View style={styles.totalHeader}>
            <View>
              <Text style={styles.totalLabel}>Total por Cobrar</Text>
              <Text style={styles.totalAmount}>${total.toLocaleString()}</Text>
              <Text style={styles.totalSubtext}>COP</Text>
            </View>
            <View style={styles.totalIcon}>
              <Text style={styles.totalIconText}>⏰</Text>
            </View>
          </View>
          <View style={styles.totalFooter}>
            <View style={styles.totalStat}>
              <Text style={styles.totalStatNumber}>{pending.length}</Text>
              <Text style={styles.totalStatLabel}>Clientes deben</Text>
            </View>
          </View>
        </View>

        {/* Lista de pendientes */}
        <View style={styles.pendingSection}>
          <Text style={styles.sectionTitle}>Lista de Pendientes</Text>
          
          <ScrollView style={styles.pendingList} showsVerticalScrollIndicator={false}>
            {pending.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyTitle}>¡No hay pendientes!</Text>
                <Text style={styles.emptySubtext}>Todos los pagos están al día</Text>
              </View>
            ) : (
              pending.map(item => (
                <View key={item.id} style={styles.pendingCard}>
                  <View style={styles.pendingLeft}>
                    <View style={styles.pendingIconContainer}>
                      <Text style={styles.pendingIcon}>⏰</Text>
                    </View>
                    <View style={styles.pendingInfo}>
                      <Text style={styles.pendingClient}>{item.clientName}</Text>
                      <Text style={styles.pendingAddress}>{item.address}</Text>
                      <Text style={styles.pendingMachine}>
                        Lavadora #{item.machineNumber}
                      </Text>
                      <Text style={styles.pendingDate}>
                        📅 {new Date(item.date).toLocaleDateString('es-CO', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.pendingRight}>
                    <Text style={styles.pendingAmount}>${item.amount.toLocaleString()}</Text>
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>Debe</Text>
                    </View>
                  </View>

                  <View style={styles.pendingActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.paidButton]}
                      onPress={() => handleMarkAsPaid(item)}
                    >
                      <Text style={styles.actionButtonText}>✅ Marcar Pagado</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDelete(item)}
                    >
                      <Text style={styles.actionButtonText}>🗑️ Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    backgroundColor: '#F97316',
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
  totalCard: {
    backgroundColor: '#F97316',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    marginTop: -40,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  totalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: 'white',
    marginBottom: 4,
  },
  totalSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  totalIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalIconText: {
    fontSize: 32,
  },
  totalFooter: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  totalStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalStatNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
  },
  totalStatLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  pendingSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 16,
  },
  pendingList: {
    flex: 1,
  },
  empty: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
  },
  pendingCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F97316',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  pendingLeft: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  pendingIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FED7AA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  pendingIcon: {
    fontSize: 28,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingClient: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  pendingAddress: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 3,
  },
  pendingMachine: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
  },
  pendingDate: {
    fontSize: 12,
    color: '#94A3B8',
    textTransform: 'capitalize',
  },
  pendingRight: {
    position: 'absolute',
    top: 18,
    right: 18,
    alignItems: 'flex-end',
  },
  pendingAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F97316',
    marginBottom: 8,
  },
  pendingBadge: {
    backgroundColor: '#FED7AA',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  pendingBadgeText: {
    color: '#9A3412',
    fontSize: 11,
    fontWeight: '700',
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  paidButton: {
    backgroundColor: '#D1FAE5',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  actionButtonText: {
    fontWeight: '700',
    fontSize: 14,
    color: '#1F2937',
  },
});