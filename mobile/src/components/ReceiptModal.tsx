import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Image,
  Platform,
} from 'react-native';
import { ReceiptPreviewData } from '../types';
import { ReceiptShareService } from '../services/receiptShareService';
import { BACKEND_URL } from '../services/api';

const miniledgerLogo = require('../../assets/images/miniledger_logo.png');

interface ReceiptModalProps {
  visible: boolean;
  receipt: ReceiptPreviewData | null;
  authToken: string;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  visible,
  receipt,
  authToken,
  onClose,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [localPdfUri, setLocalPdfUri] = useState<string | null>(null);

  if (!receipt) return null;

  const isRepayment = receipt.receiptType === 'REPAYMENT';
  const isRepaid = receipt.status === 'REPAID';

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const result = await ReceiptShareService.downloadReceiptPdf(
        BACKEND_URL,
        receipt.loanId,
        receipt.receiptType.toLowerCase() as 'loan' | 'repayment',
        receipt.safeFilename,
        authToken
      );
      setLocalPdfUri(result.uri);
      Alert.alert(
        'Receipt Saved',
        `MiniLedger receipt saved as:\n${receipt.safeFilename}`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Download Failed', error.message || 'Unable to download receipt.');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      let targetUri = localPdfUri;

      if (!targetUri) {
        const result = await ReceiptShareService.downloadReceiptPdf(
          BACKEND_URL,
          receipt.loanId,
          receipt.receiptType.toLowerCase() as 'loan' | 'repayment',
          receipt.safeFilename,
          authToken
        );
        targetUri = result.uri;
        setLocalPdfUri(targetUri);
      }

      await ReceiptShareService.shareReceiptPdf(
        targetUri,
        `Share MiniLedger ${receipt.receiptType === 'LOAN' ? 'Loan Receipt' : 'Repayment Receipt'}`
      );
    } catch (error: any) {
      Alert.alert('Sharing Error', error.message || 'Could not open share sheet.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Top Bar with Brand and Close Button */}
          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <Image source={miniledgerLogo} style={styles.brandLogoImg} resizeMode="contain" />
              <View>
                <Text style={styles.modalHeaderTitle}>MiniLedger Official Receipt</Text>
                <Text style={styles.modalHeaderSubtitle}>Electronic Peer Financial Record</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close Receipt Preview">
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Receipt Body */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.receiptCard}>
              <View style={styles.goldHeaderBar} />

              {/* Type Badge & Receipt Number */}
              <View style={styles.metaRow}>
                <View>
                  <Text style={styles.metaLabel}>RECEIPT NUMBER</Text>
                  <Text style={styles.metaValueMono}>{receipt.receiptNumber}</Text>
                </View>
                <View style={[styles.typeBadge, isRepayment ? styles.repayBadge : styles.loanBadge]}>
                  <Text style={[styles.typeBadgeText, isRepayment ? styles.repayBadgeText : styles.loanBadgeText]}>
                    {isRepayment ? 'REPAYMENT RECEIPT' : 'LOAN RECORD'}
                  </Text>
                </View>
              </View>

              {/* Amount Box */}
              <View style={styles.amountContainer}>
                <Text style={styles.amountLabel}>TRANSACTION AMOUNT</Text>
                <Text style={styles.amountMain}>{receipt.amountFormatted}</Text>
                <Text style={styles.amountWords}>{receipt.amountInWords}</Text>

                <View style={[styles.statusBadge, isRepaid ? styles.statusRepaid : styles.statusOutstanding]}>
                  <Text style={[styles.statusBadgeText, isRepaid ? styles.textRepaid : styles.textOutstanding]}>
                    {isRepaid ? '✓ STATUS: SETTLED / REPAID' : '● STATUS: OUTSTANDING'}
                  </Text>
                </View>
              </View>

              {/* Details Table */}
              <View style={styles.detailsSection}>
                <Text style={styles.sectionHeader}>TRANSACTION PARTICIPANTS & DATES</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Lender (Recorded by)</Text>
                  <Text style={styles.detailValueBold}>{receipt.lenderName || 'MiniLedger User'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Borrower (Friend)</Text>
                  <Text style={styles.detailValueBold}>{receipt.friendName}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Loan Creation Date</Text>
                  <Text style={styles.detailValue}>
                    {new Date(receipt.loanDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>

                {isRepayment && receipt.repaidAt ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Repayment Date</Text>
                    <Text style={[styles.detailValueBold, { color: '#10B981' }]}>
                      {new Date(receipt.repaidAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Agreed Due Date</Text>
                    <Text style={styles.detailValue}>
                      {receipt.dueDate
                        ? new Date(receipt.dueDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Open / Not specified'}
                    </Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment Method</Text>
                  <Text style={styles.detailValue}>
                    {receipt.paymentMethod ? `${receipt.paymentMethod} (Verified)` : 'Not recorded'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Loan Reference ID</Text>
                  <Text style={[styles.detailValue, styles.referenceMono]}>
                    {receipt.loanId.substring(0, 18)}...
                  </Text>
                </View>

                {receipt.notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>Notes / Purpose</Text>
                    <Text style={styles.notesText}>{receipt.notes}</Text>
                  </View>
                ) : null}
              </View>

              {/* Disclaimer Notice */}
              <View style={styles.disclaimerContainer}>
                <Text style={styles.disclaimerTitle}>ELECTRONIC LEDGER NOTICE</Text>
                <Text style={styles.disclaimerText}>
                  This receipt is an electronic record generated by MiniLedger based on recorded transaction data. It distinguishes personal debt tracking between friends from certified banking statements.
                </Text>
              </View>

              {/* Footer */}
              <View style={styles.cardFooter}>
                <Text style={styles.footerText}>
                  Generated securely by MiniLedger • Idempotent Record ID: {receipt.id.substring(0, 8)}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons Bar */}
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.downloadBtn]}
              onPress={handleDownload}
              disabled={downloading || sharing}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#D9BC80" />
              ) : (
                <Text style={styles.downloadBtnText}>⬇ Download PDF</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.shareBtn]}
              onPress={handleShare}
              disabled={downloading || sharing}
            >
              {sharing ? (
                <ActivityIndicator size="small" color="#07101E" />
              ) : (
                <Text style={styles.shareBtnText}>➦ Share Receipt</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(28, 25, 23, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '92%',
    maxHeight: '90%',
    backgroundColor: '#FAF7F2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    overflow: 'hidden',
    shadowColor: '#8C8275',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FAF7F2',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandLogoImg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    marginRight: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    shadowColor: '#8C8275',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modalHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.3,
    fontFamily: Platform.OS === 'web' ? "'Outfit', sans-serif" : 'sans-serif',
  },
  modalHeaderSubtitle: {
    fontSize: 10,
    color: '#0D7A5F',
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EAE4DC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
  scrollView: {
    flexGrow: 1,
  },
  scrollContent: {
    padding: 16,
  },
  receiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#8C8275',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  goldHeaderBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3.5,
    backgroundColor: '#0D7A5F',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  metaValueMono: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D7A5F',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  loanBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  repayBadge: {
    backgroundColor: '#E6F4EA',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  loanBadgeText: {
    color: '#2563EB',
  },
  repayBadgeText: {
    color: '#0D7A5F',
  },
  amountContainer: {
    backgroundColor: '#F7F4EF',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    alignItems: 'center',
    marginBottom: 14,
  },
  amountLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  amountMain: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    marginVertical: 4,
    fontFamily: Platform.OS === 'web' ? "'Outfit', sans-serif" : 'sans-serif',
  },
  amountWords: {
    fontSize: 10.5,
    fontStyle: 'italic',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusOutstanding: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusRepaid: {
    backgroundColor: '#E6F4EA',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  textOutstanding: {
    color: '#B45309',
  },
  textRepaid: {
    color: '#0D7A5F',
  },
  detailsSection: {
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0D7A5F',
    letterSpacing: 0.8,
    marginBottom: 8,
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE1',
  },
  detailLabel: {
    fontSize: 11.5,
    color: '#64748B',
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  detailValue: {
    fontSize: 11.5,
    color: '#334155',
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  detailValueBold: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  referenceMono: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#0D7A5F',
    fontSize: 11,
    fontWeight: '700',
  },
  notesBox: {
    backgroundColor: '#F7F4EF',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  notesLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  notesText: {
    fontSize: 11.5,
    color: '#334155',
    marginTop: 3,
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  disclaimerContainer: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#F7F4EF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  disclaimerTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0D7A5F',
    marginBottom: 3,
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  disclaimerText: {
    fontSize: 9,
    color: '#64748B',
    lineHeight: 13,
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  cardFooter: {
    marginTop: 12,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8.5,
    color: '#64748B',
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  actionBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FAF7F2',
    borderTopWidth: 1,
    borderTopColor: '#E8E2D9',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtn: {
    backgroundColor: '#EAE4DC',
    borderWidth: 1,
    borderColor: '#DFD8CE',
  },
  downloadBtnText: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 12,
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
  shareBtn: {
    backgroundColor: '#0D7A5F',
    shadowColor: '#0D7A5F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'sans-serif',
  },
});
