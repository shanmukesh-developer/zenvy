import React, { useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { color, radius, space, type } from '../theme/tokens';
import { Badge, Card, Row } from '../components/ui/Basics';
import { PrimaryButton, SecondaryButton } from '../components/ui/Buttons';
import { Sheet } from '../components/ui/Sheet';
import { useRider } from '../state/RiderProvider';
import * as api from '../services/deliveryApi';
import * as links from '../services/links';
import { errorMessage, getApiHostLabel } from '../services/apiClient';

const VEHICLES = ['Bicycle', 'Scooter', 'Motorcycle', 'E-bike'];

export function ProfileScreen() {
  const r = useRider();
  const p = r.profile;
  const [refreshing, setRefreshing] = useState(false);
  const [edit, setEdit] = useState(false);
  const [pwd, setPwd] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    r.refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!p) return null;
  const ratingText = p.averageRating !== null ? `Rating ${p.averageRating.toFixed(1)}${p.totalRatings ? ` (${p.totalRatings})` : ''}` : 'No ratings yet';
  const version = Constants.expoConfig?.version ?? null;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await r.refreshProfile();
            setRefreshing(false);
          }}
        />
      }
    >
      <Card style={styles.header}>
        {p.photoUrl ? (
          <Image source={{ uri: p.photoUrl }} style={styles.avatar} accessibilityLabel="Profile photo" />
        ) : (
          <View style={[styles.avatar, { backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={[type.title1, { color: color.textInverse }]}>{(p.name || '?').charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.title2, { color: color.text }]}>{p.name || '—'}</Text>
          <Text style={[type.body, { color: color.textSecondary }]}>+91 {p.phone}</Text>
          <Text style={[type.bodySm, { color: color.textMuted }]}>
            {ratingText}
            {p.completedCount !== null ? ` · ${p.completedCount} deliveries` : ''}
          </Text>
        </View>
      </Card>

      <Card style={{ paddingVertical: space.xs }}>
        <Text style={[type.label, styles.cardLabel]}>VEHICLE</Text>
        <Row icon="moped-outline" label={p.vehicleType ?? 'Add vehicle type'} warn={!p.vehicleType} value={p.vehicleType ? 'Vehicle type' : null} onPress={() => setEdit(true)} />
        <Row
          icon="card-text-outline"
          label={p.vehicleNumber ?? 'Add vehicle number'}
          warn={!p.vehicleNumber}
          value={p.vehicleNumber ? 'Vehicle number' : 'Needed for customer safety'}
          onPress={() => setEdit(true)}
        />
      </Card>

      <Card style={{ gap: space.xs }}>
        <Text style={[type.label, { color: color.textMuted }]}>DOCUMENTS AND VERIFICATION</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          {p.isApproved ? <Badge tone="online" icon="check-decagram" label="Verified" /> : <Badge tone="warning" icon="clock-outline" label="Pending verification" />}
        </View>
        <Text style={[type.bodySm, { color: color.textSecondary }]}>Documents are checked by your fleet admin.</Text>
      </Card>

      <Card style={{ paddingVertical: space.xs }}>
        <Text style={[type.label, styles.cardLabel]}>SAFETY</Text>
        <Row icon="account-heart-outline" label="Emergency contact" value={p.emergencyContact ? `+91 ${p.emergencyContact}` : 'Not added yet'} warn={!p.emergencyContact} onPress={() => setEdit(true)} />
        <View style={{ paddingVertical: space.xs }}>
          <PrimaryButton title="Emergency 112" icon="phone-alert" variant="danger" size="lg" onPress={() => links.callNumber('112')} />
        </View>
      </Card>

      <Card style={{ paddingVertical: space.xs }}>
        <Row icon="lifebuoy" label="Support" value="Raise a ticket, see replies" onPress={() => r.setOverlay({ kind: 'support' })} />
        <Row icon="lock-reset" label="Change password" onPress={() => setPwd(true)} />
        <Row icon="information-outline" label="App info" value={[version ? `Version ${version}` : null, `Server ${getApiHostLabel()}`].filter(Boolean).join(' · ')} />
      </Card>

      <SecondaryButton title="Log out" icon="logout" tone="danger" onPress={() => setConfirmLogout(true)} />

      <EditProfileSheet visible={edit} onClose={() => setEdit(false)} />
      <ChangePasswordSheet visible={pwd} onClose={() => setPwd(false)} />
      <Sheet visible={confirmLogout} onClose={() => setConfirmLogout(false)} title="Log out?">
        <Text style={[type.body, { color: color.textSecondary }]}>
          {r.active.data.length
            ? `You still have ${r.active.data.length} active order${r.active.data.length === 1 ? '' : 's'}. Finish ${r.active.data.length === 1 ? 'it' : 'them'} first if you can.`
            : "You'll go offline and stop getting orders."}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <SecondaryButton title="Cancel" onPress={() => setConfirmLogout(false)} style={{ flex: 1 }} />
          <PrimaryButton
            title="Log out"
            variant="danger"
            size="lg"
            onPress={() => {
              setConfirmLogout(false);
              r.logout();
            }}
            style={{ flex: 1 }}
          />
        </View>
      </Sheet>
    </ScrollView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.label, { color: color.textSecondary }]}>{label}</Text>
      <TextInput placeholderTextColor={color.textMuted} {...props} style={[type.body, styles.input]} accessibilityLabel={label} />
    </View>
  );
}

export function EditProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const r = useRider();
  const p = r.profile;
  const [name, setName] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [emergency, setEmergency] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && p) {
      setName(p.name || '');
      setVehicleType(p.vehicleType || '');
      setVehicleNumber(p.vehicleNumber || '');
      setEmergency(p.emergencyContact || '');
      setError(null);
    }
  }, [visible, p]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await r.saveProfileEdits({
        name: name.trim(),
        vehicleType: vehicleType.trim(),
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        emergencyContact: emergency.replace(/\D/g, '').slice(-10),
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Edit profile"
      footer={<PrimaryButton title="Save" onPress={save} loading={busy} disabled={name.trim().length < 2} size="lg" />}
    >
      <Field label="NAME" value={name} onChangeText={setName} autoCapitalize="words" />
      <View style={{ gap: 6 }}>
        <Text style={[type.label, { color: color.textSecondary }]}>VEHICLE TYPE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {VEHICLES.map((v) => (
            <SecondaryButton
              key={v}
              title={v}
              compact
              tone={vehicleType === v ? 'online' : 'default'}
              icon={vehicleType === v ? 'check' : undefined}
              onPress={() => setVehicleType(v)}
            />
          ))}
        </View>
      </View>
      <Field label="VEHICLE NUMBER" value={vehicleNumber} onChangeText={setVehicleNumber} autoCapitalize="characters" placeholder="e.g. AP 39 AB 1234" />
      <Field label="EMERGENCY CONTACT (10 DIGITS)" value={emergency} onChangeText={setEmergency} keyboardType="phone-pad" maxLength={14} />
      {error ? <Text style={[type.body, { color: color.danger }]}>{error}</Text> : null}
    </Sheet>
  );
}

export function ChangePasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { showToast } = useRider();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setCurrent('');
      setNext('');
      setError(null);
    }
  }, [visible]);
  const ok = current.length > 0 && next.length >= 6;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Change password"
      footer={
        <PrimaryButton
          title="Update password"
          size="lg"
          loading={busy}
          disabled={!ok}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await api.changePassword(current, next);
              showToast('Password updated.', 'success');
              onClose();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <Field label="CURRENT PASSWORD" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" />
      <Field label="NEW PASSWORD (6+ CHARACTERS)" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" />
      {error ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <MaterialCommunityIcons name="alert-circle" size={18} color={color.danger} />
          <Text style={[type.body, { color: color.danger, flex: 1 }]}>{error}</Text>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md, paddingBottom: space.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  cardLabel: { color: color.textMuted, paddingTop: space.xs },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.border,
    paddingHorizontal: space.md,
    color: color.text,
    backgroundColor: color.surface,
  },
});
