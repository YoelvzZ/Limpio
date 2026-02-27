import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBboftGuy3GM5AGTCsds7vrfhv-X4C5toI",
  authDomain: "laundrymanager-a6fa2.firebaseapp.com",
  projectId: "laundrymanager-a6fa2",
  storageBucket: "laundrymanager-a6fa2.firebasestorage.app",
  messagingSenderId: "94545827994",
  appId: "1:94545827994:web:a7e011ed0288252548a723"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore
export const db = getFirestore(app);

// Inicializar Auth con persistencia para React Native
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});