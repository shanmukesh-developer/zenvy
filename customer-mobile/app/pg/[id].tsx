import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, Platform, ActivityIndicator, Alert, Linking, TextInput, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SHADOWS, RADIUS } from '../../constants/theme';
import { ENDPOINTS, API_URL, ZENVY_SUPPORT_WHATSAPP } from '../../constants/api';
import { apiFetch } from '../../utils/auth';
import { useTheme } from '../../context/ThemeContext';
import { StaggeredSection, FloatingPulse, BounceIn } from '../../components/AnimatedSection';
import SafeImage from '../../components/SafeImage';

const { width: SW } = Dimensions.get('window');

interface Room {
  id: string;
  roomNumber: string;
  sharingType: number;
  pricePerBed: number;
  totalBeds: number;
  availableBeds: number;
  floorNumber: number;
  hasAttachedBathroom: boolean;
  hasAC: boolean;
  hasBalcony: boolean;
  furnishing: string;
  images: string[];
}

interface PG {
  id: string;
  name: string;
  address: string;
  genderType: string;
  distanceFromCollege: number;
  baseRent: number;
  securityDeposit: number;
  description: string;
  amenities: string[];
  images: string[];
  videos?: string[];
  messMenu: Record<string, { breakfast: string; lunch: string; dinner: string }>;
  foodTimetable: { breakfast: string; lunch: string; dinner: string };
  rules: string[];
  totalRooms?: number;
  contactInfo: {
    phone: string;
    email: string;
    ownerName: string;
    wardenName: string;
    emergencyContact: string;
    lat?: number;
    lng?: number;
  };
  rooms?: Room[];
}

export default function PGDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isDark } = useTheme();
  
  const [pg, setPg] = useState<PG | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [bookingRoomId, setBookingRoomId] = useState('');
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split('T')[0]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Photo & Video Upload States
  const [mediaList, setMediaList] = useState<{ url: string; type: 'image' | 'video'; title?: string }[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [mediaTitleInput, setMediaTitleInput] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedVideoToPlay, setSelectedVideoToPlay] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchDetails();
  }, [id]);

  const fetchDetails = async () => {
    try {
      const res = await apiFetch(ENDPOINTS.pgDetail(id));
      if (res.ok) {
        const data = await res.json();
        setPg(data);
      } else {
        Alert.alert('Error', 'Failed to load residence details.');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Network error while loading residence details.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleBookRoom = async (roomId: string) => {
    try {
      setBookingRoomId(roomId);
      const res = await apiFetch(ENDPOINTS.pgBook(roomId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkInDate })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("⚡ Booking request sent & WhatsApp message dispatched!");
        fetchDetails(); // Refresh to update availability if any changes

        const waLink = data.whatsappUrl || `https://wa.me/${ZENVY_SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hi, I just submitted a booking request for ${pg?.name || 'PG'} on Zenvy.`)}`;
        
        Alert.alert(
          '🏠 PG Booking Request Sent!',
          `Your booking request for ${pg?.name || 'PG Residence'} has been registered.\n\nDirect notification dispatched to Campus Housing Desk via WhatsApp with your profile, contact, and check-in date.`,
          [
            {
              text: '💬 OPEN WHATSAPP CHAT',
              onPress: () => Linking.openURL(waLink)
            },
            { text: 'DONE', style: 'cancel' }
          ]
        );
      } else {
        showToast(data.message || "Booking failed. Please try again.");
      }
    } catch (err) {
      showToast("Error processing your booking request.");
    } finally {
      setBookingRoomId('');
    }
  };

  const getAmenityEmoji = (amenity: string) => {
    const lower = amenity.toLowerCase();
    if (lower.includes('wifi')) return '📶';
    if (lower.includes('ac')) return '❄️';
    if (lower.includes('washing') || lower.includes('laundry')) return '🧺';
    if (lower.includes('housekeeping') || lower.includes('clean')) return '🧹';
    if (lower.includes('power') || lower.includes('backup')) return '🔋';
    if (lower.includes('gym')) return '🏋️';
    if (lower.includes('lounge')) return '🛋️';
    if (lower.includes('security') || lower.includes('cctv')) return '📹';
    if (lower.includes('biometric')) return '🔐';
    if (lower.includes('nurse') || lower.includes('medical')) return '🩺';
    if (lower.includes('kitchen')) return '🍳';
    if (lower.includes('tv')) return '📺';
    if (lower.includes('co-working') || lower.includes('study')) return '📚';
    if (lower.includes('bed')) return '🛏️';
    if (lower.includes('bathroom') || lower.includes('washroom')) return '🚿';
    return '✨';
  };

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: isDark ? COLORS.bgDark : COLORS.bgLight }]}>
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={[s.loadingText, { color: isDark ? COLORS.textSecondary : COLORS.textDarkSecondary }]}>
          LOADING PREMIUM RESIDENCE...
        </Text>
      </View>
    );
  }

  if (!pg) {
    return (
      <View style={[s.center, { backgroundColor: isDark ? COLORS.bgDark : COLORS.bgLight }]}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠️</Text>
        <Text style={{ color: isDark ? '#fff' : '#000', fontWeight: '900', letterSpacing: 2 }}>PROPERTY NOT FOUND</Text>
        <TouchableOpacity style={s.backNavBtn} onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)/others' as any);
          }
        }}>
          <Text style={s.backNavBtnText}>BACK TO ECOSYSTEM</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images = pg.images && pg.images.length > 0 ? pg.images : ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=600'];
  const activeImg = images[activeImageIdx];
  const bg = isDark ? COLORS.bgDark : COLORS.bgLight;
  const cardBg = isDark ? COLORS.bgCard : COLORS.bgLightCard;
  const txt = isDark ? COLORS.textPrimary : COLORS.textDark;
  const txtSec = isDark ? COLORS.textSecondary : COLORS.textDarkSecondary;
  const border = isDark ? COLORS.borderDark : COLORS.borderLight;

  let genderColor: string = COLORS.red;
  if (pg.genderType === 'Boys') genderColor = '#3B82F6';
  if (pg.genderType === 'Girls') genderColor = '#EC4899';
  if (pg.genderType === 'Co-ed') genderColor = '#8B5CF6';

  const defaultTimetable = { breakfast: '08:00 AM - 10:00 AM', lunch: '01:00 PM - 02:30 PM', dinner: '08:00 PM - 10:00 PM' };
  const timetable = pg.foodTimetable && Object.keys(pg.foodTimetable).length > 0 ? pg.foodTimetable : defaultTimetable;

  const defaultMenu = {
    Monday: { breakfast: 'Idly & Chutney', lunch: 'Rice, Dal, Veg Fry', dinner: 'Roti, Paneer, Rice' },
    Tuesday: { breakfast: 'Dosa & Sambar', lunch: 'Rice, Sambar, Curd', dinner: 'Veg Biryani, Raita' },
    Wednesday: { breakfast: 'Puri Sagu', lunch: 'Jeera Rice, Tadka', dinner: 'Roti, Alu Curry, Rice' },
    Thursday: { breakfast: 'Pongal & Gothsu', lunch: 'Rice, Rasam, Veg', dinner: 'Roti, Bhindi, Rice' },
    Friday: { breakfast: 'Poha & Sev', lunch: 'Rice, Veg Kofta, Dal', dinner: 'Rice, Sambar, Egg/Paneer' },
    Saturday: { breakfast: 'Upma & Chutney', lunch: 'Lemon Rice, Curd', dinner: 'Roti, Mix Veg, Rice' },
    Sunday: { breakfast: 'Aloo Paratha', lunch: 'Special Meals, Kheer', dinner: 'Roti, Egg Curry/Paneer' }
  };
  const messMenu = pg.messMenu && Object.keys(pg.messMenu).length > 0 ? pg.messMenu : defaultMenu;

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      {/* Toast message overlay */}
      {toastMessage && (
        <View style={s.toastContainer}>
          <Text style={s.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Header bar */}
      <View style={[s.headerBar, { borderBottomColor: border }]}>
        <TouchableOpacity style={s.backArrow} onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)/others' as any);
          }
        }}>
          <Text style={[s.backArrowText, { color: txt }]}>◀ BACK</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: txt }]} numberOfLines={1}>{pg.name.toUpperCase()}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Swipable / Scrollable HD Images & Video Gallery */}
        <View style={s.galleryContainer}>
          <SafeImage source={{ uri: activeImg }} style={s.mainImage} />
          <View style={s.galleryOverlay} />
          
          {/* Badges row */}
          <View style={{ position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={[s.genderTag, { backgroundColor: genderColor }]}>
              <Text style={s.genderTagText}>{pg.genderType.toUpperCase()}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              {/* Watch Video Tour Badge */}
              <TouchableOpacity 
                style={{
                  backgroundColor: '#DC2626',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 12,
                  shadowColor: '#DC2626',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.4,
                  shadowRadius: 4,
                  elevation: 3
                }}
                onPress={() => setSelectedVideoToPlay('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4')}
              >
                <Text style={{ fontSize: 11 }}>▶️</Text>
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.5 }}>VIDEO TOUR</Text>
              </TouchableOpacity>

              <View style={s.verifiedTag}>
                <Text style={s.verifiedTagText}>★ VERIFIED</Text>
              </View>
            </View>
          </View>



          {/* Thumbnails */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.thumbScroll}>
            {images.map((img, idx) => (
              <TouchableOpacity key={idx} onPress={() => setActiveImageIdx(idx)} style={[s.thumbWrap, activeImageIdx === idx && { borderColor: '#3B82F6', borderWidth: 2.5 }]}>
                <Image source={{ uri: img }} style={s.thumbImg} />
              </TouchableOpacity>
            ))}
            {mediaList.map((m, idx) => (
              <TouchableOpacity key={`user-${idx}`} onPress={() => setActiveImageIdx(0)} style={[s.thumbWrap, { borderColor: '#10B981', borderWidth: 2 }]}>
                <Image source={{ uri: m.url }} style={s.thumbImg} />
                {m.type === 'video' && (
                  <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12 }}>▶️</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Title details */}
        <StaggeredSection delay={50} direction="up">
        <View style={[s.sectionCard, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={[s.pgName, { color: txt }]}>{pg.name}</Text>
          <Text style={[s.pgAddress, { color: txtSec }]}>📍 {pg.address}</Text>
          <View style={s.proximityBadge}>
            <Text style={{ fontSize: 20 }}>🏃</Text>
            <View>
              <Text style={s.proximityLabel}>CAMPUS PROXIMITY</Text>
              <Text style={[s.proximityValue, { color: COLORS.red }]}>{pg.distanceFromCollege} km away</Text>
            </View>
          </View>

          <Text style={[s.pgDesc, { color: txt }]}>{pg.description}</Text>
        </View>
        </StaggeredSection>

        {/* Quick Stats Grid */}
        <StaggeredSection delay={100} direction="up">
        <View style={s.statsGrid}>
          <View style={[s.statBox, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={s.statEmoji}>💰</Text>
            <Text style={s.statLabel}>DEPOSIT</Text>
            <Text style={[s.statVal, { color: txt }]}>₹{pg.securityDeposit}</Text>
            <Text style={s.statDesc}>Refundable</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={s.statEmoji}>👥</Text>
            <Text style={s.statLabel}>GENDER</Text>
            <Text style={[s.statVal, { color: txt }]}>{pg.genderType}</Text>
            <Text style={s.statDesc}>Hostel Limit</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={s.statEmoji}>🍽️</Text>
            <Text style={s.statLabel}>MESS</Text>
            <Text style={[s.statVal, { color: txt }]}>7 Days Open</Text>
            <Text style={s.statDesc}>Veg & Non-Veg</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={s.statEmoji}>📶</Text>
            <Text style={s.statLabel}>HIGH SPEED</Text>
            <Text style={[s.statVal, { color: txt }]}>Wi-Fi & Gym</Text>
            <Text style={s.statDesc}>Included</Text>
          </View>
        </View>
        </StaggeredSection>

        {/* Room Inventory */}
        <StaggeredSection delay={150} direction="up">
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={[s.blockTitle, { color: txt }]}>ROOM INVENTORY</Text>
          <Text style={[s.blockSub, { color: txtSec }]}>REAL-TIME AVAILABLE BEDS</Text>

          <View style={[s.checkInWrap, { backgroundColor: cardBg }]}>
            <Text style={[s.checkInLabel, { color: txt }]}>CHECK-IN DATE:</Text>
            <TextInput style={[s.checkInInput, { color: txt, borderColor: border }]} value={checkInDate} onChangeText={setCheckInDate} placeholder="YYYY-MM-DD" placeholderTextColor={txtSec} />
          </View>

          {pg.rooms && pg.rooms.length > 0 ? (
            pg.rooms.map(room => (
              <View key={room.id} style={[s.roomCard, { backgroundColor: cardBg, borderColor: border }]}>
                <View style={s.roomCardLeft}>
                  <Text style={[s.roomTitle, { color: txt }]}>{room.sharingType} Seater Setup</Text>
                  <Text style={[s.roomNo, { color: txtSec }]}>Room No: {room.roomNumber} • Floor {room.floorNumber}</Text>
                  
                  <View style={s.roomBadgeRow}>
                    <View style={s.roomBadge}><Text style={s.roomBadgeText}>{room.hasAC ? '❄️ AC' : '🌬️ Non-AC'}</Text></View>
                    <View style={s.roomBadge}><Text style={s.roomBadgeText}>{room.hasAttachedBathroom ? '🚿 Attached Bath' : '🚪 Shared Bath'}</Text></View>
                  </View>
                  
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ fontSize: 8, color: txtSec, fontWeight: '700' }}>PRICING PER BED</Text>
                    <Text style={s.roomPrice}>₹{room.pricePerBed}<Text style={{ fontSize: 9, color: txtSec }}> / month</Text></Text>
                  </View>
                </View>

                <View style={s.roomCardRight}>
                  <View style={[s.bedsBadge, { backgroundColor: room.availableBeds > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                    <Text style={[s.bedsBadgeText, { color: room.availableBeds > 0 ? COLORS.emerald : '#EF4444' }]}>
                      {room.availableBeds} beds left
                    </Text>
                  </View>

                  {room.availableBeds > 0 ? (
                    <TouchableOpacity 
                      style={[s.bookBtn, { backgroundColor: COLORS.red }]} 
                      onPress={() => handleBookRoom(room.id)}
                      disabled={bookingRoomId === room.id}
                    >
                      {bookingRoomId === room.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={s.bookBtnText}>BOOK BED ⚡</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={s.bookedBtn}>
                      <Text style={s.bookedBtnText}>FULL</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={[s.emptyBox, { backgroundColor: cardBg }]}>
              <Text style={[s.emptyBoxText, { color: txtSec }]}>No rooms currently available.</Text>
            </View>
          )}
        </View>
        </StaggeredSection>

        {/* Premium Amenities */}
        <StaggeredSection delay={200} direction="up">
        <View style={[s.sectionCard, { backgroundColor: cardBg }]}>
          <Text style={[s.blockTitle, { color: txt, borderBottomWidth: 1, borderBottomColor: border, paddingBottom: 8, marginBottom: 12 }]}>PREMIUM AMENITIES</Text>
          <View style={s.amenitiesGrid}>
            {pg.amenities.map((amenity, idx) => (
              <View key={idx} style={[s.amenityCell, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                <Text style={{ fontSize: 24, marginBottom: 4 }}>{getAmenityEmoji(amenity)}</Text>
                <Text style={[s.amenityText, { color: txt }]} numberOfLines={1}>{amenity}</Text>
                <Text style={s.amenitySub}>INCLUDED</Text>
              </View>
            ))}
          </View>
        </View>
        </StaggeredSection>

        {/* Daily Schedule & Mess Menu */}
        <StaggeredSection delay={250} direction="up">
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={[s.blockTitle, { color: txt }]}>DAILY SCHEDULE</Text>
          <View style={[s.scheduleCard, { backgroundColor: cardBg }]}>
            <View style={s.scheduleRow}>
              <Text style={s.scheduleDot}>🍳</Text>
              <View>
                <Text style={s.scheduleTitle}>BREAKFAST TIMING</Text>
                <Text style={[s.scheduleTime, { color: txt }]}>{timetable.breakfast}</Text>
              </View>
            </View>
            <View style={s.scheduleRow}>
              <Text style={s.scheduleDot}>🍲</Text>
              <View>
                <Text style={s.scheduleTitle}>LUNCH TIMING</Text>
                <Text style={[s.scheduleTime, { color: txt }]}>{timetable.lunch}</Text>
              </View>
            </View>
            <View style={s.scheduleRow}>
              <Text style={s.scheduleDot}>🍛</Text>
              <View>
                <Text style={s.scheduleTitle}>DINNER TIMING</Text>
                <Text style={[s.scheduleTime, { color: txt }]}>{timetable.dinner}</Text>
              </View>
            </View>
          </View>
        </View>
        </StaggeredSection>

        {/* 7 Day Mess Menu */}
        <StaggeredSection delay={300} direction="up">
        <View style={[s.sectionCard, { backgroundColor: cardBg }]}>
          <Text style={[s.blockTitle, { color: txt, borderBottomWidth: 1, borderBottomColor: border, paddingBottom: 8, marginBottom: 12 }]}>7-DAY MESS MENU</Text>
          {Object.entries(messMenu).map(([day, meal]) => (
            <View key={day} style={[s.menuRow, { borderBottomColor: border }]}>
              <Text style={[s.menuDay, { color: txt }]}>{day.substring(0,3).toUpperCase()}</Text>
              <View style={s.menuDetails}>
                <Text style={[s.menuMeal, { color: txtSec }]}><Text style={{ color: COLORS.gold, fontWeight: '800' }}>BF: </Text>{meal.breakfast}</Text>
                <Text style={[s.menuMeal, { color: txtSec }]}><Text style={{ color: '#3B82F6', fontWeight: '800' }}>LN: </Text>{meal.lunch}</Text>
                <Text style={[s.menuMeal, { color: txtSec }]}><Text style={{ color: COLORS.emerald, fontWeight: '800' }}>DN: </Text>{meal.dinner}</Text>
              </View>
            </View>
          ))}
        </View>
        </StaggeredSection>

        {/* Property Guidelines */}
        <StaggeredSection delay={350} direction="up">
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={[s.blockTitle, { color: txt }]}>PROPERTY GUIDELINES</Text>
          <View style={[s.rulesCard, { backgroundColor: cardBg }]}>
            {pg.rules.map((rule, idx) => (
              <View key={idx} style={s.ruleRow}>
                <Text style={s.ruleNumber}>0{idx + 1}</Text>
                <Text style={[s.ruleText, { color: txt }]}>{rule}</Text>
              </View>
            ))}
          </View>
        </View>
        </StaggeredSection>

        {/* Map Coordinates & Directions */}
        {pg.contactInfo && (pg.contactInfo.lat || pg.contactInfo.lng) && (
          <StaggeredSection delay={400} direction="up">
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <Text style={[s.blockTitle, { color: txt }]}>MAP LOCATION</Text>
            <View style={[s.mapCard, { backgroundColor: cardBg }]}>
              <Text style={[s.mapCoordinates, { color: txt }]}>COORDINATES: {pg.contactInfo.lat?.toFixed(5) || '16.5062'}, {pg.contactInfo.lng?.toFixed(5) || '80.5048'}</Text>
              <TouchableOpacity 
                style={s.directionsBtn} 
                onPress={() => {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${pg.contactInfo.lat || 16.5062},${pg.contactInfo.lng || 80.5048}`;
                  Linking.openURL(url);
                }}
              >
                <Text style={s.directionsBtnText}>GET DIRECTIONS 🗺️</Text>
              </TouchableOpacity>
            </View>
          </View>
          </StaggeredSection>
        )}

        {/* Administration details */}
        <StaggeredSection delay={450} direction="up">
        <View style={[s.sectionCard, { backgroundColor: cardBg }]}>
          <Text style={[s.blockTitle, { color: txt, borderBottomWidth: 1, borderBottomColor: border, paddingBottom: 8, marginBottom: 12 }]}>ADMINISTRATION</Text>
          
          <View style={s.adminGrid}>
            <View style={s.adminItem}>
              <Text style={{ fontSize: 18 }}>👤</Text>
              <View>
                <Text style={s.adminLabel}>HOSTEL OWNER</Text>
                <Text style={[s.adminVal, { color: txt }]}>{pg.contactInfo?.ownerName || 'Property Admin'}</Text>
              </View>
            </View>

            <View style={s.adminItem}>
              <Text style={{ fontSize: 18 }}>🛡️</Text>
              <View>
                <Text style={s.adminLabel}>CAMPUS WARDEN</Text>
                <Text style={[s.adminVal, { color: txt }]}>{pg.contactInfo?.wardenName || 'Assigned Warden'}</Text>
              </View>
            </View>

            <View style={s.adminItem}>
              <Text style={{ fontSize: 18 }}>📞</Text>
              <View>
                <Text style={s.adminLabel}>CONTACT PHONE</Text>
                <Text style={[s.adminVal, { color: txt }]}>{pg.contactInfo?.phone || '+91 9988776655'}</Text>
              </View>
            </View>

            <View style={s.adminItem}>
              <Text style={{ fontSize: 18 }}>🚨</Text>
              <View>
                <Text style={s.adminLabel}>EMERGENCY HOTLINE</Text>
                <Text style={[s.adminVal, { color: COLORS.red }]}>{pg.contactInfo?.emergencyContact || '+91 911002233'}</Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity 
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: '#25D366',
              }}
              onPress={() => {
                const phone = (pg.contactInfo?.phone || ZENVY_SUPPORT_WHATSAPP).replace(/\D/g, '');
                const msg = `Hi, I am interested in visiting/booking a room at ${pg.name} (${pg.genderType} PG) on Zenvy. Could you please share the current availability and visiting timings?`;
                Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
              }}
            >
              <Text style={{ fontSize: 14 }}>💬</Text>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>WHATSAPP CHAT</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[s.callBtn, { flex: 1, marginTop: 0, borderColor: border }]}
              onPress={() => {
                if (pg.contactInfo?.phone) Linking.openURL(`tel:${pg.contactInfo.phone}`);
              }}
            >
              <Text style={[s.callBtnText, { color: txt }]}>DIAL WARDEN 📞</Text>
            </TouchableOpacity>
          </View>
        </View>
        </StaggeredSection>

        {/* Booking Terms */}
        <StaggeredSection delay={500} direction="up">
        <View style={{ paddingHorizontal: 16, marginBottom: 40 }}>
          <Text style={[s.blockTitle, { color: txt }]}>BOOKING TERMS</Text>
          <View style={[s.termsCard, { backgroundColor: cardBg, borderColor: COLORS.goldBorder }]}>
            <Text style={[s.termTitle, { color: COLORS.gold }]}>1. DEPOSIT & REFUNDING</Text>
            <Text style={[s.termText, { color: txtSec }]}>The security deposit of ₹{pg.securityDeposit} is fully refundable at the end of the tenancy agreement, subject to clearance of any outstanding bills.</Text>
            
            <Text style={[s.termTitle, { color: COLORS.gold, marginTop: 12 }]}>2. CANCELLATION GUARD</Text>
            <Text style={[s.termText, { color: txtSec }]}>Get a 100% refund of security deposit if cancelled within 48 hours of booking. Post 48 hours, a deduction of 10% will apply.</Text>

            <Text style={[s.termTitle, { color: COLORS.gold, marginTop: 12 }]}>3. RENT BILLING CYCLES</Text>
            <Text style={[s.termText, { color: txtSec }]}>Monthly rent must be paid in advance by the 5th of every calendar month. Late payments attract ₹100 daily fine.</Text>
          </View>
        </View>
        </StaggeredSection>

      </ScrollView>

      {/* ── VIDEO TOUR PLAYER MODAL ── */}
      <Modal
        visible={!!selectedVideoToPlay}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedVideoToPlay(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ width: '100%', maxWidth: 500, backgroundColor: '#18181B', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 16 }}>🎥</Text>
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFF' }}>360° Hostel & Room Tour</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedVideoToPlay(null)} style={{ padding: 6 }}>
                <Text style={{ fontSize: 16, color: '#A1A1AA', fontWeight: '900' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Video Player Stage */}
            <View style={{ width: '100%', height: 280, backgroundColor: '#000', overflow: 'hidden' }}>
              {Platform.OS === 'web' ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={
                    selectedVideoToPlay && selectedVideoToPlay.includes('youtube')
                      ? selectedVideoToPlay.replace('watch?v=', 'embed/')
                      : 'https://www.youtube.com/embed/5qap5aO4i9A?autoplay=1&mute=0'
                  }
                  title="Hostel Room Tour"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ width: '100%', height: '100%', border: 0 }}
                />
              ) : (
                <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090B' }}>
                  <Image source={{ uri: activeImg }} style={{ width: '100%', height: '100%', opacity: 0.5 }} resizeMode="cover" />
                  <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                    <TouchableOpacity
                      style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', shadowColor: '#DC2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 6 }}
                      onPress={() => {
                        if (selectedVideoToPlay) Linking.openURL(selectedVideoToPlay);
                      }}
                    >
                      <Text style={{ fontSize: 24, color: '#FFF', marginLeft: 4 }}>▶</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFF', marginTop: 12 }}>
                      Playing Verified Hostel Video Tour 🎥
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Footer */}
            <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#A1A1AA' }}>{pg.name}</Text>
              <TouchableOpacity
                style={{ backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}
                onPress={() => setSelectedVideoToPlay(null)}
              >
                <Text style={{ fontSize: 10, fontWeight: '900', color: '#FFF' }}>CLOSE TOUR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? 40 : 50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 9, fontWeight: '900', letterSpacing: 2, marginTop: 16 },
  backNavBtn: { marginTop: 24, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.red },
  backNavBtnText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  
  toastContainer: { position: 'absolute', bottom: 30, left: 16, right: 16, backgroundColor: '#11111A', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.goldBorder, zIndex: 999 },
  toastText: { color: COLORS.gold, fontSize: 10, fontWeight: '800', textAlign: 'center', letterSpacing: 1.5 },
  
  headerBar: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1 },
  backArrow: { width: 60 },
  backArrowText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  headerTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 2, textAlign: 'center', flex: 1 },

  galleryContainer: { position: 'relative', width: SW, height: 260, marginBottom: 12 },
  mainImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  galleryOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.3)' },
  verifiedTag: { position: 'absolute', top: 12, right: 12, backgroundColor: COLORS.greenRating, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  verifiedTagText: { fontSize: 8, fontWeight: '900', color: '#fff', letterSpacing: 1.5 },
  genderTag: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  genderTagText: { fontSize: 8, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  thumbScroll: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  thumbWrap: { width: 50, height: 50, borderRadius: 8, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden', marginRight: 8 },
  thumbImg: { width: '100%', height: '100%' },

  sectionCard: { marginHorizontal: 16, padding: 20, borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: COLORS.borderDark },
  pgName: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
  pgAddress: { fontSize: 10, fontWeight: '700', marginBottom: 12 },
  proximityBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(239,79,95,0.06)', padding: 12, borderRadius: 16, marginBottom: 16 },
  proximityLabel: { fontSize: 8, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5 },
  proximityValue: { fontSize: 15, fontWeight: '900' },
  pgDesc: { fontSize: 11, fontWeight: '500', lineHeight: 16 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  statBox: { width: (SW - 40) / 2, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.borderDark },
  statEmoji: { fontSize: 22, marginBottom: 6 },
  statLabel: { fontSize: 8, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1 },
  statVal: { fontSize: 14, fontWeight: '900', marginVertical: 2 },
  statDesc: { fontSize: 8, fontWeight: '600', color: COLORS.textMuted },

  blockTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  blockSub: { fontSize: 8, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12 },
  checkInWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.borderDark },
  checkInLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  checkInInput: { width: 120, height: 36, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 11, fontWeight: '700', textAlign: 'center' },

  roomCard: { flexDirection: 'row', padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 10, justifyContent: 'space-between' },
  roomCardLeft: { flex: 1, paddingRight: 10 },
  roomTitle: { fontSize: 14, fontWeight: '800' },
  roomNo: { fontSize: 9, fontWeight: '600', marginTop: 2, marginBottom: 8 },
  roomBadgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  roomBadge: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  roomBadgeText: { fontSize: 8, fontWeight: '800', color: COLORS.textMuted },
  roomPrice: { fontSize: 18, fontWeight: '900', color: COLORS.red },
  roomCardRight: { alignItems: 'flex-end', justifyContent: 'space-between', width: 100 },
  bedsBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  bedsBadgeText: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  bookBtn: { width: '100%', paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...SHADOWS.redGlow },
  bookBtnText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  bookedBtn: { width: '100%', paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  bookedBtnText: { color: COLORS.textMuted, fontSize: 8, fontWeight: '900' },
  emptyBox: { padding: 24, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyBoxText: { fontSize: 10, fontWeight: '600' },

  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityCell: { width: (SW - 40 - 16) / 3, paddingVertical: 14, alignItems: 'center', borderRadius: 16 },
  amenityText: { fontSize: 9, fontWeight: '800', width: '90%', textAlign: 'center' },
  amenitySub: { fontSize: 7, fontWeight: '600', color: COLORS.textMuted, marginTop: 2 },

  scheduleCard: { padding: 16, borderRadius: 20 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  scheduleDot: { fontSize: 20 },
  scheduleTitle: { fontSize: 8, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1 },
  scheduleTime: { fontSize: 13, fontWeight: '800', marginTop: 1 },

  menuRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1 },
  menuDay: { width: 50, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  menuDetails: { flex: 1, gap: 4 },
  menuMeal: { fontSize: 10, fontWeight: '600' },

  rulesCard: { padding: 16, borderRadius: 20 },
  ruleRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  ruleNumber: { fontSize: 11, fontWeight: '900', color: COLORS.textMuted },
  ruleText: { fontSize: 11, fontWeight: '600', flex: 1 },

  mapCard: { padding: 16, borderRadius: 20, alignItems: 'center' },
  mapCoordinates: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  directionsBtn: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  directionsBtnText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },

  adminGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  adminItem: { width: (SW - 40 - 12) / 2, flexDirection: 'row', gap: 8, alignItems: 'center' },
  adminLabel: { fontSize: 7, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1 },
  adminVal: { fontSize: 11, fontWeight: '800', marginTop: 1 },
  callBtn: { width: '100%', paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, alignItems: 'center' },
  callBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 2 },

  termsCard: { padding: 16, borderRadius: 20, borderWidth: 1, borderColor: COLORS.goldBorder },
  termTitle: { fontSize: 8, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
  termText: { fontSize: 9, fontWeight: '600', lineHeight: 14 },
});
