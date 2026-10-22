import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export interface DownloadResult {
  uri: string;
  filename: string;
  mimeType: string;
}

export class ReceiptShareService {
  /**
   * Downloads the authoritative PDF receipt from the backend to local device storage.
   * Uses Authorization header securely (never embeds tokens in URL or query params).
   */
  static async downloadReceiptPdf(
    backendBaseUrl: string,
    loanId: string,
    receiptType: 'loan' | 'repayment',
    suggestedFilename: string,
    authToken: string
  ): Promise<DownloadResult> {
    const downloadUrl = `${backendBaseUrl}/api/loans/${loanId}/receipt?type=${receiptType}`;
    const safeFilename = suggestedFilename || `MiniLedger-Receipt-${loanId.substring(0, 8)}.pdf`;

    // Web Fallback for browser testing
    if (Platform.OS === 'web') {
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        let errMessage = 'Failed to download receipt from server';
        try {
          const errJson = await response.json();
          errMessage = errJson.message || errMessage;
        } catch (_) {}
        throw new Error(errMessage);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = safeFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      return {
        uri: blobUrl,
        filename: safeFilename,
        mimeType: 'application/pdf',
      };
    }

    // Native Mobile Workflow (Android / iOS)
    const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    if (!baseDir) {
      throw new Error('Device storage directory is not accessible');
    }

    const localUri = `${baseDir}${safeFilename}`;

    // Download with secure Authorization header
    const downloadRes = await FileSystem.downloadAsync(downloadUrl, localUri, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (downloadRes.status !== 200) {
      // Clean up failed file if any was created
      try {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
      } catch (_) {}

      throw new Error(`Download failed with status ${downloadRes.status}. Please check permissions or network.`);
    }

    const fileInfo = await FileSystem.getInfoAsync(downloadRes.uri);
    if (!fileInfo.exists || ('size' in fileInfo && fileInfo.size === 0)) {
      throw new Error('Downloaded receipt file is empty or corrupted');
    }

    return {
      uri: downloadRes.uri,
      filename: safeFilename,
      mimeType: 'application/pdf',
    };
  }

  /**
   * Opens the native Android/iOS share sheet to share the PDF via WhatsApp, Email, Drive, etc.
   */
  static async shareReceiptPdf(localUri: string, dialogTitle: string = 'Share MiniLedger Receipt'): Promise<boolean> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Native sharing is not supported on this platform');
      }

      await Sharing.shareAsync(localUri, {
        mimeType: 'application/pdf',
        dialogTitle,
        UTI: 'com.adobe.pdf',
      });

      return true;
    } catch (error: any) {
      // User cancellation is not a critical error
      if (error?.message?.includes('User did not share') || error?.message?.includes('cancel')) {
        return false;
      }
      throw error;
    }
  }
}
