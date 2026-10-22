import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
} from 'react-native';
import { Loan, ReceiptPreviewData } from '../types';
import { ApiService, BACKEND_URL } from '../services/api';
import { ReceiptModal } from '../components/ReceiptModal';
import { ReceiptShareService } from '../services/receiptShareService';

interface LoanDetailScreenProps {
  loan: Loan;
  authToken: string;
  onBack: () => void;
  onLoanUpdated: (updatedLoan: Loan) => void;
}

export const LoanDetailScreen: React.FC<LoanDetailScreenProps> = ({
  loan,
  authToken,
  onBack,
  onLoanUpdated,
}) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ReceiptPreviewData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const isRepaid = loan.status === 'REPAID';
  const isOverdue =
    !isRepaid &&
    (loan.isOverdue || Boolean(loan.dueDate && new Date(loan.dueDate) < new Date()));

  const amountFormatted = `₹${(loan.amountPaise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const executeMarkRepaid = async () => {
    try {
      setActionLoading('repay');
      const updated = await ApiService.markLoanRepaid(loan.id, 'UPI', authToken);
      onLoanUpdated(updated);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert('Success: Loan marked as repaid! You can now generate an official Repayment Receipt.');
      } else {
        Alert.alert('Success', 'Loan marked as repaid. You can now generate an official Repayment Receipt.');
      }
    } catch (err: any) {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert(err.message || 'Failed to update loan status.');
      } else {
        Alert.alert('Error', err.message || 'Failed to update loan status.');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAsRepaid = async () => {
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined' && window.confirm
          ? window.confirm(`Mark loan of ${amountFormatted} to ${loan.friendName} as fully repaid?`)
          : true;
      if (confirmed) {
        await executeMarkRepaid();
      }
    } else {
      Alert.alert(
        'Confirm Repayment',
        `Mark loan of ${amountFormatted} to ${loan.friendName} as fully repaid?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm Repaid',
            style: 'default',
            onPress: executeMarkRepaid,
          },
        ]
      );
    }
  };

  const handleOpenReceiptPreview = async (type: 'loan' | 'repayment') => {
    try {
      setActionLoading(`preview_${type}`);
      const receipt = await ApiService.fetchReceiptPreview(loan.id, type, authToken);
      setPreviewData(receipt);
      setModalVisible(true);
    } catch (err: any) {
      Alert.alert('Receipt Error', err.message || 'Failed to generate receipt.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDirectShare = async (type: 'loan' | 'repayment') => {
    try {
      setActionLoading(`share_${type}`);
      const receipt = await ApiService.fetchReceiptPreview(loan.id, type, authToken);
      const downloadRes = await ReceiptShareService.downloadReceiptPdf(
        BACKEND_URL,
        loan.id,
        type,
        receipt.safeFilename,
        authToken
      );
      await ReceiptShareService.shareReceiptPdf(
        downloadRes.uri,
        `Share MiniLedger ${type === 'loan' ? 'Loan Receipt' : 'Repayment Receipt'}`
      );
    } catch (err: any) {
      Alert.alert('Share Failed', err.message || 'Could not share PDF receipt.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Loans</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loan Details</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Overdue Warning Callout (Assignment Requirement) */}
        {isOverdue && (
          <View style={styles.overdueDetailBanner}>
            <Text style={styles.overdueDetailIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.overdueDetailTitle}>Payment Overdue</Text>
              <Text style={styles.overdueDetailText}>
                Agreed due date was{' '}
                {loan.dueDate
                  ? new Date(loan.dueDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'past'}
                . Follow up with {loan.friendName} or share a Loan Receipt reminder.
              </Text>
            </View>
          </View>
        )}

        {/* Main Status & Amount Card */}
        <View style={[styles.heroCard, isOverdue && styles.heroCardOverdue]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroBorrowerLabel}>BORROWER (FRIEND)</Text>
              <Text style={styles.heroBorrowerName}>{loan.friendName}</Text>
            </View>

            <View
              style={[
                styles.statusPill,
                isRepaid
                  ? styles.pillRepaid
                  : isOverdue
                  ? styles.pillOverdue
                  : styles.pillPending,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  isRepaid
                    ? styles.textRepaid
                    : isOverdue
                    ? styles.textOverdue
                    : styles.textPending,
                ]}
              >
                {isRepaid ? '✓ SETTLED' : isOverdue ? '⚠️ OVERDUE' : '● OUTSTANDING'}
              </Text>
            </View>
          </View>

          <View style={styles.goldDivider} />

          <Text style={styles.heroAmountLabel}>PRINCIPAL AMOUNT</Text>
          <Text style={[styles.heroAmount, isOverdue && { color: '#DC2626' }]}>
            {amountFormatted}
          </Text>

          {loan.notes ? <Text style={styles.heroNotes}>"{loan.notes}"</Text> : null}
        </View>

        {/* Specifications Table */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Loan Specifications</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Loan Date</Text>
            <Text style={styles.infoValue}>
              {new Date(loan.loanDate).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>

          {isRepaid && loan.repaidAt ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Repayment Date</Text>
              <Text style={[styles.infoValue, { color: '#10B981', fontWeight: '800' }]}>
                {new Date(loan.repaidAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
          ) : (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Agreed Due Date</Text>
              <Text
                style={[
                  styles.infoValue,
                  isOverdue && { color: '#DC2626', fontWeight: '800' },
                ]}
              >
                {loan.dueDate
                  ? `${new Date(loan.dueDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })} ${isOverdue ? '(Overdue)' : ''}`
                  : 'Open terms'}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment Method</Text>
            <Text style={styles.infoValue}>
              {loan.paymentMethod
                ? `${loan.paymentMethod} ${loan.paymentVerified ? '(Verified)' : ''}`
                : 'Not specified'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Loan Reference ID</Text>
            <Text style={[styles.infoValue, styles.monoText]}>{loan.id.substring(0, 16)}...</Text>
          </View>
        </View>

        {/* Bonus: Attached Receipt Photo Card */}
        {loan.receiptImage && (
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>Attached Transaction Receipt</Text>
            <Text style={styles.cardDesc}>
              Original receipt photo recorded with this entry:
            </Text>
            <TouchableOpacity
              onPress={() => setShowPhotoModal(true)}
              style={styles.photoContainer}
              activeOpacity={0.85}
            >
              <Image source={{ uri: loan.receiptImage }} style={styles.photoImg} />
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeText}>🔍 Tap to View Full Image</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Repayment Action (if pending) */}
        {!isRepaid && (
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>Settle Balance</Text>
            <Text style={styles.cardDesc}>
              Once your friend repays this loan, mark it as settled to unlock official Repayment Receipt generation.
            </Text>

            <TouchableOpacity
              style={styles.repayButton}
              onPress={handleMarkAsRepaid}
              disabled={actionLoading === 'repay'}
            >
              {actionLoading === 'repay' ? (
                <ActivityIndicator color="#07101E" />
              ) : (
                <Text style={styles.repayButtonText}>✓ Mark Loan as Fully Repaid</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Receipt Workflows */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Receipt Generation & Sharing</Text>
          <Text style={styles.cardDesc}>
            Generate an official PDF receipt with immutable database snapshot and unique numbering.
          </Text>

          {isRepaid ? (
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() => handleOpenReceiptPreview('repayment')}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'preview_repayment' ? (
                <ActivityIndicator color="#07101E" />
              ) : (
                <Text style={styles.primaryActionBtnText}>📄 Preview & Share Repayment Receipt</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() => handleOpenReceiptPreview('loan')}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'preview_loan' ? (
                <ActivityIndicator color="#07101E" />
              ) : (
                <Text style={styles.primaryActionBtnText}>📄 Preview & Share Loan Receipt</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.quickShareRow}>
            {isRepaid ? (
              <>
                <TouchableOpacity
                  style={styles.secondaryShareBtn}
                  onPress={() => handleDirectShare('repayment')}
                  disabled={actionLoading !== null}
                >
                  <Text style={styles.secondaryShareBtnText}>Quick Share Repayment PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryShareBtn, { marginTop: 8 }]}
                  onPress={() => handleOpenReceiptPreview('loan')}
                  disabled={actionLoading !== null}
                >
                  <Text style={styles.secondaryShareBtnText}>View Historical Loan Receipt</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.secondaryShareBtn}
                onPress={() => handleDirectShare('loan')}
                disabled={actionLoading !== null}
              >
                <Text style={styles.secondaryShareBtnText}>Quick Share Loan PDF</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Instant Native Receipt Preview Modal */}
      {previewData && (
        <ReceiptModal
          visible={modalVisible}
          receipt={previewData}
          authToken={authToken}
          onClose={() => setModalVisible(false)}
        />
      )}

      {/* Lightbox Photo Modal */}
      <Modal visible={showPhotoModal} transparent animationType="fade">
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity style={styles.lightboxCloseBtn} onPress={() => setShowPhotoModal(false)}>
            <Text style={styles.lightboxCloseText}>✕ Close</Text>
          </TouchableOpacity>
          {loan.receiptImage && (
            <Image source={{ uri: loan.receiptImage }} style={styles.lightboxImg} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#0D7A5F',
    fontSize: 13,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  overdueDetailBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  overdueDetailIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  overdueDetailTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  overdueDetailText: {
    fontSize: 12,
    color: '#991B1B',
    marginTop: 2,
    lineHeight: 16,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  heroCardOverdue: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
    backgroundColor: '#FFFDFD',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroBorrowerLabel: {
    color: '#64748B',
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '800',
  },
  heroBorrowerName: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  pillPending: {
    backgroundColor: '#FEF3C7',
  },
  pillRepaid: {
    backgroundColor: '#D1FAE5',
  },
  pillOverdue: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textPending: {
    color: '#B45309',
  },
  textRepaid: {
    color: '#065F46',
  },
  textOverdue: {
    color: '#DC2626',
  },
  goldDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  heroAmountLabel: {
    color: '#64748B',
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
  },
  heroAmount: {
    color: '#0D7A5F',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  heroNotes: {
    color: '#64748B',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  cardDesc: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  infoValue: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  monoText: {
    fontFamily: 'monospace',
    color: '#64748B',
  },
  repayButton: {
    backgroundColor: '#0D7A5F',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  repayButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryActionBtn: {
    backgroundColor: '#0D7A5F',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  quickShareRow: {
    marginTop: 2,
  },
  secondaryShareBtn: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryShareBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  photoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    height: 180,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  photoBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
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
  lightboxImg: {
    width: '100%',
    height: '80%',
    borderRadius: 12,
  },
});
