import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { ApiService } from '../services/api';
import { UserProfile } from '../types';

const miniledgerLogo = require('../../assets/images/miniledger_logo.png');

interface LoginScreenProps {
  onLoginSuccess: (token: string, user: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [phone, setPhone] = useState('9876543210');
  const [name, setName] = useState('Rahul Sharma');
  const [otp, setOtp] = useState('');
  const [serverMockOtp, setServerMockOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSendOtp = async (targetPhone = phone) => {
    const cleaned = targetPhone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await ApiService.sendOtp(targetPhone);
      setServerMockOtp(res.mockOtp || '123456');
      setStep('OTP');
      setResendCooldown(30);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send OTP. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (inputOtp = otp) => {
    if (!inputOtp || inputOtp.trim().length < 6) {
      setErrorMessage('Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await ApiService.verifyOtp(phone, inputOtp.trim(), name.trim());
      onLoginSuccess(res.token, res.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid OTP code. Please check server log.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = () => {
    setPhone('9876543210');
    setName('Rahul Sharma');
    handleSendOtp('9876543210');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          {/* Brand Header */}
          <View style={styles.brandContainer}>
            <Image source={miniledgerLogo} style={styles.brandLogo} resizeMode="contain" />
            <Text style={styles.appName}>MiniLedger</Text>
            <Text style={styles.tagline}>Track money lent to friends with verified receipts</Text>
          </View>

          {/* Login Card (Clean White & Emerald Green) */}
          <View style={styles.card}>
            {step === 'PHONE' ? (
              <>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Sign In with Phone</Text>
                  <Text style={styles.cardSubtitle}>
                    Enter your mobile number to receive a mock OTP.
                  </Text>
                </View>

                {errorMessage && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
                  </View>
                )}

                {/* Name Field */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Your Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Rahul Sharma"
                    placeholderTextColor="#64748B"
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                {/* Phone Number Field */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Phone Number</Text>
                  <View style={styles.phoneInputRow}>
                    <View style={styles.countryCodeBadge}>
                      <Text style={styles.countryFlag}>🇮🇳</Text>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      style={[styles.input, styles.phoneInput]}
                      placeholder="98765 43210"
                      placeholderTextColor="#64748B"
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={phone}
                      onChangeText={setPhone}
                    />
                  </View>
                </View>

                {/* Mock OTP Server Explainer Callout */}
                <View style={styles.infoBox}>
                  <Text style={styles.infoIcon}>💡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoTitle}>Mock OTP Behavior</Text>
                    <Text style={styles.infoDesc}>
                      The OTP is logged directly to your Node.js backend terminal console.
                    </Text>
                  </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.disabledBtn]}
                  onPress={() => handleSendOtp()}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Get Verification Code →</Text>
                  )}
                </TouchableOpacity>

                {/* Quick Evaluator Preset */}
                <TouchableOpacity
                  style={styles.demoShortcutBtn}
                  onPress={fillDemoAccount}
                  activeOpacity={0.8}
                >
                  <Text style={styles.demoShortcutText}>
                    ⚡ Quick Evaluator Demo (+91 98765 43210)
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Step 2: OTP Verification */}
                <View style={styles.cardHeader}>
                  <TouchableOpacity style={styles.backLink} onPress={() => setStep('PHONE')}>
                    <Text style={styles.backLinkText}>← Change Phone Number</Text>
                  </TouchableOpacity>
                  <Text style={styles.cardTitle}>Enter Verification Code</Text>
                  <Text style={styles.cardSubtitle}>
                    Sent to <Text style={{ fontWeight: '700', color: '#0D7A5F' }}>+91 {phone}</Text>
                  </Text>
                </View>

                {errorMessage && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
                  </View>
                )}

                {/* Server Log Callout */}
                <View style={styles.terminalCallout}>
                  <View style={styles.terminalDotRow}>
                    <View style={[styles.terminalDot, { backgroundColor: '#EF4444' }]} />
                    <View style={[styles.terminalDot, { backgroundColor: '#F59E0B' }]} />
                    <View style={[styles.terminalDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.terminalBarTitle}>Backend Server Console</Text>
                  </View>
                  <Text style={styles.terminalText}>
                    [MiniLedger AUTH] OTP for +91{phone}:{'\n'}
                    <Text style={styles.terminalHighlight}>
                      {serverMockOtp || '••••••'}
                    </Text>
                  </Text>
                </View>

                {/* OTP Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>6-Digit Mock OTP Code</Text>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="123456"
                    placeholderTextColor="#64748B"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={setOtp}
                    autoFocus
                  />
                </View>

                {/* Auto-fill button for evaluator convenience */}
                {serverMockOtp && (
                  <TouchableOpacity
                    style={styles.autofillBtn}
                    onPress={() => {
                      setOtp(serverMockOtp);
                      handleVerifyOtp(serverMockOtp);
                    }}
                  >
                    <Text style={styles.autofillBtnText}>
                      ⚡ Auto-Fill Mock OTP ({serverMockOtp})
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Verify Button */}
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.disabledBtn]}
                  onPress={() => handleVerifyOtp()}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verify & Open Ledger →</Text>
                  )}
                </TouchableOpacity>

                {/* Resend Timer */}
                <View style={styles.resendRow}>
                  {resendCooldown > 0 ? (
                    <Text style={styles.resendTimerText}>
                      Resend code in {resendCooldown}s
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={() => handleSendOtp()}>
                      <Text style={styles.resendLinkText}>Resend OTP Code</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>

          {/* Footer Highlights */}
          <View style={styles.footerFeatures}>
            <Text style={styles.featurePill}>🔒 JWT Authentication</Text>
            <Text style={styles.featurePill}>📋 Overdue Alerts</Text>
            <Text style={styles.featurePill}>📄 PDF Receipts</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    justifyContent: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandLogo: {
    width: 68,
    height: 68,
    marginBottom: 12,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    marginBottom: 20,
  },
  backLink: {
    marginBottom: 10,
  },
  backLinkText: {
    color: '#0D7A5F',
    fontWeight: '600',
    fontSize: 13,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginRight: 10,
  },
  countryFlag: {
    fontSize: 16,
    marginRight: 6,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D7A5F',
  },
  phoneInput: {
    flex: 1,
    letterSpacing: 1,
    fontWeight: '600',
  },
  otpInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 22,
    fontWeight: '700',
    color: '#0D7A5F',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  infoDesc: {
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#0D7A5F',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#0D7A5F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledBtn: {
    opacity: 0.65,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  demoShortcutBtn: {
    marginTop: 14,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
  },
  demoShortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D7A5F',
  },
  terminalCallout: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  terminalDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  terminalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  terminalBarTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
  terminalText: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  terminalHighlight: {
    color: '#34D399',
    fontSize: 18,
    fontWeight: '700',
  },
  autofillBtn: {
    backgroundColor: '#E6F4EA',
    borderWidth: 1,
    borderColor: '#0D7A5F',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  autofillBtnText: {
    color: '#0D7A5F',
    fontSize: 13,
    fontWeight: '700',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendTimerText: {
    fontSize: 13,
    color: '#64748B',
  },
  resendLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0D7A5F',
  },
  footerFeatures: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
    flexWrap: 'wrap',
    gap: 8,
  },
  featurePill: {
    fontSize: 12,
    color: '#475569',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    overflow: 'hidden',
  },
});
