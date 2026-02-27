import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function SubscriptionExpiredScreen() {
  const handleRenew = () => {
    Alert.alert(
      '💳 Renovar Suscripción',
      'La integración con Mercado Pago se implementará pronto.\n\nPor ahora, contacta a soporte para activar tu suscripción:\n\n📧 soporte@limpio.app\n✆ 320-8707514',
      [{ text: 'Entendido' }]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            await signOut(auth);
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Ícono grande */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>⏰</Text>
        </View>

        {/* Título */}
        <Text style={styles.title}>Suscripción Vencida</Text>
        <Text style={styles.subtitle}>
          Tu período de prueba ha terminado. Renueva tu suscripción para seguir usando Limpio.
        </Text>

        {/* Beneficios */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>🎉 Al renovar obtienes:</Text>
          <View style={styles.benefitsList}>
            <Text style={styles.benefit}>✓ Lavadoras ilimitadas</Text>
            <Text style={styles.benefit}>✓ Alquileres sin límite</Text>
            <Text style={styles.benefit}>✓ Gestión de socios</Text>
            <Text style={styles.benefit}>✓ Estadísticas completas</Text>
            <Text style={styles.benefit}>✓ Notificaciones automáticas</Text>
            <Text style={styles.benefit}>✓ Soporte prioritario 24/7</Text>
          </View>
        </View>

        {/* Precio */}
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Solo por</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceAmount}>$20.000</Text>
            <Text style={styles.pricePeriod}>COP/mes</Text>
          </View>
          <Text style={styles.priceNote}>Cancela cuando quieras</Text>
        </View>

        {/* Botón de renovar */}
        <TouchableOpacity style={styles.renewButton} onPress={handleRenew}>
          <Text style={styles.renewButtonText}>💳 Renovar Suscripción</Text>
        </TouchableOpacity>

        {/* Botón de contacto */}
        <TouchableOpacity 
          style={styles.contactButton}
          onPress={() => Alert.alert(
            '📞 Contacto',
            'Contáctanos para activar tu suscripción:\n\n📧 soporte@limpio.app\n✆ 320-8707514\n\nHorario: Lun-Vie 9AM-6PM',
            [{ text: 'Entendido' }]
          )}
        >
          <Text style={styles.contactButtonText}>📞 Contactar Soporte</Text>
        </TouchableOpacity>

        {/* Botón de cerrar sesión */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 80,
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  benefitsCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  benefitsList: {
    gap: 10,
  },
  benefit: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  priceCard: {
    backgroundColor: '#8B5CF6',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    marginBottom: 24,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  priceAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: 'white',
    marginRight: 8,
  },
  pricePeriod: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  priceNote: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  renewButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    marginBottom: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  renewButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  contactButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    marginBottom: 12,
  },
  contactButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    marginTop: 20,
  },
  logoutButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});