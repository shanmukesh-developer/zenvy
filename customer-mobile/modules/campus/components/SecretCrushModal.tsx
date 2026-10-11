import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Heart,
  Sparkles,
  Lock,
  ShieldCheck,
  CheckCircle2,
  Users,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CampusColors, CampusLayout } from '../../../constants/campusTheme';

interface SecretCrushModalProps {
  visible: boolean;
  onClose: () => void;
  userBranch?: string;
}

const VIBE_CATEGORIES = [
  { id: 'crush', label: 'Secret Crush 💘', desc: 'Reveal only if both pick each other' },
  { id: 'study', label: 'Study Soulmate 📚', desc: 'Find serious focus partners in your branch' },
  { id: 'foodie', label: 'Midnight Foodie 🍕', desc: 'Find someone to split 2 AM Zenvy orders with' },
];

export const SecretCrushModal: React.FC<SecretCrushModalProps> = ({
  visible,
  onClose,
  userBranch = 'CSE',
}) => {
  const [selectedVibe, setSelectedVibe] = useState('crush');
  const [targetStudentId, setTargetStudentId] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!targetStudentId.trim()) {
      Alert.alert('Required', 'Please enter your match’s student roll number or college email.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitted(true);
    Alert.alert(
      '🔒 Crush Locked In!',
      `We encrypted your pick. If they also pick you, you will both get a mutual match alert & secret chat room!`,
      [{ text: 'Great', onPress: onClose }]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={22} color={CampusColors.ink} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>18+ Connection Suite</Text>
            <Text style={styles.headerSubtitle}>Secret Crush & Vibe Match</Text>
          </View>
          <View style={styles.heartIconWrap}>
            <Heart size={18} color={CampusColors.roseDeep} fill={CampusColors.roseDeep} />
          </View>
        </View>

        {/* Security Banner */}
        <View style={styles.securityBanner}>
          <ShieldCheck size={14} color={CampusColors.roseDeep} />
          <Text style={styles.securityText}>
            100% Cryptographic Anonymity. No one will ever know who you picked unless there is a mutual match.
          </Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.sectionHeader}>Select Connection Vibe</Text>

          <View style={styles.vibeList}>
            {VIBE_CATEGORIES.map((v) => {
              const active = selectedVibe === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.vibeCard, active && styles.vibeCardActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedVibe(v.id);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.vibeCardLeft}>
                    <Text style={styles.vibeTitle}>{v.label}</Text>
                    <Text style={styles.vibeDesc}>{v.desc}</Text>
                  </View>
                  {active && <CheckCircle2 size={18} color={CampusColors.rose} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Target Student Input */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionHeader}>Enter Student College Roll No / Email</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. AP21110010042 or name@srmap.edu.in"
              placeholderTextColor={CampusColors.muted}
              value={targetStudentId}
              onChangeText={setTargetStudentId}
              autoCapitalize="characters"
            />
            <Text style={styles.inputHint}>
              Works across all branches (CSE, ECE, MECH, CIVIL, MBA).
            </Text>
          </View>

          {/* Submit Action */}
          <TouchableOpacity
            style={[styles.submitBtn, submitted && styles.submitBtnDone]}
            onPress={handleSubmit}
            disabled={submitted}
          >
            <Lock size={16} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>
              {submitted ? 'Secret Match Stored' : 'Lock in Secret Crush'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CampusColors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: CampusColors.card,
    borderBottomWidth: 1,
    borderBottomColor: CampusColors.line,
  },
  closeBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: CampusColors.ink,
  },
  headerSubtitle: {
    fontSize: 11,
    color: CampusColors.rose,
    fontWeight: '600',
  },
  heartIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CampusColors.roseSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CampusColors.roseSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  securityText: {
    fontSize: 11,
    color: CampusColors.roseDeep,
    flex: 1,
    lineHeight: 15,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 36,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: CampusColors.ink,
  },
  vibeList: {
    gap: 10,
  },
  vibeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CampusColors.card,
    borderRadius: CampusLayout.radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: CampusColors.line,
  },
  vibeCardActive: {
    borderColor: CampusColors.rose,
    backgroundColor: '#FFF5F7',
  },
  vibeCardLeft: {
    flex: 1,
    marginRight: 10,
  },
  vibeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: CampusColors.ink,
    marginBottom: 2,
  },
  vibeDesc: {
    fontSize: 12,
    color: CampusColors.muted,
  },
  inputSection: {
    gap: 8,
  },
  input: {
    backgroundColor: CampusColors.card,
    borderWidth: 1,
    borderColor: CampusColors.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: CampusColors.ink,
  },
  inputHint: {
    fontSize: 11,
    color: CampusColors.muted,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CampusColors.rose,
    height: 48,
    borderRadius: CampusLayout.radius.pill,
    gap: 8,
    marginTop: 10,
  },
  submitBtnDone: {
    backgroundColor: '#059669',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
