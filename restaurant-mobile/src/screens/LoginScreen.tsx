import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../constants/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://hostelbites-backend-jwmt.onrender.com';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<any>();

  const handleLogin = async () => {
    const cleanIdentifier = email.trim();
    if (!cleanIdentifier || !password) return Alert.alert('Error', 'Please enter your Restaurant ID/Email and password');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/restaurants/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: cleanIdentifier, 
          email: cleanIdentifier, 
          password 
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        await AsyncStorage.setItem('restaurant_token', data.token);
        await AsyncStorage.setItem('restaurant_data', JSON.stringify(data.restaurant || {}));
        navigation.replace('Dashboard');
      } else {
        Alert.alert('Login Failed', data.message || 'Invalid credentials. Please check your Restaurant ID and password.');
      }
    } catch (e: any) {
      Alert.alert('Connection Error', e.message || 'Network request failed. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.headerGlow} />
      
      <View style={styles.content}>
        <Text style={styles.title}>ZENVY</Text>
        <Text style={styles.subtitle}>RESTAURANT KDS</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Restaurant ID / Email"
            placeholderTextColor={COLORS.textDisabled}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={COLORS.textDisabled}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity 
          style={styles.loginBtn}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={COLORS.bgDark} /> : <Text style={styles.btnText}>ACCESS KDS</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark, justifyContent: 'center', padding: 24 },
  headerGlow: { position: 'absolute', top: -100, left: -50, width: 300, height: 300, backgroundColor: COLORS.emerald, opacity: 0.1, borderRadius: 150 },
  content: { zIndex: 1 },
  title: { fontSize: 42, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: 2, textAlign: 'center' },
  subtitle: { fontSize: 12, fontWeight: '800', color: COLORS.emerald, letterSpacing: 4, textAlign: 'center', marginBottom: 48 },
  inputContainer: { gap: 16, marginBottom: 32 },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderStandard, borderRadius: 12, padding: 16, color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  loginBtn: { backgroundColor: COLORS.emerald, padding: 18, borderRadius: 12, alignItems: 'center', shadowColor: COLORS.emerald, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  btnText: { color: COLORS.bgDark, fontSize: 16, fontWeight: '900', letterSpacing: 1 }
});
