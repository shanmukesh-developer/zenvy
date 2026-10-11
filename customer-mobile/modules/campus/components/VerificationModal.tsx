import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { X, Mail, ShieldCheck, Camera, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { CampusColors, CampusLayout } from '../../../constants/campusTheme';
import { CampusProfileData, CampusItem } from '../../../types/campus';
import { getToken } from '../../../utils/auth';
import { requestCollegeEmailOtp, confirmCollegeEmailOtp, uploadIdCardForVerification } from '../campusApi';

interface VerificationModalProps {
  visible: boolean;
  onClose: () => void;
  profile: CampusProfileData | null;
  campuses: CampusItem[];
  onVerifiedSuccess: (updatedProfile: CampusProfileData) => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
  visible,
  onClose,
  profile,
  campuses,
  onVerifiedSuccess,
}) => {
  const [tab, setTab] = useState<'email' | 'id_card'>('id_card');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email_input' | 'email_input_disabled' | 'otp_input' | 'success'>('email_input');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [idCardUri, setIdCardUri] = useState<string | null>(null);

  // Each time the sheet opens, start clean (no stale error from a previous attempt).
  useEffect(() => {
    if (visible) setErrorMsg(null);
  }, [visible]);

  // Already verified / under review: show the status instead of the upload form, so a
  // re-submission can't knock a verified student back to "pending".
  const status = profile?.verificationStatus;
  const lockedStatus = status === 'verified' || status === 'pending' ? status : null;

  const currentCampus = campuses.find((c) => c.id === profile?.campusId) || campuses[0];
  const primaryDomain = currentCampus?.emailDomains?.[0] || 'srmap.edu.in';

  // Verification endpoints are protected; without a session token they 401.
  const ensureSignedIn = async (): Promise<boolean> => {
    const token = await getToken();
    if (!token) {
      setErrorMsg('You are not signed in. Log in to your Zenvy account first, then verify your college email.');
      return false;
    }
    return true;
  };

  const handleSendOtp = async () => {
    setErrorMsg(null);
    if (!email.trim()) {
      setErrorMsg('Please enter your college email');
      return;
    }
    if (!(await ensureSignedIn())) return;

    let fullEmail = email.trim().toLowerCase();
    if (!fullEmail.includes('@')) {
      fullEmail = `${fullEmail}@${primaryDomain}`;
    }

    try {
      setLoading(true);
      const res = await requestCollegeEmailOtp(fullEmail, currentCampus?.id);
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('otp_input');
    } catch (err: any) {
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg(err.message || 'Failed to send verification email');
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMsg(null);
    if (!otp.trim()) {
      setErrorMsg('Please enter the 6-digit OTP');
      return;
    }
    if (!(await ensureSignedIn())) return;

    let fullEmail = email.trim().toLowerCase();
    if (!fullEmail.includes('@')) {
      fullEmail = `${fullEmail}@${primaryDomain}`;
    }

    try {
      setLoading(true);
      const res = await confirmCollegeEmailOtp(fullEmail, otp.trim());
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
      if (res.profile) {
        onVerifiedSuccess(res.profile);
      }
    } catch (err: any) {
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg(err.message || 'Invalid or expired OTP');
    }
  };

  const handlePickIdCard = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIdCardUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Permission needed', 'Please allow gallery access to upload student ID.');
    }
  };

  const handleSubmitIdCard = async () => {
    if (loading) return;
    if (!idCardUri) {
      setErrorMsg('Please select your ID card image first');
      return;
    }
    if (!(await ensureSignedIn())) return;

    try {
      setLoading(true);
      await uploadIdCardForVerification(idCardUri, currentCampus?.id, profile?.collegeId);
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIdCardUri(null);
      // Close first (the shell reloads the profile -> "Pending"), even if the alert is dismissed with Back.
      onClose();
      Alert.alert('ID Submitted ✅', "Your student ID is under review. We'll unlock your campus features as soon as it's approved.");
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Failed to submit ID card');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerTitleWrap}>
              <ShieldCheck size={20} color={CampusColors.accent} strokeWidth={2.2} />
              <Text style={styles.sheetTitle}>Student Verification</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
            >
              <X size={20} color={CampusColors.muted} />
            </TouchableOpacity>
          </View>

          {lockedStatus ? (
            <View style={styles.successContainer}>
              {lockedStatus === 'verified' ? (
                <CheckCircle2 size={56} color="#1E3FB0" strokeWidth={2} />
              ) : (
                <ShieldCheck size={56} color={CampusColors.warm} strokeWidth={2} />
              )}
              <Text style={styles.successTitle}>
                {lockedStatus === 'verified' ? "You're verified" : 'ID under review'}
              </Text>
              <Text style={styles.successSubtitle}>
                {lockedStatus === 'verified'
                  ? `Your student identity is confirmed${currentCampus?.name ? ` for ${currentCampus.name}` : ''}. Classwork and Whispers are unlocked.`
                  : "We've got your student ID photo. Our team usually reviews it within a few hours, and we'll unlock Classwork and Whispers as soon as it's approved."}
              </Text>
              <TouchableOpacity style={[styles.primaryCta, { alignSelf: 'stretch' }]} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.primaryCtaText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <>
          {status === 'rejected' && (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color="#A3321A" />
              <Text style={styles.errorText}>
                We couldn't approve your last ID photo. Please upload a clear photo of the front of your student ID.
              </Text>
            </View>
          )}

          {/* Reward Callout */}
          <View style={styles.rewardCard}>
            <Sparkles size={18} color="#B4561A" strokeWidth={2} />
            <Text style={styles.rewardText}>
              Earn <Text style={styles.bold}>150 Buddy Points</Text> & unlock Classwork & Whispers.
            </Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabItem, tab === 'email' && styles.activeTabItem]}
              onPress={() => setTab('email')}
            >
              <Mail size={16} color={tab === 'email' ? CampusColors.accent : CampusColors.muted} />
              <Text style={[styles.tabText, tab === 'email' && styles.activeTabText]}>
                College Email (Soon)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, tab === 'id_card' && styles.activeTabItem]}
              onPress={() => setTab('id_card')}
            >
              <Camera size={16} color={tab === 'id_card' ? CampusColors.accent : CampusColors.muted} />
              <Text style={[styles.tabText, tab === 'id_card' && styles.activeTabText]}>
                ID Card Photo
              </Text>
            </TouchableOpacity>
          </View>

          {errorMsg && (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color="#A3321A" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {tab === 'email' ? (
              step === 'email_input' ? (
                <View style={styles.stepContainer}>
                  <Text style={styles.instruction}>
                    College email verification is not available yet. Please verify with a photo of your student ID card instead.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryCta}
                    onPress={() => {
                      setErrorMsg(null);
                      setTab('id_card');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryCtaText}>Verify with ID Card</Text>
                  </TouchableOpacity>
                </View>
              ) : step === 'email_input_disabled' ? (
                <View style={styles.stepContainer}>
                  <Text style={styles.instruction}>
                    Enter your official university email address:
                  </Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      placeholder={`e.g. rollnumber@${primaryDomain}`}
                      placeholderTextColor={CampusColors.muted}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryCta, loading && styles.disabledCta]}
                    onPress={handleSendOtp}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryCtaText}>Send Verification Code</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : step === 'otp_input' ? (
                <View style={styles.stepContainer}>
                  <Text style={styles.instruction}>
                    Enter the 6-digit code sent to:
                  </Text>
                  <Text style={styles.targetEmail}>
                    {email.includes('@') ? email : `${email}@${primaryDomain}`}
                  </Text>


                  <View style={styles.inputWrap}>
                    <TextInput
                      style={[styles.input, styles.otpInput]}
                      placeholder="• • • • • •"
                      placeholderTextColor={CampusColors.muted}
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryCta, loading && styles.disabledCta]}
                    onPress={handleVerifyOtp}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryCtaText}>Verify & Unlock</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendBtn}
                    onPress={() => setStep('email_input')}
                  >
                    <Text style={styles.resendText}>Change Email / Resend</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.successContainer}>
                  <CheckCircle2 size={56} color="#1E3FB0" strokeWidth={2} />
                  <Text style={styles.successTitle}>You are Verified!</Text>
                  <Text style={styles.successSubtitle}>
                    Welcome to {currentCampus?.name || 'Campus Buddy'}. +150 Buddy Points have been added to your balance.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryCta}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onClose();
                    }}
                  >
                    <Text style={styles.primaryCtaText}>Start Exploring</Text>
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <View style={styles.stepContainer}>
                <Text style={styles.instruction}>
                  Upload a clear photo of your student ID card (front side showing name, photo, and roll number):
                </Text>

                <TouchableOpacity
                  style={styles.uploadCard}
                  onPress={handlePickIdCard}
                  activeOpacity={0.8}
                >
                  <Camera size={32} color={CampusColors.accent} strokeWidth={1.8} />
                  <Text style={styles.uploadCardTitle}>
                    {idCardUri ? 'Change ID Card Photo' : 'Select ID Card Photo'}
                  </Text>
                  <Text style={styles.uploadCardSubtitle}>
                    {idCardUri ? 'Image selected ✓' : 'JPG or PNG format'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryCta, (!idCardUri || loading) && styles.disabledCta]}
                  onPress={handleSubmitIdCard}
                  disabled={!idCardUri || loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryCtaText}>Submit for Verification</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
          </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: CampusColors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: CampusColors.ink,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CampusColors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CampusColors.warmSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  rewardText: {
    fontSize: 13,
    color: CampusColors.warmDeep,
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: CampusColors.paper,
    borderRadius: CampusLayout.radius.pill,
    padding: 3,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: CampusLayout.radius.pill,
    gap: 6,
  },
  activeTabItem: {
    backgroundColor: CampusColors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: CampusColors.muted,
  },
  activeTabText: {
    fontWeight: '700',
    color: CampusColors.ink,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECEB',
    padding: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A3321A',
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  stepContainer: {
    paddingVertical: 8,
  },
  instruction: {
    fontSize: 14,
    color: CampusColors.ink,
    marginBottom: 12,
  },
  targetEmail: {
    fontSize: 15,
    fontWeight: '700',
    color: CampusColors.accent,
    marginBottom: 12,
  },
  previewBox: {
    backgroundColor: CampusColors.accentSoft,
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  previewText: {
    fontSize: 12,
    fontWeight: '700',
    color: CampusColors.accentDeep,
  },
  inputWrap: {
    backgroundColor: CampusColors.paper,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CampusColors.line,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  input: {
    height: 48,
    fontSize: 15,
    color: CampusColors.ink,
  },
  otpInput: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },
  primaryCta: {
    height: CampusLayout.primaryCtaHeight,
    borderRadius: CampusLayout.radius.pill,
    backgroundColor: CampusColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledCta: {
    opacity: 0.6,
  },
  primaryCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resendBtn: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 6,
  },
  resendText: {
    fontSize: 13,
    color: CampusColors.muted,
    textDecorationLine: 'underline',
  },
  uploadCard: {
    backgroundColor: CampusColors.paper,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: CampusColors.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    marginBottom: 20,
  },
  uploadCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: CampusColors.ink,
    marginTop: 8,
  },
  uploadCardSubtitle: {
    fontSize: 12,
    color: CampusColors.muted,
    marginTop: 2,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: CampusColors.ink,
    marginTop: 16,
  },
  successSubtitle: {
    fontSize: 14,
    color: CampusColors.muted,
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 20,
  },
});
