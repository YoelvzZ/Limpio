import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (isRegister && !businessName) {
      Alert.alert('Error', 'Por favor ingresa el nombre de tu empresa');
      return;
    }

    try {
      if (isRegister) {
        // Crear cuenta
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const userId = userCredential.user.uid;

        // Guardar información del usuario en Firestore
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30); // 30 días gratis

        await setDoc(doc(db, 'users', userId), {
          email: email,
          businessName: businessName,
          createdAt: new Date().toISOString(),
          notificationsEnabled: true,
          subscription: {
            status: 'trial',
            trialEndDate: trialEndDate.toISOString(),
            isPaid: false
          }
        });

        Alert.alert('¡Bienvenido! 🎉', `Cuenta creada exitosamente. Tienes 30 días gratis para probar todas las funciones.`);
      } else {
        // Iniciar sesión
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      let errorMessage = 'Ocurrió un error';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Este correo ya está registrado';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Correo electrónico inválido';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'La contraseña debe tener al menos 6 caracteres';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'Usuario no encontrado';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Contraseña incorrecta';
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Credenciales inválidas. Verifica tu correo y contraseña.';
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      Alert.alert('Error', 'Por favor ingresa tu correo electrónico');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      Alert.alert(
        '✅ Correo Enviado',
        'Revisa tu bandeja de entrada. Te hemos enviado un enlace para restablecer tu contraseña.',
        [
          {
            text: 'Entendido',
            onPress: () => {
              setShowForgotPassword(false);
              setResetEmail('');
            }
          }
        ]
      );
    } catch (error) {
      let errorMessage = 'No se pudo enviar el correo';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No existe una cuenta con este correo';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Correo electrónico inválido';
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  // Modal de Restablecer Contraseña
  if (showForgotPassword) {
    return (
      <View style={styles.container}>
        <View style={styles.forgotPasswordContainer}>
          <View style={styles.forgotPasswordCard}>
            <Text style={styles.forgotPasswordTitle}>🔑 Restablecer Contraseña</Text>
            <Text style={styles.forgotPasswordSubtitle}>
              Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
            </Text>

            <Text style={styles.label}>Correo Electrónico</Text>
            <TextInput
              style={styles.input}
              placeholder="tu@correo.com"
              value={resetEmail}
              onChangeText={setResetEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#9CA3AF"
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleForgotPassword}>
              <Text style={styles.primaryButtonText}>📧 Enviar Enlace</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => {
                setShowForgotPassword(false);
                setResetEmail('');
              }}
            >
              <Text style={styles.secondaryButtonText}>← Volver al inicio de sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header con gradiente */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>L</Text>
            </View>
            <Text style={styles.appName}>Limpio</Text>
            <Text style={styles.tagline}>Gestión inteligente de lavadoras</Text>
          </View>
        </View>

        {/* Card de formulario */}
        <View style={styles.formCard}>
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, !isRegister && styles.tabActive]}
              onPress={() => setIsRegister(false)}
            >
              <Text style={[styles.tabText, !isRegister && styles.tabTextActive]}>
                Iniciar Sesión
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, isRegister && styles.tabActive]}
              onPress={() => setIsRegister(true)}
            >
              <Text style={[styles.tabText, isRegister && styles.tabTextActive]}>
                Registrarse
              </Text>
            </TouchableOpacity>
          </View>

          {isRegister && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nombre de tu Empresa</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Lavadoras Express"
                value={businessName}
                onChangeText={setBusinessName}
                autoCapitalize="words"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Correo Electrónico</Text>
            <TextInput
              style={styles.input}
              placeholder="tu@correo.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {!isRegister && (
            <TouchableOpacity 
              style={styles.forgotPasswordButton}
              onPress={() => setShowForgotPassword(true)}
            >
              <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={handleAuth}>
            <Text style={styles.primaryButtonText}>
              {isRegister ? '✨ Crear Cuenta Gratis' : '🚀 Iniciar Sesión'}
            </Text>
          </TouchableOpacity>

          {isRegister && (
            <View style={styles.trialBanner}>
              <Text style={styles.trialIcon}>🎉</Text>
              <Text style={styles.trialText}>30 DÍAS DE PRUEBA GRATIS</Text>
              <Text style={styles.trialSubtext}>Sin tarjeta de crédito • Cancela cuando quieras</Text>
            </View>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
            <Text style={styles.switchText}>
              {isRegister 
                ? '¿Ya tienes cuenta? Inicia sesión aquí' 
                : '¿No tienes cuenta? Regístrate gratis'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Gestiona tus lavadoras, alquileres e ingresos desde un solo lugar
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0691b4',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#0691b4',
  },
  appName: {
    fontSize: 42,
    fontWeight: '900',
    color: 'white',
    marginBottom: 8,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#0691b4',
    fontWeight: '700',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    color: '#1F2937',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#0691b4',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#0691b4',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#0691b4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '800',
  },
  trialBanner: {
    backgroundColor: '#E0F2FE',
    padding: 20,
    borderRadius: 16,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0691b4',
  },
  trialIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  trialText: {
    color: '#0369a1',
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 6,
  },
  trialSubtext: {
    color: '#0891b2',
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  switchText: {
    textAlign: 'center',
    color: '#0691b4',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 40,
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 20,
  },
  // Estilos para modal de restablecer contraseña
  forgotPasswordContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  forgotPasswordCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 30,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  forgotPasswordTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  forgotPasswordSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#F3F4F6',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700',
  },
});