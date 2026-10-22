import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { UserProfile } from './src/types';

const STORAGE_KEY_TOKEN = 'miniledger_auth_token';
const STORAGE_KEY_USER = 'miniledger_auth_user';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Restore session from localStorage if available (on web)
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedToken = window.localStorage.getItem(STORAGE_KEY_TOKEN);
        const savedUserStr = window.localStorage.getItem(STORAGE_KEY_USER);
        if (savedToken && savedUserStr) {
          setToken(savedToken);
          setUser(JSON.parse(savedUserStr));
        }
      }
    } catch (e) {
      console.warn('Could not restore local session:', e);
    } finally {
      setInitializing(false);
    }
  }, []);

  const handleLoginSuccess = (authToken: string, loggedInUser: UserProfile) => {
    setToken(authToken);
    setUser(loggedInUser);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_TOKEN, authToken);
        window.localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(loggedInUser));
      }
    } catch (e) {
      console.warn('Could not persist session:', e);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY_TOKEN);
        window.localStorage.removeItem(STORAGE_KEY_USER);
      }
    } catch (e) {
      console.warn('Could not clear local session:', e);
    }
  };

  if (initializing) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0D7A5F" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {token && user ? (
        <HomeScreen authToken={token} currentUser={user} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
  },
});
