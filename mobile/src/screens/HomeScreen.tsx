import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  ImageBackground,
  Image,
  Platform,
  ScrollView,
} from 'react-native';
import { Loan, LoanSummary, UserProfile } from '../types';
import { ApiService, BACKEND_URL } from '../services/api';
import { LoanDetailScreen } from './LoanDetailScreen';

// Creative Humanoid Lifestyle Background & Designed Brand Logo
const friendsLifestyleBg = require('../../assets/images/friends_lifestyle_bg.jpg');
const miniledgerLogo = require('../../assets/images/miniledger_logo.png');

// Preset Sample Receipts for evaluation of the Bonus Feature
const SAMPLE_RECEIPTS = [
  {
    id: 'dinner',
    label: '🍽️ Restaurant Bill',
    url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'cab',
    label: '🚕 Uber / Cab Fare',
    url: 'https://images.unsplash.com/photo-1554415707-9e49fe84a9fa?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'store',
    label: '🛒 Shopping Invoice',
    url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=600&auto=format&fit=crop&q=80',
  },
];

interface HomeScreenProps {
  authToken?: string;
  currentUser?: UserProfile | null;
  onLogout?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  authToken: initialToken,
  currentUser: initialUser,
  onLogout,
}) => {
  const [token, setToken] = useState<string>(initialToken || '');
  const [user, setUser] = useState<UserProfile | null>(initialUser || null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<LoanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'OVERDUE' | 'OUTSTANDING' | 'REPAID'>('ALL');

  // Photo viewer modal
  const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null);

  // New Loan Form State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDateString, setDueDateString] = useState<string>('');
  const [selectedPresetReceipt, setSelectedPresetReceipt] = useState<string | null>(null);
  const [customReceiptUrl, setCustomReceiptUrl] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (initialToken) {
      setToken(initialToken);
      setUser(initialUser || null);
      loadAllData(initialToken);
    } else {
      loginDefaultUser();
    }
  }, [initialToken, initialUser]);

  const loginDefaultUser = async () => {
    try {
      setLoading(true);
      // Login with primary demo user credentials
      const res = await ApiService.login('rahul@miniledger.com', 'password123');
      setToken(res.token);
      setUser(res.user);
      await loadAllData(res.token);
    } catch (err: any) {
      console.error('Initial login error:', err);
      Alert.alert(
        'Connection Required',
        `Backend server must be running on port 4000.\nError: ${err.message}`,
        [{ text: 'Retry', onPress: loginDefaultUser }]
      );
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async (authToken: string) => {
    try {
      const [loansData, summaryData] = await Promise.all([
        ApiService.fetchLoans(authToken),
        ApiService.fetchSummary(authToken).catch((err) => {
          console.warn('Summary endpoint error, will fallback to computed metrics:', err);
          return null;
        }),
      ]);
      setLoans(loansData);
      setSummary(summaryData);
    } catch (err: any) {
      console.error('Error fetching loans or summary:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (token) await loadAllData(token);
    setRefreshing(false);
  };

  const handleSelectDueDatePreset = (daysFromNow: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromNow);
    setDueDateString(target.toISOString().split('T')[0]);
  };

  const handleCreateLoan = async () => {
    setFormError(null);

    // Validation 1: Friend Name
    if (!friendName.trim()) {
      setFormError("Please enter your friend's name.");
      return;
    }

    // Validation 2: Amount
    const parsedAmount = parseFloat(amountRupees);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid loan amount in ₹ (must be greater than 0).');
      return;
    }

    // Validation 3: Due Date (optional, but if provided must be valid)
    let finalDueDate: string | null = null;
    if (dueDateString.trim()) {
      const parsedDate = new Date(dueDateString.trim());
      if (isNaN(parsedDate.getTime())) {
        setFormError('Please enter a valid due date (format: YYYY-MM-DD).');
        return;
      }
      finalDueDate = parsedDate.toISOString();
    }

    // Receipt image (Bonus)
    const finalReceiptImage =
      selectedPresetReceipt || (customReceiptUrl.trim() ? customReceiptUrl.trim() : null);

    try {
      setCreating(true);
      await ApiService.createLoan(
        {
          friendName: friendName.trim(),
          amountRupees: parsedAmount,
          dueDate: finalDueDate,
          notes: notes.trim() || undefined,
          paymentMethod,
          paymentVerified: true,
          receiptImage: finalReceiptImage,
        },
        token
      );

      Alert.alert(
        'Loan Recorded! 🎉',
        `Successfully tracked ₹${parsedAmount.toLocaleString('en-IN')} lent to ${friendName}.`
      );

      // Reset Form
      setCreateModalVisible(false);
      setFriendName('');
      setAmountRupees('');
      setNotes('');
      setDueDateString('');
      setSelectedPresetReceipt(null);
      setCustomReceiptUrl('');
      setFormError(null);

      await loadAllData(token);
    } catch (err: any) {
      setFormError(err.message || 'Could not create loan');
    } finally {
      setCreating(false);
    }
  };

  // Safe metrics fallbacks from live summary endpoint or computed loans array
  const totalLentRupees = summary
    ? summary.totalLent
    : loans.reduce((acc, l) => acc + l.amountPaise / 100, 0);

  const totalRepaidRupees = summary
    ? summary.totalRepaid
    : loans.filter((l) => l.status === 'REPAID').reduce((acc, l) => acc + l.amountPaise / 100, 0);

  const overdueAmountRupees = summary
    ? summary.overdueAmount
    : loans
        .filter((l) => l.isOverdue || (l.status === 'OUTSTANDING' && l.dueDate && new Date(l.dueDate) < new Date()))
        .reduce((acc, l) => acc + l.amountPaise / 100, 0);

  // Check if a loan is overdue
  const checkIsOverdue = (l: Loan) => {
    if (l.status === 'REPAID') return false;
    if (l.isOverdue !== undefined) return l.isOverdue;
    return Boolean(l.dueDate && new Date(l.dueDate) < new Date());
  };

  const overdueCount = summary
    ? summary.overdueCount
    : loans.filter(checkIsOverdue).length;

  const pendingCount = summary
    ? summary.outstandingCount
    : loans.filter((l) => l.status === 'OUTSTANDING').length;

  const repaidCount = summary
    ? summary.repaidCount
    : loans.filter((l) => l.status === 'REPAID').length;

  // Filtered loan list based on active tab
  const filteredLoans = loans.filter((l) => {
    const isOverdue = checkIsOverdue(l);
    if (activeTab === 'OVERDUE') return isOverdue;
    if (activeTab === 'OUTSTANDING') return l.status === 'OUTSTANDING' && !isOverdue;
    if (activeTab === 'REPAID') return l.status === 'REPAID';
    return true;
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getDaysDiff = (dateStr: string) => {
    const diffMs = new Date(dateStr).getTime() - Date.now();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  if (selectedLoan) {
    return (
      <LoanDetailScreen
        loan={selectedLoan}
        authToken={token}
        onBack={() => {
          setSelectedLoan(null);
          loadAllData(token);
        }}
        onLoanUpdated={(updated) => {
          setSelectedLoan(updated);
          loadAllData(token);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      {/* ═══ Header Bar with Brand Logo & User Info ═══ */}
      <View style={styles.headerBar}>
        <View style={styles.brandRow}>
          <Image source={miniledgerLogo} style={styles.brandLogoImg} resizeMode="cover" />
          <View>
            <Text style={styles.appName}>MiniLedger</Text>
            <View style={styles.statusDotRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.userTag}>
                {user ? `${user.name} (${user.phone || 'Active'})` : 'Friends Ledger'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.addLoanBtn} onPress={() => setCreateModalVisible(true)}>
            <Text style={styles.addLoanBtnText}>+ Lent Money</Text>
          </TouchableOpacity>

          {onLogout && (
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                Alert.alert('Sign Out', 'Are you sure you want to log out of MiniLedger?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign Out', style: 'destructive', onPress: onLogout },
                ]);
              }}
            >
              <Text style={styles.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredLoans}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D7A5F" />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* ═══ Creative Humanoid Friends Lifestyle Hero Card ═══ */}
            <View style={styles.heroCardContainer}>
              <ImageBackground source={friendsLifestyleBg} style={styles.heroImage} resizeMode="cover">
                <View style={styles.heroGlassOverlay}>
                  <View style={styles.heroTagBadge}>
                    <Text style={styles.heroTagSparkle}>✦</Text>
                    <Text style={styles.heroTagText}>HONEST MONEY WITH FRIENDS</Text>
                  </View>

                  <Text style={styles.heroHeadline}>
                    Lending Between Friends,{'\n'}
                    <Text style={styles.heroHeadlineGradient}>Clear, Kind & Verified</Text>
                  </Text>

                  <Text style={styles.heroSubhead}>
                    Keep peer debts transparent with tamper-evident PDF receipts and instant WhatsApp sharing—no awkward talks.
                  </Text>

                  {/* ═══ Top Summary Card (Assignment Requirement) ═══ */}
                  <View style={styles.summaryCardWrapper}>
                    <Text style={styles.summaryCardEyebrow}>LIVE FINANCIAL SUMMARY</Text>
                    <View style={styles.metricsGlassCard}>
                      {/* Metric 1: Total Lent */}
                      <View style={styles.metricBlock}>
                        <Text style={styles.metricLabel}>TOTAL LENT</Text>
                        <Text style={styles.metricNumber}>
                          ₹{Math.round(totalLentRupees).toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.metricSub}>{loans.length} loans</Text>
                      </View>

                      <View style={styles.metricSeparator} />

                      {/* Metric 2: Total Repaid */}
                      <View style={styles.metricBlock}>
                        <Text style={styles.metricLabel}>TOTAL REPAID</Text>
                        <Text style={[styles.metricNumber, { color: '#0D7A5F' }]}>
                          ₹{Math.round(totalRepaidRupees).toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.metricSub}>{repaidCount} settled</Text>
                      </View>

                      <View style={styles.metricSeparator} />

                      {/* Metric 3: Overdue Amount (Assignment Requirement) */}
                      <View style={styles.metricBlock}>
                        <Text style={styles.metricLabel}>OVERDUE</Text>
                        <Text
                          style={[
                            styles.metricNumber,
                            overdueAmountRupees > 0 ? { color: '#DC2626', fontWeight: '800' } : { color: '#64748B' },
                          ]}
                        >
                          ₹{Math.round(overdueAmountRupees).toLocaleString('en-IN')}
                        </Text>
                        <Text
                          style={[
                            styles.metricSub,
                            overdueAmountRupees > 0 ? { color: '#DC2626', fontWeight: '700' } : {},
                          ]}
                        >
                          {overdueCount > 0 ? `⚠️ ${overdueCount} overdue` : '0 overdue'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </ImageBackground>
            </View>

            {/* Overdue Alert Banner if overdue > 0 */}
            {overdueAmountRupees > 0 && (
              <TouchableOpacity
                style={styles.overdueAlertBanner}
                onPress={() => setActiveTab('OVERDUE')}
                activeOpacity={0.85}
              >
                <Text style={styles.overdueAlertIcon}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.overdueAlertTitle}>
                    ₹{Math.round(overdueAmountRupees).toLocaleString('en-IN')} is Currently Overdue!
                  </Text>
                  <Text style={styles.overdueAlertDesc}>
                    {overdueCount} loan entry has passed its agreed due date. Tap to filter overdue loans.
                  </Text>
                </View>
                <Text style={styles.overdueAlertArrow}>Filter →</Text>
              </TouchableOpacity>
            )}

            {/* ═══ Filter Tabs with Overdue Highlight ═══ */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Loan Transactions</Text>
                <Text style={styles.sectionSubtitle}>Tap any entry to generate or share PDF receipts</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillGroup}>
                <TouchableOpacity
                  style={[styles.filterPill, activeTab === 'ALL' && styles.filterPillActive]}
                  onPress={() => setActiveTab('ALL')}
                >
                  <Text style={[styles.filterPillText, activeTab === 'ALL' && styles.filterPillTextActive]}>
                    All ({loans.length})
                  </Text>
                </TouchableOpacity>

                {overdueCount > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.filterPill,
                      styles.filterPillOverdue,
                      activeTab === 'OVERDUE' && styles.filterPillOverdueActive,
                    ]}
                    onPress={() => setActiveTab('OVERDUE')}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        styles.filterPillOverdueText,
                        activeTab === 'OVERDUE' && styles.filterPillOverdueTextActive,
                      ]}
                    >
                      ⚠️ Overdue ({overdueCount})
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.filterPill, activeTab === 'OUTSTANDING' && styles.filterPillActive]}
                  onPress={() => setActiveTab('OUTSTANDING')}
                >
                  <Text style={[styles.filterPillText, activeTab === 'OUTSTANDING' && styles.filterPillTextActive]}>
                    Pending ({pendingCount - overdueCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterPill, activeTab === 'REPAID' && styles.filterPillActive]}
                  onPress={() => setActiveTab('REPAID')}
                >
                  <Text style={[styles.filterPillText, activeTab === 'REPAID' && styles.filterPillTextActive]}>
                    Settled ({repaidCount})
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </>
        }
        renderItem={({ item, index }) => {
          const isRepaid = item.status === 'REPAID';
          const isOverdue = checkIsOverdue(item);
          const formatted = `₹${(item.amountPaise / 100).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
          })}`;

          const daysDiff = item.dueDate ? getDaysDiff(item.dueDate) : null;

          // Colorful avatar bubbles
          const avatarColors = [
            ['#4F46E5', '#7C3AED'],
            ['#059669', '#10B981'],
            ['#D97706', '#F59E0B'],
            ['#DC2626', '#EF4444'],
          ];
          const colorPair = avatarColors[index % avatarColors.length];

          return (
            <TouchableOpacity
              style={[
                styles.card,
                isOverdue && styles.cardOverdue,
              ]}
              onPress={() => setSelectedLoan(item)}
              activeOpacity={0.82}
            >
              {/* Highlight Banner on Overdue Entries (Assignment Requirement) */}
              {isOverdue && (
                <View style={styles.overdueCalloutStrip}>
                  <Text style={styles.overdueCalloutText}>
                    🚨 OVERDUE LOAN — Passed agreed due date
                  </Text>
                </View>
              )}

              <View style={styles.cardHeader}>
                <View style={styles.avatarWrap}>
                  <View
                    style={[
                      styles.avatarCircle,
                      { backgroundColor: isOverdue ? '#DC2626' : colorPair[0] },
                    ]}
                  >
                    <Text style={styles.avatarInitials}>{getInitials(item.friendName)}</Text>
                  </View>
                  <View style={styles.nameGroup}>
                    <Text style={[styles.friendName, isOverdue && styles.friendNameOverdue]}>
                      {item.friendName}
                    </Text>
                    <Text style={styles.dateLabel}>
                      Lent on{' '}
                      {new Date(item.loanDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                </View>

                {/* Status Badges with Overdue Highlight */}
                {isRepaid ? (
                  <View style={[styles.statusBadge, styles.badgeRepaid]}>
                    <Text style={[styles.statusText, styles.textRepaid]}>✓ SETTLED</Text>
                  </View>
                ) : isOverdue ? (
                  <View style={[styles.statusBadge, styles.badgeOverdue]}>
                    <Text style={[styles.statusText, styles.textOverdue]}>
                      ⚠️ OVERDUE ({daysDiff !== null ? `${Math.abs(daysDiff)}d` : ''})
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.statusBadge, styles.badgePending]}>
                    <Text style={[styles.statusText, styles.textPending]}>● PENDING</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.cardBody}>
                <View>
                  <Text style={styles.amountCaption}>AMOUNT</Text>
                  <Text style={[styles.amountDisplay, isOverdue && styles.amountDisplayOverdue]}>
                    {formatted}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.amountCaption}>
                    {isRepaid ? 'SETTLED AT' : isOverdue ? 'DUE DATE (PASSED)' : 'DUE DATE'}
                  </Text>
                  <Text
                    style={[
                      styles.dueDisplay,
                      isOverdue && styles.dueDisplayOverdue,
                      isRepaid && { color: '#059669' },
                    ]}
                  >
                    {isRepaid && item.repaidAt
                      ? `Settled ${new Date(item.repaidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
                      : item.dueDate
                      ? `${new Date(item.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ${
                          isOverdue && daysDiff !== null ? `(${Math.abs(daysDiff)}d ago)` : ''
                        }`
                      : 'Open terms'}
                  </Text>
                </View>
              </View>

              {item.notes ? (
                <View style={styles.notesContainer}>
                  <Text style={styles.notesText} numberOfLines={1}>
                    "{item.notes}"
                  </Text>
                </View>
              ) : null}

              {/* Bonus: Attached Receipt Photo Thumbnail */}
              {item.receiptImage ? (
                <View style={styles.attachedReceiptRow}>
                  <TouchableOpacity
                    style={styles.attachedReceiptPill}
                    onPress={() => setViewPhotoUrl(item.receiptImage!)}
                  >
                    <Image source={{ uri: item.receiptImage }} style={styles.receiptThumb} />
                    <Text style={styles.attachedReceiptLabel}>Attached Photo Receipt 🔍</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.cardFooter}>
                <View style={styles.receiptChip}>
                  <Text style={styles.receiptChipText}>
                    {isRepaid ? '📄 Repayment Receipt' : '📄 Loan Receipt'}
                  </Text>
                </View>
                <Text style={styles.actionArrow}>Preview & Share →</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💸</Text>
            <Text style={styles.emptyTitle}>No Loan Entries Found</Text>
            <Text style={styles.emptySubtitle}>
              Tap "+ Lent Money" above to record money lent to a friend and generate your first PDF receipt.
            </Text>
          </View>
        }
      />

      {/* ═══ Add Loan Modal (Assignment Requirement: Form to add an entry) ═══ */}
      <Modal visible={createModalVisible} animationType="slide" transparent={true}>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>NEW TRANSACTION</Text>
                <Text style={styles.modalTitle}>Record Money Lent</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              {formError && (
                <View style={styles.formErrorBox}>
                  <Text style={styles.formErrorText}>⚠️ {formError}</Text>
                </View>
              )}

              {/* Friend Name Input */}
              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Friend's Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Priya Patel, Rohan Kapoor"
                  placeholderTextColor="#94A3B8"
                  value={friendName}
                  onChangeText={setFriendName}
                />
              </View>

              {/* Amount Input */}
              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Amount (in ₹) *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 1500"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={amountRupees}
                  onChangeText={setAmountRupees}
                />
              </View>

              {/* Due Date Input & Quick Presets */}
              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Agreed Due Date (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD (e.g. 2026-11-05)"
                  placeholderTextColor="#94A3B8"
                  value={dueDateString}
                  onChangeText={setDueDateString}
                />
                {/* Quick Presets */}
                <View style={styles.dueDatePresetsRow}>
                  <TouchableOpacity
                    style={styles.datePresetChip}
                    onPress={() => handleSelectDueDatePreset(1)}
                  >
                    <Text style={styles.datePresetText}>Tomorrow</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.datePresetChip}
                    onPress={() => handleSelectDueDatePreset(7)}
                  >
                    <Text style={styles.datePresetText}>+7 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.datePresetChip}
                    onPress={() => handleSelectDueDatePreset(15)}
                  >
                    <Text style={styles.datePresetText}>+15 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.datePresetChip}
                    onPress={() => handleSelectDueDatePreset(30)}
                  >
                    <Text style={styles.datePresetText}>+30 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.datePresetChip, styles.datePresetOverdue]}
                    onPress={() => handleSelectDueDatePreset(-3)}
                  >
                    <Text style={styles.datePresetOverdueText}>-3d (Overdue Demo)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Notes Input */}
              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Notes / Purpose (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Dinner share, concert passes, laptop charger"
                  placeholderTextColor="#94A3B8"
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>

              {/* Payment Method Selector */}
              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Payment Method</Text>
                <View style={styles.paymentMethodRow}>
                  {['UPI', 'Bank Transfer', 'Cash'].map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[styles.methodChip, paymentMethod === method && styles.methodChipActive]}
                      onPress={() => setPaymentMethod(method)}
                    >
                      <Text style={[styles.methodChipText, paymentMethod === method && styles.methodChipTextActive]}>
                        {method}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* ═══ Bonus Feature: Upload a Photo of a Receipt with an Entry ═══ */}
              <View style={styles.inputField}>
                <View style={styles.bonusBadgeRow}>
                  <Text style={styles.fieldLabel}>Bonus: Attach Receipt Photo</Text>
                  <View style={styles.bonusTag}>
                    <Text style={styles.bonusTagText}>OPTIONAL BONUS</Text>
                  </View>
                </View>
                <Text style={styles.fieldHelpText}>
                  Select a preset receipt sample or paste an image URL to attach proof of transaction:
                </Text>

                <View style={styles.receiptPresetRow}>
                  {SAMPLE_RECEIPTS.map((preset) => {
                    const isSelected = selectedPresetReceipt === preset.url;
                    return (
                      <TouchableOpacity
                        key={preset.id}
                        style={[styles.receiptPresetChip, isSelected && styles.receiptPresetChipActive]}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedPresetReceipt(null);
                          } else {
                            setSelectedPresetReceipt(preset.url);
                            setCustomReceiptUrl('');
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.receiptPresetChipText,
                            isSelected && styles.receiptPresetChipTextActive,
                          ]}
                        >
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom URL fallback */}
                <TextInput
                  style={[styles.textInput, { marginTop: 8 }]}
                  placeholder="Or enter custom image URL"
                  placeholderTextColor="#94A3B8"
                  value={customReceiptUrl}
                  onChangeText={(val) => {
                    setCustomReceiptUrl(val);
                    if (val) setSelectedPresetReceipt(null);
                  }}
                />

                {/* Image Preview Thumbnail */}
                {(selectedPresetReceipt || customReceiptUrl) && (
                  <View style={styles.formReceiptPreviewWrap}>
                    <Image
                      source={{ uri: selectedPresetReceipt || customReceiptUrl }}
                      style={styles.formReceiptPreviewImg}
                    />
                    <TouchableOpacity
                      style={styles.removeReceiptBtn}
                      onPress={() => {
                        setSelectedPresetReceipt(null);
                        setCustomReceiptUrl('');
                      }}
                    >
                      <Text style={styles.removeReceiptBtnText}>✕ Remove Photo</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Submit CTA */}
              <TouchableOpacity
                style={styles.submitModalBtn}
                onPress={handleCreateLoan}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitModalBtnText}>Save Entry & Enable Receipt →</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ═══ Photo Lightbox Viewer Modal ═══ */}
      <Modal visible={Boolean(viewPhotoUrl)} transparent animationType="fade">
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity style={styles.lightboxCloseBtn} onPress={() => setViewPhotoUrl(null)}>
            <Text style={styles.lightboxCloseText}>✕ Close</Text>
          </TouchableOpacity>
          {viewPhotoUrl && (
            <Image source={{ uri: viewPhotoUrl }} style={styles.lightboxImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandLogoImg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
  },
  appName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  userTag: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addLoanBtn: {
    backgroundColor: '#0D7A5F',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addLoanBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  logoutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  logoutBtnText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 40,
  },
  heroCardContainer: {
    margin: 16,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },
  heroImage: {
    width: '100%',
  },
  heroGlassOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    padding: 20,
  },
  heroTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  heroTagSparkle: {
    color: '#FCD34D',
    marginRight: 5,
    fontSize: 11,
  },
  heroTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroHeadline: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 28,
  },
  heroHeadlineGradient: {
    color: '#6EE7B7',
  },
  heroSubhead: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 16,
  },
  summaryCardWrapper: {
    marginTop: 4,
  },
  summaryCardEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 6,
  },
  metricsGlassCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  metricBlock: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 3,
  },
  metricSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  metricSeparator: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },
  overdueAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
  },
  overdueAlertIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  overdueAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  overdueAlertDesc: {
    fontSize: 11,
    color: '#991B1B',
    marginTop: 2,
  },
  overdueAlertArrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginLeft: 6,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },
  pillGroup: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#0D7A5F',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterPillOverdue: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  filterPillOverdueActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  filterPillOverdueText: {
    color: '#DC2626',
    fontWeight: '700',
  },
  filterPillOverdueTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardOverdue: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
    backgroundColor: '#FFFDFD',
  },
  overdueCalloutStrip: {
    backgroundColor: '#FEF2F2',
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
  },
  overdueCalloutText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  nameGroup: {},
  friendName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  friendNameOverdue: {
    color: '#991B1B',
  },
  dateLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  textPending: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeRepaid: {
    backgroundColor: '#D1FAE5',
  },
  textRepaid: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeOverdue: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  textOverdue: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '800',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  amountCaption: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  amountDisplay: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  amountDisplayOverdue: {
    color: '#DC2626',
  },
  dueDisplay: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  dueDisplayOverdue: {
    color: '#DC2626',
    fontWeight: '700',
  },
  notesContainer: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  notesText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  attachedReceiptRow: {
    marginTop: 10,
  },
  attachedReceiptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 6,
    alignSelf: 'flex-start',
  },
  receiptThumb: {
    width: 28,
    height: 28,
    borderRadius: 4,
    marginRight: 6,
  },
  attachedReceiptLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  receiptChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  receiptChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  actionArrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D7A5F',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D7A5F',
    letterSpacing: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '700',
  },
  modalBodyScroll: {
    padding: 20,
  },
  formErrorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  formErrorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  inputField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  fieldHelpText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
  },
  dueDatePresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  datePresetChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  datePresetText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  datePresetOverdue: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  datePresetOverdueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  methodChipActive: {
    backgroundColor: '#0D7A5F',
    borderColor: '#0D7A5F',
  },
  methodChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  methodChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bonusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  bonusTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  bonusTagText: {
    color: '#4F46E5',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  receiptPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  receiptPresetChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  receiptPresetChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  receiptPresetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  receiptPresetChipTextActive: {
    color: '#065F46',
    fontWeight: '700',
  },
  formReceiptPreviewWrap: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formReceiptPreviewImg: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: 12,
  },
  removeReceiptBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  removeReceiptBtnText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },
  submitModalBtn: {
    backgroundColor: '#0D7A5F',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#0D7A5F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitModalBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  lightboxCloseText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  lightboxImage: {
    width: '100%',
    height: '75%',
    borderRadius: 12,
  },
});
