import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Modal,
  ActivityIndicator
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getPayments } from '../services/firestoreService';

export default function IncomeScreen({ navigation }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [customDate, setCustomDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const data = await getPayments();
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setPayments(data);
    } catch (error) {
      console.error('Error al cargar pagos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredPayments = () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0];
    const last7Days = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7);
    const selectedDate = customDate.toISOString().split('T')[0];

    switch(period) {
      case 'today':
        return payments.filter(p => p.date === today);
      case 'yesterday':
        return payments.filter(p => p.date === yesterday);
      case 'week':
        return payments.filter(p => p.date >= last7Days);
      case 'month':
        return payments.filter(p => p.date.startsWith(thisMonth));
      case 'custom':
        return payments.filter(p => p.date === selectedDate);
      default:
        return payments;
    }
  };

  const filtered = getFilteredPayments();
  const total = filtered.reduce((sum, p) => sum + p.amount, 0);

  const getPeriodLabel = () => {
    switch(period) {
      case 'today': return 'Hoy';
      case 'yesterday': return 'Ayer';
      case 'week': return 'Últimos 7 días';
      case 'month': return 'Este Mes';
      case 'custom': 
        return customDate.toLocaleDateString('es-CO', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        });
      default: return '';
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setCustomDate(selectedDate);
      setPeriod('custom');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Atrás</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ingresos</Text>
          <View style={{ width: 70 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10B981" />
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
          <Text style={styles.headerTitle}>Ingresos 💰</Text>
          <Text style={styles.headerSubtitle}>{payments.length} pagos totales</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.content}>
        {/* Total Card */}
        <View style={styles.totalCard}>
          <View style={styles.totalHeader}>
            <View>
              <Text style={styles.totalLabel}>{getPeriodLabel()}</Text>
              <Text style={styles.totalAmount}>${total.toLocaleString()}</Text>
              <Text style={styles.totalSubtext}>COP</Text>
            </View>
            <View style={styles.totalIcon}>
              <Text style={styles.totalIconText}>💰</Text>
            </View>
          </View>
          <View style={styles.totalFooter}>
            <View style={styles.totalStat}>
              <Text style={styles.totalStatNumber}>{filtered.length}</Text>
              <Text style={styles.totalStatLabel}>Pagos</Text>
            </View>
          </View>
        </View>

        {/* Filtros */}
        <View style={styles.filtersSection}>
          <Text style={styles.sectionTitle}>Filtrar por periodo</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
          >
            {[
              { key: 'today', label: '📅 Hoy' },
              { key: 'yesterday', label: '📆 Ayer' },
              { key: 'week', label: '📊 7 días' },
              { key: 'month', label: '🗓️ Mes' }
            ].map(filter => (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.filterChip,
                  period === filter.key && styles.filterChipActive
                ]}
                onPress={() => setPeriod(filter.key)}
              >
                <Text style={[
                  styles.filterChipText,
                  period === filter.key && styles.filterChipTextActive
                ]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={[
                styles.filterChip,
                styles.calendarChip,
                period === 'custom' && styles.filterChipActive
              ]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[
                styles.filterChipText,
                period === 'custom' && styles.filterChipTextActive
              ]}>
                📅 {period === 'custom' ? customDate.getDate() + '/' + (customDate.getMonth() + 1) : 'Fecha'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={customDate}
            mode="date"
            display="default"
            onChange={onDateChange}
            maximumDate={new Date()}
          />
        )}

        {/* Lista de pagos */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Historial de Pagos</Text>
          
          <ScrollView style={styles.paymentsList} showsVerticalScrollIndicator={false}>
            {filtered.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>💰</Text>
                <Text style={styles.emptyTitle}>No hay pagos en este periodo</Text>
                <Text style={styles.emptySubtext}>Los pagos aparecerán aquí</Text>
              </View>
            ) : (
              filtered.map(payment => (
                <View key={payment.id} style={styles.paymentCard}>
                  <View style={styles.paymentLeft}>
                    <View style={styles.paymentIcon}>
                      <Text style={styles.paymentIconText}>💵</Text>
                    </View>
                    <View style={styles.paymentInfo}>
                      <Text style={styles.paymentMachine}>
                        Lavadora #{payment.machineNumber}
                      </Text>
                      <Text style={styles.paymentAddress}>{payment.address}</Text>
                      <Text style={styles.paymentDate}>
                        {new Date(payment.date).toLocaleDateString('es-CO', {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short'
                        })}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={styles.paymentAmount}>${payment.amount.toLocaleString()}</Text>
                    <View style={styles.paidBadge}>
                      <Text style={styles.paidText}>✓ Pagado</Text>
                    </View>
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
    backgroundColor: '#10B981',
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
    backgroundColor: '#10B981',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    marginTop: -40,
    shadowColor: '#10B981',
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
  filtersSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 12,
  },
  filtersScroll: {
    flexGrow: 0,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'white',
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterChipActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  calendarChip: {
    paddingHorizontal: 16,
  },
  filterChipText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
  },
  filterChipTextActive: {
    color: 'white',
  },
  historySection: {
    flex: 1,
  },
  paymentsList: {
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
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
  },
  paymentCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentIconText: {
    fontSize: 24,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentMachine: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 3,
  },
  paymentAddress: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 3,
  },
  paymentDate: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'capitalize',
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 6,
  },
  paidBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  paidText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '700',
  },
});