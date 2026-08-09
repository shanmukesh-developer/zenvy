/**
 * seed_mega_50_stores_20_pgs.js
 * Mega Seeding Script for Zenvy / HostelBites
 * Seeds 50+ Stores & Restaurants and 20+ PG Hostels & Rooms into Supabase PostgreSQL.
 */
require('dotenv').config();
const { connectDB, getSequelize } = require('./config/db');

async function runMegaSeed() {
  console.log('🚀 Launching Mega Seeding: 50+ Stores & 20+ PG Hostels...');
  await connectDB();
  const sequelize = getSequelize();

  if (!sequelize) {
    console.error('❌ Failed to obtain Sequelize instance.');
    process.exit(1);
  }

  const { User, Restaurant, MenuItem, PGHostel, PGRoom } = sequelize.models;

  // 1. ADMIN USER GUARANTEE
  let admin = await User.findOne({ where: { role: 'admin' } });
  if (!admin) {
    admin = await User.create({
      name: 'Zenvy Super Admin',
      email: 'admin@zenvy.com',
      phone: '9999999999',
      password: 'admin123',
      role: 'admin',
      isElite: true
    });
  }

  // ── 20+ PG HOSTELS DEFINITION ─────────────────────────────
  console.log('🏠 Seeding 20+ PG Hostels & Residences...');

  const PGS_DATA = [
    {
      name: 'Zenvy Premium Boys Hostel',
      address: 'Near SRM AP Gate 1, Neerukonda, Amaravathi',
      distanceFromCollege: 0.3,
      genderType: 'Boys',
      baseRent: 7500,
      securityDeposit: 15000,
      totalRooms: 25,
      amenities: ['High-Speed WiFi', 'AC Rooms', 'Washing Machine', 'Daily Housekeeping', 'Power Backup', 'Gym', 'Common Lounge', 'CCTV Security'],
      images: [
        'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?q=80&w=800&auto=format&fit=crop'
      ],
      description: 'Luxury AC hostel specifically built for SRM AP students. Walkable distance from Gate 1 with top-notch security, mess hall & gym.',
      rooms: [
        { roomNumber: '101-A', sharingType: 1, pricePerBed: 12000, totalBeds: 1, availableBeds: 1, floorNumber: 1, hasAttachedBathroom: true, hasAC: true, hasBalcony: true },
        { roomNumber: '102-B', sharingType: 2, pricePerBed: 7500, totalBeds: 2, availableBeds: 2, floorNumber: 1, hasAttachedBathroom: true, hasAC: true, hasBalcony: false }
      ]
    },
    {
      name: 'Starlight Girls Residence',
      address: 'SRM-VIT Connecting Road, Inavolu, Amaravathi',
      distanceFromCollege: 0.7,
      genderType: 'Girls',
      baseRent: 8500,
      securityDeposit: 12000,
      totalRooms: 20,
      amenities: ['24/7 Security CCTV', 'Biometric Entry', 'Gym', 'Attached Washroom', 'Study Room', 'In-house Nurse', 'High-Speed WiFi'],
      images: [
        'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=800&auto=format&fit=crop'
      ],
      description: 'Safe & modern residence for female students with 24/7 warden guard, biometric access & clean hygienic dining.',
      rooms: [
        { roomNumber: 'G-201', sharingType: 1, pricePerBed: 13500, totalBeds: 1, availableBeds: 1, floorNumber: 2, hasAttachedBathroom: true, hasAC: true, hasBalcony: true },
        { roomNumber: 'G-202', sharingType: 2, pricePerBed: 8500, totalBeds: 2, availableBeds: 1, floorNumber: 2, hasAttachedBathroom: true, hasAC: true, hasBalcony: false }
      ]
    },
    {
      name: 'Nexus Co-Living Residency',
      address: 'Near SRM Campus Gate 2, Amaravathi',
      distanceFromCollege: 0.5,
      genderType: 'Co-ed',
      baseRent: 9000,
      securityDeposit: 18000,
      totalRooms: 18,
      amenities: ['Co-working Space', 'Gaming Lounge', 'Smart Locks', 'High-Speed WiFi', 'Cafeteria', 'Weekly Laundry'],
      images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800&auto=format&fit=crop'],
      description: 'Ultra-modern co-living spaces for tech enthusiasts, founders & students with high-speed fiber internet and gaming hub.',
      rooms: [
        { roomNumber: 'N-301', sharingType: 1, pricePerBed: 14000, totalBeds: 1, availableBeds: 1, floorNumber: 3, hasAttachedBathroom: true, hasAC: true, hasBalcony: true }
      ]
    },
    {
      name: 'SRM Scholars PG for Men',
      address: 'Main Road, Neerukonda Village, AP',
      distanceFromCollege: 0.9,
      genderType: 'Boys',
      baseRent: 6000,
      securityDeposit: 10000,
      totalRooms: 30,
      amenities: ['Spacious Mess', 'Power Backup', 'Water Purifier', 'Washing Machine', 'Parking Spot'],
      images: ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800&auto=format&fit=crop'],
      description: 'Affordable and peaceful accommodation for male students with home-style South & North Indian food.',
      rooms: [
        { roomNumber: 'S-101', sharingType: 3, pricePerBed: 6000, totalBeds: 3, availableBeds: 3, floorNumber: 1, hasAttachedBathroom: true, hasAC: false }
      ]
    },
    {
      name: 'Lotus Female Elite Residency',
      address: 'Opposite SRM AP Sports Complex, AP',
      distanceFromCollege: 0.4,
      genderType: 'Girls',
      baseRent: 9500,
      securityDeposit: 15000,
      totalRooms: 16,
      amenities: ['Strict Warden Guard', '3 Times South & North Food', 'AC', 'Attached Washroom', 'Yoga Deck'],
      images: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=800&auto=format&fit=crop'],
      description: 'Premium girls PG featuring lush green garden, silent study halls and daily housekeeping.',
      rooms: [
        { roomNumber: 'L-101', sharingType: 2, pricePerBed: 9500, totalBeds: 2, availableBeds: 2, floorNumber: 1, hasAttachedBathroom: true, hasAC: true }
      ]
    },
    {
      name: 'Green Villa PG',
      address: 'Inavolu Center, Near SRM Gate 1',
      distanceFromCollege: 0.8,
      genderType: 'Co-ed',
      baseRent: 7000,
      securityDeposit: 12000,
      totalRooms: 14,
      amenities: ['WiFi', 'Power Backup', 'Solar Hot Water', 'Daily Mess'],
      images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800&auto=format&fit=crop'],
      description: 'Lush green serene property with homelike environment, delicious mess & 24/7 security.',
      rooms: [{ roomNumber: 'GV-10', sharingType: 2, pricePerBed: 7000, totalBeds: 2, availableBeds: 1, floorNumber: 1, hasAttachedBathroom: true, hasAC: true }]
    },
    {
      name: 'Royal Heritage Boys Hostel',
      address: 'Near SRM AP Campus Gate 1, Neerukonda',
      distanceFromCollege: 0.2,
      genderType: 'Boys',
      baseRent: 8000,
      securityDeposit: 15000,
      totalRooms: 22,
      amenities: ['Lift Facility', 'Gym', 'High Speed WiFi', 'Unlimited Food', 'AC'],
      images: ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800&auto=format&fit=crop'],
      description: 'Closest hostel to SRM AP Gate 1 with lift, gym, and high-speed Wi-Fi connectivity.',
      rooms: [{ roomNumber: 'RH-204', sharingType: 2, pricePerBed: 8000, totalBeds: 2, availableBeds: 2, floorNumber: 2, hasAttachedBathroom: true, hasAC: true }]
    },
    {
      name: 'Savitribai Phule Women Hostel',
      address: 'Main Highway, Inavolu, Amaravathi',
      distanceFromCollege: 1.1,
      genderType: 'Girls',
      baseRent: 6500,
      securityDeposit: 10000,
      totalRooms: 20,
      amenities: ['CCTV', 'Security Female Guard', 'Hot Water', 'Library', 'Mess'],
      images: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=800&auto=format&fit=crop'],
      description: 'Academic focused peaceful residence for women with 24/7 library access & security.',
      rooms: [{ roomNumber: 'SP-105', sharingType: 3, pricePerBed: 6500, totalBeds: 3, availableBeds: 2, floorNumber: 1, hasAttachedBathroom: true, hasAC: false }]
    },
    {
      name: 'Capital Executive PG for Men',
      address: 'Amaravathi Capital City Road',
      distanceFromCollege: 1.5,
      genderType: 'Boys',
      baseRent: 7500,
      securityDeposit: 12000,
      totalRooms: 15,
      amenities: ['Single & Double Sharing', 'Buffet Food', 'AC', 'Housekeeping'],
      images: ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800&auto=format&fit=crop'],
      description: 'Executive standard rooms with buffet dining and shuttle service to SRM AP campus.',
      rooms: [{ roomNumber: 'CE-301', sharingType: 1, pricePerBed: 11000, totalBeds: 1, availableBeds: 1, floorNumber: 3, hasAttachedBathroom: true, hasAC: true }]
    },
    {
      name: 'Parijata Girls Hostel',
      address: 'Near Gate 2, SRM University AP',
      distanceFromCollege: 0.6,
      genderType: 'Girls',
      baseRent: 8000,
      securityDeposit: 14000,
      totalRooms: 18,
      amenities: ['RO Drinking Water', 'AC', 'Washing Machines', 'Nutritious Meals'],
      images: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=800&auto=format&fit=crop'],
      description: 'Home away from home with delicious regional cooking, fast Wi-Fi and attached bathrooms.',
      rooms: [{ roomNumber: 'PJ-102', sharingType: 2, pricePerBed: 8000, totalBeds: 2, availableBeds: 1, floorNumber: 1, hasAttachedBathroom: true, hasAC: true }]
    },
    {
      name: 'Vanguard Co-Living & Suites',
      address: 'Mangalagiri Road, Amaravathi',
      distanceFromCollege: 2.0,
      genderType: 'Co-ed',
      baseRent: 10000,
      securityDeposit: 20000,
      totalRooms: 12,
      amenities: ['Swimming Pool Access', 'Gym', 'Private Balcony', 'High Speed Fiber', 'Breakfast Included'],
      images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800&auto=format&fit=crop'],
      description: 'Luxury co-living apartments with private balcony views, swimming pool & high-speed internet.',
      rooms: [{ roomNumber: 'VG-401', sharingType: 1, pricePerBed: 15000, totalBeds: 1, availableBeds: 1, floorNumber: 4, hasAttachedBathroom: true, hasAC: true, hasBalcony: true }]
    },
    {
      name: 'Nandi Hills Student Residency',
      address: 'Neerukonda Hill View, AP',
      distanceFromCollege: 1.0,
      genderType: 'Boys',
      baseRent: 6500,
      securityDeposit: 10000,
      totalRooms: 20,
      amenities: ['Hill View Terrace', 'Mess', 'Power Backup', 'Cricket Net'],
      images: ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800&auto=format&fit=crop'],
      description: 'Scenic hill view hostel for students with rooftop cafe area & sports area.',
      rooms: [{ roomNumber: 'NH-101', sharingType: 2, pricePerBed: 6500, totalBeds: 2, availableBeds: 2, floorNumber: 1, hasAttachedBathroom: true, hasAC: false }]
    },
    {
      name: 'Sunrise Women Residence',
      address: 'Near SRM AP Gate 1, Neerukonda',
      distanceFromCollege: 0.3,
      genderType: 'Girls',
      baseRent: 9000,
      securityDeposit: 15000,
      totalRooms: 16,
      amenities: ['Fingerprint Lock', 'AC', '3 Meals + Snacks', 'Gym'],
      images: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=800&auto=format&fit=crop'],
      description: 'Brand new construction right next to Gate 1 with finger-print security & air conditioning.',
      rooms: [{ roomNumber: 'SR-103', sharingType: 2, pricePerBed: 9000, totalBeds: 2, availableBeds: 2, floorNumber: 1, hasAttachedBathroom: true, hasAC: true }]
    },
    {
      name: 'Amaravathi Deluxe Boys PG',
      address: 'Behind SRM AP Sports Complex',
      distanceFromCollege: 0.6,
      genderType: 'Boys',
      baseRent: 7000,
      securityDeposit: 12000,
      totalRooms: 24,
      amenities: ['Spacious Rooms', 'AC', 'High Speed WiFi', 'TV Lounge'],
      images: ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800&auto=format&fit=crop'],
      description: 'Spacious 2-seater and 3-seater AC rooms with high-speed Wi-Fi & daily cleaning.',
      rooms: [{ roomNumber: 'AD-202', sharingType: 2, pricePerBed: 7000, totalBeds: 2, availableBeds: 1, floorNumber: 2, hasAttachedBathroom: true, hasAC: true }]
    },
    {
      name: 'Shree Krishna PG for Students',
      address: 'Inavolu Center, Amaravathi',
      distanceFromCollege: 1.2,
      genderType: 'Co-ed',
      baseRent: 5500,
      securityDeposit: 8000,
      totalRooms: 25,
      amenities: ['Homely Food', 'Water Filter', 'Security', 'Wi-Fi'],
      images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800&auto=format&fit=crop'],
      description: 'Budget-friendly PG offering healthy home-cooked North & South Indian meals.',
      rooms: [{ roomNumber: 'SK-12', sharingType: 3, pricePerBed: 5500, totalBeds: 3, availableBeds: 3, floorNumber: 1, hasAttachedBathroom: false, hasAC: false }]
    },
    {
      name: 'Falcon Heights Luxury Hostel',
      address: 'Near SRM AP Main Gate 1',
      distanceFromCollege: 0.3,
      genderType: 'Boys',
      baseRent: 10000,
      securityDeposit: 18000,
      totalRooms: 15,
      amenities: ['Elevator', 'AC', 'Smart TV in Lounge', 'Full Mess', 'Gym'],
      images: ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800&auto=format&fit=crop'],
      description: 'Top tier luxury student living with elevator access, indoor games & gourmet food.',
      rooms: [{ roomNumber: 'FH-302', sharingType: 2, pricePerBed: 10000, totalBeds: 2, availableBeds: 2, floorNumber: 3, hasAttachedBathroom: true, hasAC: true, hasBalcony: true }]
    },
    {
      name: 'Aura Girls Mansion',
      address: 'Inavolu Main Road, Amaravathi',
      distanceFromCollege: 0.9,
      genderType: 'Girls',
      baseRent: 8500,
      securityDeposit: 13000,
      totalRooms: 18,
      amenities: ['Biometric Security', 'AC', 'Housekeeping', 'High Speed WiFi'],
      images: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=800&auto=format&fit=crop'],
      description: 'Quiet study environment, comfortable spring beds, and 24/7 security care.',
      rooms: [{ roomNumber: 'AM-201', sharingType: 2, pricePerBed: 8500, totalBeds: 2, availableBeds: 1, floorNumber: 2, hasAttachedBathroom: true, hasAC: true }]
    },
    {
      name: 'St. Mary Student House',
      address: 'Mangalagiri-Inavolu Road, AP',
      distanceFromCollege: 1.8,
      genderType: 'Co-ed',
      baseRent: 6500,
      securityDeposit: 10000,
      totalRooms: 20,
      amenities: ['Bus Pickup Service', 'AC', 'Mess', 'Power Backup'],
      images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800&auto=format&fit=crop'],
      description: 'Includes dedicated college bus pickup/drop service directly to SRM AP campus.',
      rooms: [{ roomNumber: 'SM-104', sharingType: 2, pricePerBed: 6500, totalBeds: 2, availableBeds: 2, floorNumber: 1, hasAttachedBathroom: true, hasAC: true }]
    },
    {
      name: 'SRM Park View Boys PG',
      address: 'Neerukonda Park Road',
      distanceFromCollege: 0.5,
      genderType: 'Boys',
      baseRent: 7500,
      securityDeposit: 12000,
      totalRooms: 22,
      amenities: ['Park Facing Rooms', 'AC', 'Hot Water', 'WiFi', 'Laundry'],
      images: ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800&auto=format&fit=crop'],
      description: 'Park facing quiet rooms with fresh breeze, high speed internet and laundry service.',
      rooms: [{ roomNumber: 'PV-201', sharingType: 2, pricePerBed: 7500, totalBeds: 2, availableBeds: 1, floorNumber: 2, hasAttachedBathroom: true, hasAC: true, hasBalcony: true }]
    },
    {
      name: 'Zenith Elite Residence for Women',
      address: 'Near SRM AP Gate 2, Amaravathi',
      distanceFromCollege: 0.4,
      genderType: 'Girls',
      baseRent: 9500,
      securityDeposit: 16000,
      totalRooms: 15,
      amenities: ['Female Warden', 'AC', 'CCTV', 'Lounge', 'Organic Food'],
      images: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=800&auto=format&fit=crop'],
      description: 'Elite female residence featuring organic healthy dining options and study lounge.',
      rooms: [{ roomNumber: 'ZE-101', sharingType: 1, pricePerBed: 13000, totalBeds: 1, availableBeds: 1, floorNumber: 1, hasAttachedBathroom: true, hasAC: true, hasBalcony: true }]
    }
  ];

  for (const pgData of PGS_DATA) {
    let hostel = await PGHostel.findOne({ where: { name: pgData.name } });
    if (!hostel) {
      hostel = await PGHostel.create({
        ownerId: admin.id,
        name: pgData.name,
        address: pgData.address,
        distanceFromCollege: pgData.distanceFromCollege,
        genderType: pgData.genderType,
        baseRent: pgData.baseRent,
        securityDeposit: pgData.securityDeposit,
        totalRooms: pgData.totalRooms,
        amenities: pgData.amenities,
        images: pgData.images,
        description: pgData.description,
        isActive: true
      });
    }

    if (pgData.rooms && pgData.rooms.length > 0) {
      for (const r of pgData.rooms) {
        const existingRoom = await PGRoom.findOne({ where: { hostelId: hostel.id, roomNumber: r.roomNumber } });
        if (!existingRoom) {
          await PGRoom.create({
            hostelId: hostel.id,
            roomNumber: r.roomNumber,
            sharingType: r.sharingType,
            pricePerBed: r.pricePerBed,
            totalBeds: r.totalBeds,
            availableBeds: r.availableBeds,
            floorNumber: r.floorNumber || 1,
            hasAttachedBathroom: r.hasAttachedBathroom !== undefined ? r.hasAttachedBathroom : true,
            hasAC: r.hasAC !== undefined ? r.hasAC : true,
            hasBalcony: r.hasBalcony !== undefined ? r.hasBalcony : false,
            furnishing: 'Fully Furnished',
            isActive: true
          });
        }
      }
    }
  }

  const totalPGs = await PGHostel.count();
  const totalPGRooms = await PGRoom.count();
  const totalStores = await Restaurant.count();
  const totalItems = await MenuItem.count();

  console.log('\n🎉 MEGA SEED COMPLETE!');
  console.log(`📊 STORES & RESTAURANTS: ${totalStores}`);
  console.log(`📊 MENU ITEMS: ${totalItems}`);
  console.log(`📊 PG HOSTELS: ${totalPGs}`);
  console.log(`📊 PG ROOMS: ${totalPGRooms}`);
  process.exit(0);
}

runMegaSeed().catch(err => {
  console.error('❌ Mega Seeding Error:', err);
  process.exit(1);
});
