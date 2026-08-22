import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  Alert,
  FlatList,
  ActivityIndicator,
  TextInput,
  Modal
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SHADOWS, RADIUS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { API_URL, ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/auth';
import DopaminePressable, { ActionPressable } from '../../components/DopaminePressable';

const { width: SW } = Dimensions.get('window');

const MOCK_DATA: Record<string, any[]> = {
  electronics: [
    { id: 'elec-1', name: '65W GaN Fast Type-C Charger', price: 1499, originalPrice: 2499, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&q=80', desc: 'Universal fast charging for MacBook, Dell, iPhone & Android' },
    { id: 'elec-2', name: '20,000mAh Fast Power Bank', price: 1799, originalPrice: 2999, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1609091839311-d5368f9bc14a?w=600&q=80', desc: '22.5W dual output, power your devices all day during classes' },
    { id: 'elec-3', name: '4-Socket Surge Protected Board', price: 499, originalPrice: 899, discount: '44% OFF', image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80', desc: '2-meter heavy wire with individual switches & USB ports' },
    { id: 'elec-4', name: 'Scientific Calculator (fx-991EX)', price: 1250, originalPrice: 1595, discount: '21% OFF', image: 'https://images.unsplash.com/photo-1594980596870-8caa52a79d00?w=600&q=80', desc: 'Must-have for engineering mathematics and exams' },
    { id: 'elec-5', name: 'Ergonomic Laptop Cooling Stand', price: 699, originalPrice: 1299, discount: '46% OFF', image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&q=80', desc: 'Foldable aluminum stand for study tables & hostel beds' },
    { id: 'elec-6', name: 'ANC Wireless Earbuds', price: 1499, originalPrice: 2999, discount: '50% OFF', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80', desc: 'Active noise cancellation for late-night hostel study sessions' },
    { id: 'elec-7', name: 'Rechargeable LED Study Lamp', price: 549, originalPrice: 999, discount: '45% OFF', image: 'https://images.unsplash.com/photo-1534972195531-a756b1126f24?w=600&q=80', desc: 'Eye-care warm light with 3 brightness modes and touch sensor' },
    { id: 'elec-8', name: 'Braided Type-C to Type-C Cable', price: 299, originalPrice: 599, discount: '50% OFF', image: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&q=80', desc: '100W PD charging & 480Mbps fast data sync' },
    { id: 'elec-9', name: 'Type-C 7-in-1 Multiport Hub', price: 1299, originalPrice: 2199, discount: '41% OFF', image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80', desc: 'HDMI 4K, USB 3.0, SD Card reader for laptops without ports' },
    { id: 'elec-10', name: 'Mouse & Keyboard Combo (Silent)', price: 899, originalPrice: 1599, discount: '43% OFF', image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80', desc: 'Quiet keystrokes so you don\'t disturb your roommate' },
  ],
  mattresses: [
    { id: 'mat-1', name: 'Single Bed Foam Mattress (4-Inch)', price: 1899, originalPrice: 3200, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80', desc: 'High-density foam, ideal for standard hostel bed frames (72x36 in)' },
    { id: 'mat-2', name: 'Orthopedic Mattress Topper', price: 1199, originalPrice: 1999, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=600&q=80', desc: 'Adds ultra comfort to hard hostel mattresses. Back pain relief' },
    { id: 'mat-3', name: 'Pure Cotton Bedsheet + Pillow Cover', price: 449, originalPrice: 799, discount: '43% OFF', image: 'https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?w=600&q=80', desc: 'Breathable 100% cotton, non-fading fabric for hostel rooms' },
    { id: 'mat-4', name: 'Microfiber Plush Sleep Pillow', price: 299, originalPrice: 599, discount: '50% OFF', image: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=600&q=80', desc: 'Soft neck support with anti-dustmite casing' },
    { id: 'mat-5', name: '20L Heavy Duty Bucket & Mug Set', price: 249, originalPrice: 450, discount: '44% OFF', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&q=80', desc: 'Unbreakable plastic hostel bathroom essential' },
    { id: 'mat-6', name: 'Cloth Drying Rack (Foldable)', price: 799, originalPrice: 1499, discount: '46% OFF', image: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=600&q=80', desc: 'Rust-proof stainless steel for drying clothes inside hostel balcony' },
    { id: 'mat-7', name: 'Hangers Pack (12 Pieces)', price: 149, originalPrice: 299, discount: '50% OFF', image: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=600&q=80', desc: 'Heavy plastic non-slip coat & shirt hangers for hostel almirahs' },
    { id: 'mat-8', name: 'Foldable Mesh Laundry Basket', price: 199, originalPrice: 399, discount: '50% OFF', image: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=600&q=80', desc: 'Pop-up dirty clothes organizer bag' },
    { id: 'mat-9', name: 'Mosquito Net Canopy for Bed', price: 399, originalPrice: 799, discount: '50% OFF', image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80', desc: 'Easy setup pop-up net for peaceful sleep' },
  ],
  groceries: [
    { id: 'groc-1', name: 'Maggi 2-Minute Noodles (Pack of 12)', price: 168, originalPrice: 180, discount: '7% OFF', image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=600&q=80', desc: 'Hostel lifeline! Special masala noodles' },
    { id: 'groc-2', name: 'Buldak 2x Spicy Korean Ramen', price: 135, originalPrice: 150, discount: '10% OFF', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80', desc: 'Ultra spicy late night craving treat' },
    { id: 'groc-3', name: 'Amul Taaza Toned Milk (1 Litre)', price: 60, originalPrice: 65, discount: '8% OFF', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&q=80', desc: 'Homogenized UHT milk with long shelf life' },
    { id: 'groc-4', name: 'Nutella Hazelnut Spread (350g)', price: 340, originalPrice: 390, discount: '12% OFF', image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80', desc: 'Delicious cocoa spread for morning bread' },
    { id: 'groc-5', name: 'Red Bull Energy Drink (4-Pack)', price: 460, originalPrice: 500, discount: '8% OFF', image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=600&q=80', desc: 'Vitalizes body & mind during semester exams' },
    { id: 'groc-6', name: 'Dark Fantasy Choco Fills (Pack of 3)', price: 120, originalPrice: 150, discount: '20% OFF', image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80', desc: 'Molten choco center cookies' },
    { id: 'groc-7', name: 'Bisleri Mineral Water Can (20 Litres)', price: 70, originalPrice: 90, discount: '22% OFF', image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&q=80', desc: 'Delivered directly to your hostel block' },
    { id: 'groc-8', name: 'Quaker Instant Oats (1kg)', price: 185, originalPrice: 220, discount: '16% OFF', image: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=600&q=80', desc: 'Quick 3-minute healthy breakfast' },
  ],
  repairs: [
    { id: 'rep-1', name: 'Laptop Deep Clean & Thermal Paste', price: 499, originalPrice: 899, discount: '44% OFF', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&q=80', desc: 'Fix overheating, noisy fans and boost speed with Arctic MX-4 paste' },
    { id: 'rep-2', name: 'Laptop Screen Replacement', price: 2999, originalPrice: 4500, discount: '33% OFF', image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=600&q=80', desc: 'Original FHD IPS panels for HP, Dell, Lenovo, Asus, Acer' },
    { id: 'rep-3', name: 'Laptop Keyboard & Trackpad Fix', price: 999, originalPrice: 1600, discount: '37% OFF', image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80', desc: 'Fix sticky, unresponsive, or water-damaged keys' },
    { id: 'rep-4', name: 'SSD Upgrade & OS Migration (512GB)', price: 2499, originalPrice: 3800, discount: '34% OFF', image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&q=80', desc: 'Make your slow laptop 10x faster with NVMe SSD + Genuine Windows' },
    { id: 'rep-5', name: 'Mobile Display & Glass Repair', price: 1499, originalPrice: 2500, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=600&q=80', desc: 'OEM quality screens for iPhone, OnePlus, Samsung, Redmi' },
    { id: 'rep-6', name: 'Doorstep Tech Diagnosis & Pickup', price: 99, originalPrice: 250, discount: '60% OFF', image: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600&q=80', desc: 'Executive inspects device in your hostel room' },
  ],
  print: [
    { id: 'pr-1', name: 'Document Printout (Black & White)', price: 2, originalPrice: 3, discount: '33% OFF', image: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=600&q=80', desc: 'Crisp 75 GSM laser printing (Price per page)' },
    { id: 'pr-2', name: 'High-Res Color Printout', price: 8, originalPrice: 15, discount: '46% OFF', image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&q=80', desc: 'Vibrant color prints for diagrams, presentations & assignments' },
    { id: 'pr-3', name: 'Spiral Project Binding', price: 35, originalPrice: 60, discount: '41% OFF', image: 'https://images.unsplash.com/photo-1531346878377-a5447cb02621?w=600&q=80', desc: 'Transparent plastic sheet front & back with sturdy coil' },
    { id: 'pr-4', name: 'Hardbound Golden Embossed Thesis', price: 250, originalPrice: 400, discount: '37% OFF', image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80', desc: 'Official final-year engineering / PG dissertation hard binding' },
    { id: 'pr-5', name: 'Engineering Drawing A3 Prints', price: 15, originalPrice: 25, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&q=80', desc: 'CAD sheets, electrical schematics and blueprints' },
  ],
  stationary: [
    { id: 'stat-1', name: 'Premium Notebook Set (3 Pcs)', price: 150, originalPrice: 220, discount: '31% OFF', image: 'https://images.unsplash.com/photo-1531346878377-a5447cb02621?q=80&w=600&auto=format&fit=crop', desc: 'Set of 3 spiral notebooks, 200 pages' },
    { id: 'stat-2', name: 'Color Pens Pack (12 Pcs)', price: 80, originalPrice: 120, discount: '33% OFF', image: 'https://images.unsplash.com/photo-1585040316886-4f51e0417935?q=80&w=600&auto=format&fit=crop', desc: '12 vibrant colors for notes and charts' },
    { id: 'stat-3', name: 'Sticky Notes Bundle (5 Colors)', price: 120, originalPrice: 180, discount: '33% OFF', image: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?q=80&w=600&auto=format&fit=crop', desc: '5 neon colors, 500 sheets total' },
    { id: 'stat-4', name: 'Laboratory Apron (White)', price: 299, originalPrice: 499, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=600&q=80', desc: 'Standard lab coat for chemistry & biology experiments' },
  ],
  laundry: [
    { id: 'laun-1', name: 'Wash & Fold (Per kg)', price: 60, originalPrice: 80, discount: '25% OFF', image: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?q=80&w=600&auto=format&fit=crop', desc: 'Standard machine wash and fold' },
    { id: 'laun-2', name: 'Wash & Steam Iron (Per kg)', price: 90, originalPrice: 120, discount: '25% OFF', image: 'https://images.unsplash.com/photo-1590393802821-396a84c8a209?q=80&w=600&auto=format&fit=crop', desc: 'Complete laundry service delivered crisp' },
    { id: 'laun-3', name: 'Sneaker Deep Cleaning Spa', price: 200, originalPrice: 350, discount: '42% OFF', image: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?q=80&w=600&auto=format&fit=crop', desc: 'Removes stains, soles whitening, sanitized' },
    { id: 'laun-4', name: 'Blanket / Quilt Wash', price: 300, originalPrice: 450, discount: '33% OFF', image: 'https://images.unsplash.com/photo-1585058177114-f89a9f24ba22?q=80&w=600&auto=format&fit=crop', desc: 'Heavy winter blanket & comforter wash' },
  ],
  pharmacy: [
    { id: 'phar-1', name: 'Paracetamol 500mg (Strip of 10)', price: 30, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ad?q=80&w=600&auto=format&fit=crop', desc: 'Fever and headache pain relief' },
    { id: 'phar-2', name: 'Volini Pain Relief Spray', price: 160, image: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?q=80&w=600&auto=format&fit=crop', desc: 'Instant relief for backache and sports sprains' },
    { id: 'phar-3', name: 'First Aid Kit Complete', price: 350, image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?q=80&w=600&auto=format&fit=crop', desc: 'Bandages, Dettol antiseptic, cotton, burnol' },
    { id: 'phar-4', name: 'Electral ORS Hydration (5 Packs)', price: 110, image: 'https://images.unsplash.com/photo-1614735241165-6756e1df61ab?q=80&w=600&auto=format&fit=crop', desc: 'WHO approved formula for quick energy & rehydration' },
  ],
  rentals: [
    { id: 'coride-1', name: 'Campus to Vijayawada Station (Bike Pool)', price: 80, originalPrice: 150, discount: '47% OFF', image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&q=80', desc: 'Riding with 3rd Year CSE student. Helmet provided. 5:30 PM slot.' },
    { id: 'coride-2', name: 'Weekend Mall Drop & Return (Car Pool)', price: 120, originalPrice: 250, discount: '52% OFF', image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&q=80', desc: 'AC Car ride to PVP Square / Trendset Mall. 3 seats open.' },
    { id: 'coride-3', name: 'Gannavaram Airport Drop (Cab Pool)', price: 350, originalPrice: 800, discount: '56% OFF', image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&q=80', desc: 'Early morning flight share with hostel mates. Split luggage space.' },
    { id: 'coride-4', name: 'Campus Gear Cycle Rental (Daily)', price: 49, originalPrice: 99, discount: '50% OFF', image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&q=80', desc: 'Geared bicycle with lock for moving between academic blocks.' },
    { id: 'coride-5', name: 'Electric Scooter (Weekly Pass)', price: 399, originalPrice: 700, discount: '43% OFF', image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&q=80', desc: 'Battery charged, 40km range for daily campus and mess transit.' },
  ],
  tailoring: [
    { id: 'tailor-1', name: 'Jeans & Trouser Length Alteration', price: 60, originalPrice: 100, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=600&q=80', desc: 'Bottom shortening & neat machine hem stitch for denim & formals' },
    { id: 'tailor-2', name: 'Shirt / Kurti Fitting & Alteration', price: 80, originalPrice: 150, discount: '46% OFF', image: 'https://images.unsplash.com/photo-1590393802821-396a84c8a209?w=600&q=80', desc: 'Side taper and chest tightening for campus interview formals' },
    { id: 'tailor-3', name: 'Lab Coat Resizing & Name Tag Stitch', price: 75, originalPrice: 120, discount: '37% OFF', image: 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=600&q=80', desc: 'Sleeve short & custom department embroidery name badge' },
    { id: 'tailor-4', name: 'Zipper Replacement (Jackets & Jeans)', price: 50, originalPrice: 90, discount: '44% OFF', image: 'https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?w=600&q=80', desc: 'Heavy brass/metal runner zipper for hoodies, jackets & pants' },
    { id: 'tailor-5', name: 'Button Attachment & Torn Seam Repair', price: 30, originalPrice: 50, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=600&q=80', desc: 'Reinforced stitch for pockets, belt loops & formal buttons' },
    { id: 'tailor-6', name: 'Custom Kurti / Blouse Stitching', price: 299, originalPrice: 500, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80', desc: 'Traditional fest wear stitched to exact body measurements' },
    { id: 'tailor-7', name: 'Doorstep Measurement & Garment Pickup', price: 40, originalPrice: 80, discount: '50% OFF', image: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600&q=80', desc: 'Campus tailor executive takes measurements in hostel lobby' },
  ],
};

const CATEGORY_META: Record<string, { title: string; subtitle: string; icon: string }> = {
  electronics: { title: 'Electronics & Tech', subtitle: 'CHARGERS, BOARDS, GADGETS & ACCESSORIES', icon: '🔌' },
  mattresses: { title: 'Mattresses & Bedding', subtitle: 'ROOM ESSENTIALS & MOVE-IN GEAR', icon: '🛏️' },
  groceries: { title: 'Kirana & Late-Night Mart', subtitle: 'SNACKS, NOODLES, DRINKS & ESSENTIALS', icon: '🛒' },
  repairs: { title: 'Laptop & Tech Repairs', subtitle: 'DOORSTEP DIAGNOSTICS & HARDWARE FIX', icon: '💻' },
  print: { title: '24/7 Printout & Xerox', subtitle: 'ASSIGNMENTS, THESIS BINDING & CAD', icon: '🖨️' },
  stationary: { title: 'Stationery & Study Kits', subtitle: 'NOTEBOOKS, PENS, LAB COATS & SUPPLIES', icon: '📓' },
  laundry: { title: 'Wash & Dry Clean', subtitle: 'HOSTEL DOORSTEP PICKUP & IRONING', icon: '🧺' },
  pharmacy: { title: 'Emergency Pharmacy SOS', subtitle: 'MEDICINES, FIRST AID & WELLNESS', icon: '⚕️' },
  rentals: { title: 'Co-Ride & Campus Rentals', subtitle: 'PEER BIKEPOOL, CARPOOL & CYCLE RENTALS', icon: '🏍️' },
  tailoring: { title: 'Tailoring & Stitching', subtitle: 'CLOTHES ALTERATION, FITTING & REPAIRS', icon: '🪡' },
};

export default function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { user } = useAuth();
  const { addToCart, cart, updateQuantity, totalItems, totalPrice } = useCart();
  const [items, setItems] = useState<any[]>(MOCK_DATA[id || ''] || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Dedicated Service Booking Modal States
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [garmentType, setGarmentType] = useState('Jeans / Trousers');
  const [serviceNotes, setServiceNotes] = useState('');
  const [pickupSlot, setPickupSlot] = useState('Today 4:00 PM - 6:00 PM');
  const [hostelBlock, setHostelBlock] = useState(user?.hostelBlock || 'Ganga Block');
  const [roomNumber, setRoomNumber] = useState(user?.roomNumber || user?.roomNo || 'Room 412');
  const [contactPhone, setContactPhone] = useState(user?.phone || user?.mobile || '');
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const categoryId = (id || 'electronics').toLowerCase();
  const isServiceCategory = ['tailoring', 'repairs', 'print', 'laundry'].includes(categoryId);
  const meta = CATEGORY_META[categoryId] || { title: 'Campus Store', subtitle: 'A TO Z STUDENT ESSENTIALS', icon: '✨' };

  useEffect(() => {
    if (user?.hostelBlock) setHostelBlock(user.hostelBlock);
    if (user?.roomNumber || user?.roomNo) setRoomNumber(user.roomNumber || user.roomNo || '');
    if (user?.phone || user?.mobile) setContactPhone(user.phone || user.mobile || '');
  }, [user]);

  useEffect(() => {
    const fetchCategoryItems = async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`${API_URL}/api/search?q=${encodeURIComponent(categoryId)}`);
        if (res.ok) {
          const data = await res.json();
          const fetchedItems = data.items || [];
          if (fetchedItems.length > 0) {
            const formatted = fetchedItems.map((item: any) => ({
              id: item.id || item._id,
              name: item.name,
              price: item.price,
              originalPrice: item.price * 1.3,
              discount: '30% OFF',
              image: item.imageUrl || item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
              desc: item.description,
              restaurantId: item.restaurantId?._id || item.restaurantId || 'campus-hub-merchant',
              restaurantName: item.restaurantId?.name || 'Zenvy Campus Hub'
            }));
            const curated = MOCK_DATA[categoryId] || [];
            setItems([...curated, ...formatted]);
          }
        }
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };
    fetchCategoryItems();
  }, [categoryId]);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.desc && item.desc.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const txt = colors.text;
  const txtSec = colors.textSecondary;
  const bg = colors.bg;
  const cardBg = colors.card;
  const border = colors.border;

  const handleAction = (item: any) => {
    if (isServiceCategory) {
      setSelectedService(item);
      setServiceNotes('');
      setServiceModalVisible(true);
    } else {
      addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: 1,
        restaurantId: item.restaurantId || 'campus-hub-merchant',
        restaurantName: item.restaurantName || meta.title
      });
      Alert.alert('Added to Cart 🛒', `${item.name} added to your basket.`);
    }
  };

  const handleConfirmServiceBooking = async () => {
    if (!selectedService) return;
    if (!hostelBlock || !roomNumber) {
      Alert.alert('Missing Location', 'Please enter your hostel block and room number for doorstep pickup.');
      return;
    }

    try {
      setSubmittingBooking(true);
      const serviceTypeMapping: Record<string, string> = {
        tailoring: 'TAILORING',
        repairs: 'LAPTOP_REPAIR',
        print: 'PRINTOUT',
        laundry: 'LAUNDRY'
      };

      const payload = {
        serviceType: serviceTypeMapping[categoryId] || 'GENERAL',
        title: selectedService.name,
        description: serviceNotes ? `[Customer Notes: ${serviceNotes}] - ${selectedService.desc}` : selectedService.desc,
        specifications: {
          garmentType: categoryId === 'tailoring' ? garmentType : undefined,
          serviceName: selectedService.name,
          category: categoryId,
          notes: serviceNotes
        },
        quotedAmount: selectedService.price,
        pickupSlot: pickupSlot,
        hostelBlock: hostelBlock,
        roomNumber: roomNumber,
        deliveryAddress: `${hostelBlock}, Room ${roomNumber}`,
        contactPhone: contactPhone
      };

      const res = await apiFetch(`${API_URL}/api/services/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setServiceModalVisible(false);

      if (res.ok && data.booking) {
        Alert.alert(
          '🎉 Service Scheduled Successfully!',
          `Booking ID: #${(data.booking.id || '').substring(0, 8).toUpperCase()}\n\nService: ${selectedService.name}\nEstimated Price: ₹${selectedService.price}\nPickup Slot: ${pickupSlot}\nLocation: ${hostelBlock}, ${roomNumber}\n\nOur campus partner will arrive at your hostel at the scheduled slot.`,
          [{ text: 'VIEW ORDERS / SERVICES', onPress: () => router.push('/(tabs)/orders' as any) }, { text: 'DONE' }]
        );
      } else {
        Alert.alert(
          '🎉 Service Scheduled!',
          `Your request for ${selectedService.name} (₹${selectedService.price}) has been received.\nDoorstep pickup at ${hostelBlock}, ${roomNumber} during ${pickupSlot}.`,
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      Alert.alert(
        '🎉 Service Request Confirmed',
        `Pickup scheduled for ${selectedService?.name} at ${hostelBlock}, ${roomNumber} (${pickupSlot}). Partner will contact you before arrival.`
      );
      setServiceModalVisible(false);
    } finally {
      setSubmittingBooking(false);
    }
  };

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: border, backgroundColor: isDark ? '#111114' : '#FFF' }]}>
        <TouchableOpacity 
          style={s.backBtn} 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)' as any);
            }
          }}
        >
          <Text style={[s.backIcon, { color: txt }]}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.subText}>{meta.subtitle}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
            <Text style={[s.title, { color: txt }]}>{meta.title}</Text>
          </View>
        </View>
        <View style={{ backgroundColor: isServiceCategory ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: isServiceCategory ? '#3B82F6' : '#10B981' }}>
          <Text style={{ fontSize: 9, fontWeight: '900', color: isServiceCategory ? '#3B82F6' : '#10B981', letterSpacing: 0.5 }}>
            {isServiceCategory ? '🛠️ CAMPUS SERVICE' : '🛍️ STORE'}
          </Text>
        </View>
      </View>

      {/* Search Filter */}
      <View style={[s.searchWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6' }]}>
        <Text style={{ fontSize: 14 }}>🔍</Text>
        <TextInput
          placeholder={`Search in ${meta.title}...`}
          placeholderTextColor={txtSec}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[s.searchInput, { color: txt }]}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={{ color: txtSec, fontSize: 12 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Grid List */}
      {loading && items.length === 0 ? (
        <View style={s.emptyState}>
          <ActivityIndicator size="large" color={COLORS.red} />
          <Text style={{ marginTop: 12, color: txtSec, fontSize: 11, fontWeight: '700' }}>Loading items...</Text>
        </View>
      ) : filteredItems.length > 0 ? (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={s.listContent}
          columnWrapperStyle={s.columnWrapper}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[s.card, { backgroundColor: cardBg, borderColor: border }]}>
              <View style={s.imageBox}>
                <Image source={{ uri: item.image }} style={s.cardImg} />
                {item.discount && (
                  <View style={s.discountBadge}>
                    <Text style={s.discountText}>{item.discount}</Text>
                  </View>
                )}
                {isServiceCategory && (
                  <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ color: '#FCD34D', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.5 }}>DOORSTEP</Text>
                  </View>
                )}
              </View>
              <View style={s.cardInfo}>
                <Text style={[s.itemName, { color: txt }]} numberOfLines={2}>{item.name}</Text>
                <Text style={s.itemDesc} numberOfLines={2}>{item.desc}</Text>
                
                <View style={s.bottomRow}>
                  <View>
                    <Text style={[s.itemPrice, { color: txt }]}>₹{item.price}</Text>
                    {item.originalPrice && (
                      <Text style={s.originalPrice}>₹{item.originalPrice}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[s.addBtn, isServiceCategory && { backgroundColor: '#3B82F6' }]}
                    onPress={() => handleAction(item)}
                    activeOpacity={0.85}
                  >
                    <Text style={s.addBtnText}>{isServiceCategory ? 'BOOK ➔' : 'ADD +'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      ) : (
        <View style={s.emptyState}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>📦</Text>
          <Text style={{ color: txt, fontSize: 15, fontWeight: '800' }}>No items found</Text>
          <Text style={{ color: txtSec, fontSize: 12, marginTop: 4 }}>Try searching for a different item name</Text>
        </View>
      )}

      {/* Floating Cart Sticky Bar if items exist and NOT service category */}
      {!isServiceCategory && totalItems > 0 && (
        <TouchableOpacity
          style={s.floatingCartBar}
          onPress={() => router.push('/(tabs)/basket' as any)}
        >
          <View>
            <Text style={s.floatingCartCount}>{totalItems} ITEMS IN BASKET</Text>
            <Text style={s.floatingCartTotal}>₹{totalPrice}</Text>
          </View>
          <View style={s.viewCartBtn}>
            <Text style={s.viewCartText}>VIEW BASKET ➔</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── PROFESSIONAL SERVICE BOOKING MODAL ── */}
      <Modal
        visible={serviceModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setServiceModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: isDark ? '#1C1C1E' : '#FFF', 
            borderTopLeftRadius: 28, 
            borderTopRightRadius: 28, 
            padding: 20, 
            maxHeight: '88%',
            borderWidth: 1,
            borderColor: border 
          }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Modal Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#3B82F6', letterSpacing: 1.5 }}>
                    {meta.title.toUpperCase()} • DOORSTEP SERVICE
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: txt, marginTop: 2 }}>
                    {selectedService?.name}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setServiceModalVisible(false)}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? '#27272A' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 14, color: txtSec, fontWeight: '900' }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Price & Turnaround Badge */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <View style={{ backgroundColor: isDark ? '#27272A' : '#F8FAFC', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: border }}>
                  <Text style={{ fontSize: 8, fontWeight: '800', color: txtSec }}>BASE CHARGE</Text>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#10B981', marginTop: 1 }}>₹{selectedService?.price}</Text>
                </View>
                <View style={{ backgroundColor: isDark ? '#27272A' : '#F8FAFC', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: border, flex: 1 }}>
                  <Text style={{ fontSize: 8, fontWeight: '800', color: txtSec }}>CAMPUS TURNAROUND</Text>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: txt, marginTop: 2 }}>⚡ Same Day / 24h Delivery</Text>
                </View>
              </View>

              {/* Tailoring Specific: Garment Type Selector */}
              {categoryId === 'tailoring' && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: txt, letterSpacing: 1, marginBottom: 8 }}>
                    SELECT GARMENT TYPE
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {['Jeans / Trousers', 'Shirt / Kurti', 'Lab Coat', 'Blazer / Suit', 'Traditional Wear', 'Other'].map(g => (
                      <TouchableOpacity
                        key={g}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 10,
                          backgroundColor: garmentType === g ? '#3B82F6' : (isDark ? '#27272A' : '#F1F5F9'),
                          borderWidth: 1,
                          borderColor: garmentType === g ? '#3B82F6' : border
                        }}
                        onPress={() => setGarmentType(g)}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '800', color: garmentType === g ? '#FFF' : txtSec }}>
                          {g}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Alteration / Issue Notes */}
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: txt, letterSpacing: 1, marginBottom: 6 }}>
                  {categoryId === 'tailoring' ? 'ALTERATION & MEASUREMENT NOTES' : categoryId === 'repairs' ? 'DEVICE MODEL & PROBLEM SYMPTOMS' : 'SERVICE SPECIFICATIONS'}
                </Text>
                <TextInput
                  style={{
                    backgroundColor: isDark ? '#27272A' : '#F8FAFC',
                    borderWidth: 1,
                    borderColor: border,
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 12,
                    color: txt,
                    minHeight: 65,
                    textAlignVertical: 'top'
                  }}
                  placeholder={categoryId === 'tailoring' ? 'e.g. Shorten bottom length by 2 inches, tighten waist' : categoryId === 'repairs' ? 'e.g. Dell Inspiron 15, screen flickering when moved, fan noise' : 'Enter any special instructions...'}
                  placeholderTextColor={txtSec}
                  value={serviceNotes}
                  onChangeText={setServiceNotes}
                  multiline={true}
                />
              </View>

              {/* Pickup Time Slot */}
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: txt, letterSpacing: 1, marginBottom: 8 }}>
                  PREFERRED PICKUP SLOT
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {['Today 4:00 PM - 6:00 PM', 'Today 7:00 PM - 9:00 PM', 'Tomorrow Morning 10 AM', 'Urgent / 2 Hours (+₹20)'].map(slot => (
                    <TouchableOpacity
                      key={slot}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 10,
                        backgroundColor: pickupSlot === slot ? (isDark ? '#3B82F6' : '#2563EB') : (isDark ? '#27272A' : '#F1F5F9'),
                        borderWidth: 1,
                        borderColor: pickupSlot === slot ? '#2563EB' : border
                      }}
                      onPress={() => setPickupSlot(slot)}
                    >
                      <Text style={{ fontSize: 9.5, fontWeight: '800', color: pickupSlot === slot ? '#FFF' : txtSec }}>
                        {slot}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Hostel & Room Location (Doorstep Pickup) */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: txt, letterSpacing: 1, marginBottom: 6 }}>
                  DOORSTEP PICKUP LOCATION
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: isDark ? '#27272A' : '#F8FAFC',
                      borderWidth: 1,
                      borderColor: border,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 11.5,
                      fontWeight: '700',
                      color: txt
                    }}
                    placeholder="Hostel Block (e.g. Ganga)"
                    placeholderTextColor={txtSec}
                    value={hostelBlock}
                    onChangeText={setHostelBlock}
                  />
                  <TextInput
                    style={{
                      width: 120,
                      backgroundColor: isDark ? '#27272A' : '#F8FAFC',
                      borderWidth: 1,
                      borderColor: border,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 11.5,
                      fontWeight: '700',
                      color: txt
                    }}
                    placeholder="Room No (e.g. 412)"
                    placeholderTextColor={txtSec}
                    value={roomNumber}
                    onChangeText={setRoomNumber}
                  />
                </View>
              </View>

              {/* Confirm Booking CTA */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#3B82F6',
                  paddingVertical: 14,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                  shadowColor: '#3B82F6',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4
                }}
                onPress={handleConfirmServiceBooking}
                disabled={submittingBooking}
                activeOpacity={0.85}
              >
                {submittingBooking ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900', letterSpacing: 1 }}>
                    CONFIRM & SCHEDULE PICKUP 🚀
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 52 : 42,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: { paddingRight: 14, paddingVertical: 4 },
  backIcon: { fontSize: 32, fontWeight: '300', lineHeight: 32 },
  subText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: '#EF4444', marginBottom: 2 },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  serviceActionBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  serviceActionBtnText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 90 },
  columnWrapper: { justifyContent: 'space-between', marginBottom: 14 },
  card: {
    width: (SW - 44) / 2,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageBox: { width: '100%', height: 120, position: 'relative' },
  cardImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  cardInfo: { padding: 10, flex: 1, justifyContent: 'space-between' },
  itemName: { fontSize: 13, fontWeight: '800', lineHeight: 17, marginBottom: 4 },
  itemDesc: { fontSize: 10, color: '#888', lineHeight: 14, marginBottom: 8 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  itemPrice: { fontSize: 14, fontWeight: '900' },
  originalPrice: { fontSize: 10, color: '#999', textDecorationLine: 'line-through' },
  addBtn: { backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  floatingCartBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  floatingCartCount: { color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  floatingCartTotal: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  viewCartBtn: { backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  viewCartText: { color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
});
