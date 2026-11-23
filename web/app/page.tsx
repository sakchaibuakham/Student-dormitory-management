'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  doc,
  runTransaction,
  setDoc,
  getDoc,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { compressImageToBase64 } from '@/utils/imageHelper';

type AccessLogItem = {
  id: string;
  studentId: string;
  status: string;
  direction?: 'IN' | 'OUT';
  timestamp?:
    | Timestamp
    | { seconds: number; nanoseconds?: number }
    | Date
    | string
    | null;
};

function formatAccessLogDateTime(raw: AccessLogItem['timestamp']): {
  dateText: string;
  timeText: string;
} {
  let dateObj: Date | null = null;

  if (raw instanceof Timestamp) {
    dateObj = raw.toDate();
  } else if (
    raw &&
    typeof raw === 'object' &&
    'seconds' in raw &&
    typeof raw.seconds === 'number'
  ) {
    dateObj = new Date(raw.seconds * 1000);
  } else if (raw instanceof Date) {
    dateObj = raw;
  } else if (typeof raw === 'string' && raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) dateObj = parsed;
  }

  if (!dateObj) {
    return { dateText: '-', timeText: '-' };
  }

  return {
    dateText: dateObj.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    timeText: dateObj.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };
}

// --- ชุดไอคอนเวกเตอร์สไตล์มินิมอล (SVG) ---
const Icons = {
  Home: ({ active }: { active?: boolean }) => (
    <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Door: ({ active }: { active?: boolean }) => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2zm4-9h.01" />
    </svg>
  ),
  Wallet: ({ active }: { active?: boolean }) => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  Wrench: ({ active }: { active?: boolean }) => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  User: ({ active }: { active?: boolean }) => (
    <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  ScanFace: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h6m6 0h-4a2 2 0 012 2v4m0 6v4a2 2 0 01-2 2h-4m-6 0H5a2 2 0 01-2-2v-4m6-3h.01M15 10h.01M9.5 15a3.5 3.5 0 005 0" />
    </svg>
  ),
  ChevronRight: () => (
    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  Back: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  ),
  Bell: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
};

export default function DormMateApp() {
  const [currentScreen, setCurrentScreen] = useState('S01');
  const [currentUser, setCurrentUser] = useState<{
    studentId: string;
    name: string;
    phone: string;
    email?: string;
    avatar?: string;
    roomNumber?: string;
  } | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- Auth States ---
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [regId, setRegId] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [regError, setRegError] = useState('');

  // --- Room & Booking States (Firestore) ---
  const [roomTab, setRoomTab] = useState<'search' | 'bookings'>('search');
  const [roomFilter, setRoomFilter] = useState('ทั้งหมด');
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [moveInDate, setMoveInDate] = useState('2026-11-01');
  const [occupiedRoomIds, setOccupiedRoomIds] = useState<string[]>([]);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);

  // --- Payment & Slip States (Firestore + Base64) ---
  const [payTab, setPayTab] = useState<'due' | 'history'>('due');
  const [payMethod, setPayMethod] = useState<'qr' | 'bank'>('qr');
  const [billStatus, setBillStatus] = useState<'unpaid' | 'verifying'>('unpaid');
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [slipBase64, setSlipBase64] = useState<string>('');
  const [isUploadingSlip, setIsUploadingSlip] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  // --- Repair States (Firestore Real-time) ---
  const [showRepairForm, setShowRepairForm] = useState(false);
  const [repairCategory, setRepairCategory] = useState('ประปา');
  const [repairDetail, setRepairDetail] = useState('');
  const [isSubmittingRepair, setIsSubmittingRepair] = useState(false);
  const [repairs, setRepairs] = useState<any[]>([
    { id: 'RP-031', title: 'ก๊อกน้ำห้องน้ำรั่ว', date: '3 ต.ค. 2569', status: 'กำลังซ่อม', step: 3, tech: 'ช่างสมศักดิ์' },
    { id: 'RP-028', title: 'หลอดไฟห้องนอนเสีย', date: '15 ก.ย. 2569', status: 'เสร็จสิ้น', step: 4, tech: 'ช่างวิชัย' }
  ]);

  // --- Access Logs States ---
  const [accessLogs, setAccessLogs] = useState<AccessLogItem[]>([]);
  const [logFilter, setLogFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  // --- Profile Edit States (Firestore + Base64) ---
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const roomsData = [
    { id: 'A-204', type: 'ห้องเดี่ยว พัดลม', floor: 'ชั้น 2', size: '18 ตร.ม.', price: '2,800', status: 'ว่าง', amenities: ['เตียง 3.5 ฟุต', 'พัดลมเพดาน', 'Wi-Fi', 'โต๊ะอ่านหนังสือ'] },
    { id: 'B-105', type: 'ห้องคู่ แอร์', floor: 'ชั้น 1', size: '28 ตร.ม.', price: '3,000', status: 'ว่าง', amenities: ['เตียง 2 เตียง', 'เครื่องปรับอากาศ', 'ตู้เสื้อผ้า', 'Wi-Fi'] },
    { id: 'A-315', type: 'ห้องเดี่ยว แอร์', floor: 'ชั้น 3', size: '20 ตร.ม.', price: '4,200', status: 'ว่าง', amenities: ['เตียง 5 ฟุต', 'เครื่องปรับอากาศ', 'เครื่องทำน้ำอุ่น', 'Wi-Fi'] },
  ];

// 0. ดึงประวัติการสแกนหน้าเข้า-ออกแบบ Real-time เฉพาะของนักศึกษาที่ล็อกอินอยู่
  useEffect(() => {
    if (!currentUser?.studentId) {
      setAccessLogs([]);
      return;
    }

    const q = query(
      collection(db, 'access_logs'),
      where('studentId', '==', currentUser.studentId),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: AccessLogItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const rawDir =
            typeof data.direction === 'string'
              ? data.direction.toUpperCase()
              : '';
          return {
            id: docSnap.id,
            studentId: String(data.studentId ?? ''),
            status: String(data.status ?? ''),
            direction:
              rawDir === 'OUT' ? 'OUT' : rawDir === 'IN' ? 'IN' : undefined,
            timestamp: data.timestamp ?? null,
          };
        });

        // เรียงจากเวลาล่าสุดไปเก่าสุด
        list.sort((a, b) => {
          const getMs = (raw: AccessLogItem['timestamp']) => {
            if (raw instanceof Timestamp) return raw.toMillis();
            if (
              raw &&
              typeof raw === 'object' &&
              'seconds' in raw &&
              typeof raw.seconds === 'number'
            ) {
              return raw.seconds * 1000;
            }
            if (raw instanceof Date) return raw.getTime();
            if (typeof raw === 'string' && raw) {
              const ms = new Date(raw).getTime();
              return Number.isNaN(ms) ? 0 : ms;
            }
            return 0;
          };
          return getMs(b.timestamp) - getMs(a.timestamp);
        });

        setAccessLogs(list);
      },
      (error) => {
        console.error('Error loading access_logs:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.studentId]);

  // 1. ดึงข้อมูลโปรไฟล์ล่าสุดจาก Firestore เมื่อล็อกอิน
  useEffect(() => {
    if (!currentUser?.studentId) return;
    const userRef = doc(db, 'users', currentUser.studentId);
    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCurrentUser((prev) =>
          prev
            ? {
                ...prev,
                name: data.name || prev.name,
                phone: data.phone || prev.phone,
                email: data.email || prev.email,
                avatar: data.avatar || prev.avatar,
                roomNumber: data.roomNumber || prev.roomNumber,
              }
            : null
        );
        setEditName(data.name || currentUser.name);
        setEditPhone(data.phone || currentUser.phone);
        setEditEmail(data.email || currentUser.email || '');
        setEditAvatar(data.avatar || '');
      } else {
        setEditName(currentUser.name);
        setEditPhone(currentUser.phone);
        setEditEmail(currentUser.email || '');
      }
    });
    return () => unsubUser();
  }, [currentUser?.studentId]);

  // 2. ดึงรายการแจ้งซ่อมของผู้ใช้จาก Firestore แบบ Real-time
  useEffect(() => {
    if (!currentUser?.studentId) return;
    const q = query(
      collection(db, 'repairs'),
      where('userId', '==', currentUser.studentId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreList = snapshot.docs.map((docItem) => {
        const d = docItem.data();
        return {
          docId: docItem.id,
          id: d.ticketId || docItem.id.slice(0, 6).toUpperCase(),
          title: d.title,
          date: d.dateText || 'วันนี้',
          status: d.status || 'รับเรื่องแล้ว',
          step: d.step || 1,
          tech: d.tech || 'รอจ่ายงานช่าง',
          createdAtMs: d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now(),
        };
      });

      firestoreList.sort((a, b) => b.createdAtMs - a.createdAtMs);

      const defaultRepairs = [
        { id: 'RP-031', title: 'ก๊อกน้ำห้องน้ำรั่ว', date: '3 ต.ค. 2569', status: 'กำลังซ่อม', step: 3, tech: 'ช่างสมศักดิ์' },
        { id: 'RP-028', title: 'หลอดไฟห้องนอนเสีย', date: '15 ก.ย. 2569', status: 'เสร็จสิ้น', step: 4, tech: 'ช่างวิชัย' }
      ];

      setRepairs([...firestoreList, ...defaultRepairs]);
    });

    return () => unsubscribe();
  }, [currentUser?.studentId]);

  // 3. ดึงสถานะห้องที่ถูกจองไปแล้ว + ประวัติการจองของฉันจาก Firestore
  useEffect(() => {
    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const bookedIds = snapshot.docs
        .filter((d) => d.data().status === 'occupied')
        .map((d) => d.id);
      setOccupiedRoomIds(bookedIds);
    });

    if (!currentUser?.studentId) return () => unsubRooms();

    const qBookings = query(
      collection(db, 'bookings'),
      where('userId', '==', currentUser.studentId)
    );
    const unsubBookings = onSnapshot(qBookings, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMyBookings(list);
    });

    const qPayments = query(
      collection(db, 'payments'),
      where('userId', '==', currentUser.studentId)
    );
    const unsubPayments = onSnapshot(qPayments, (snapshot) => {
      const pList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPaymentHistory(pList);
      if (pList.length > 0) {
        setBillStatus('verifying');
      }
    });

    return () => {
      unsubRooms();
      unsubBookings();
      unsubPayments();
    };
  }, [currentUser?.studentId]);

  const availableRooms = roomsData.map((r) => ({
    ...r,
    status: occupiedRoomIds.includes(r.id) ? 'จองแล้ว' : 'ว่าง',
  }));

  const filteredRooms =
    roomFilter === 'ทั้งหมด'
      ? availableRooms
      : availableRooms.filter((r) => r.type === roomFilter);

  const filteredAccessLogs = accessLogs.filter((log) => {
    if (logFilter === 'ALL') return true;
    return log.direction === logFilter;
  });

  // --- ฟังก์ชัน Login เชื่อมต่อ Backend ผ่าน IP 192.168.1.101 ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);
    try {
      const response = await fetch('http://192.168.1.101:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: loginId, password: loginPass }),
      });
      const data = await response.json();
      if (response.ok) {
        setCurrentUser(data.user);
        setCurrentScreen('S04');
        showToast(`ยินดีต้อนรับคุณ ${data.user.name}`);
      } else {
        setLoginError(data.message || 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (err) {
      try {
        const userSnap = await getDoc(doc(db, 'users', loginId));
        if (userSnap.exists() && userSnap.data().password === loginPass) {
          const uData = userSnap.data();
          setCurrentUser({
            studentId: loginId,
            name: uData.name || 'นักศึกษา',
            phone: uData.phone || '',
            email: uData.email || '',
            avatar: uData.avatar || '',
            roomNumber: uData.roomNumber || 'A-312',
          });
          setCurrentScreen('S04');
          showToast(`ยินดีต้อนรับคุณ ${uData.name}`);
        } else {
          setLoginError('รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง');
        }
      } catch {
        setLoginError('ไม่สามารถเชื่อมต่อ Server (Port 5000) ได้');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- ฟังก์ชัน Register เชื่อมต่อ Backend ผ่าน IP 192.168.1.101 ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (regPass !== regConfirmPass) {
      setRegError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('http://192.168.1.101:5000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: regId,
          name: regName,
          phone: regPhone,
          email: regEmail,
          password: regPass,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        showToast('สมัครสมาชิกสำเร็จ บันทึกลง Firebase แล้ว');
        setCurrentScreen('S01');
      } else {
        setRegError(data.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
      }
    } catch (err) {
      try {
        await setDoc(doc(db, 'users', regId), {
          studentId: regId,
          name: regName,
          phone: regPhone,
          email: regEmail,
          password: regPass,
          createdAt: serverTimestamp(),
        });
        showToast('สมัครสมาชิกสำเร็จ บันทึกลง Firestore แล้ว');
        setCurrentScreen('S01');
      } catch {
        setRegError('ไม่สามารถเชื่อมต่อกับ Server (Port 5000) ได้');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- ฟังก์ชันบันทึกการแจ้งซ่อมลง Firestore ---
  const handleSubmitRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repairDetail.trim() || !currentUser) return;
    setIsSubmittingRepair(true);
    try {
      const ticketCode = `RP-${Math.floor(100 + Math.random() * 900)}`;
      await addDoc(collection(db, 'repairs'), {
        userId: currentUser.studentId,
        ticketId: ticketCode,
        title: `${repairCategory}: ${repairDetail.trim()}`,
        category: repairCategory,
        room: currentUser.roomNumber || 'A-312',
        status: 'รับเรื่องแล้ว',
        step: 1,
        tech: 'รอจ่ายงานช่าง',
        dateText: 'วันนี้',
        createdAt: serverTimestamp(),
      });
      setRepairDetail('');
      setShowRepairForm(false);
      showToast('ส่งเรื่องแจ้งซ่อมและบันทึกลงระบบแล้ว');
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการบันทึกแจ้งซ่อม');
    } finally {
      setIsSubmittingRepair(false);
    }
  };

  // --- ฟังก์ชันเลือกรูปสลิป & อัปโหลดลง Firestore (Base64) ---
  const handleSelectSlip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSlipPreview(URL.createObjectURL(file));
    try {
      const base64 = await compressImageToBase64(file, 600, 0.7);
      setSlipBase64(base64);
    } catch {
      showToast('ไม่สามารถอ่านไฟล์รูปภาพได้');
    }
  };

  const handleConfirmSlipUpload = async () => {
    if (!slipBase64 || !currentUser) {
      showToast('กรุณาเลือกรูปสลิปการโอนเงินก่อน');
      return;
    }
    setIsUploadingSlip(true);
    try {
      await addDoc(collection(db, 'payments'), {
        userId: currentUser.studentId,
        billMonth: 'ต.ค. 2569',
        amount: 4200,
        method: payMethod,
        slipBase64,
        status: 'รอตรวจสอบ',
        createdAt: serverTimestamp(),
      });
      setBillStatus('verifying');
      setSlipPreview(null);
      setSlipBase64('');
      showToast('อัปโหลดสลิปสำเร็จ! รอเจ้าหน้าที่ตรวจสอบ');
    } catch {
      showToast('อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setIsUploadingSlip(false);
    }
  };

  // --- ฟังก์ชันจองห้องพักจริงด้วย Firestore Transaction ---
  const handleConfirmBooking = async () => {
    if (!selectedRoom || !currentUser) return;
    setIsBookingSubmitting(true);
    const roomRef = doc(db, 'rooms', selectedRoom.id);
    const bookingRef = doc(collection(db, 'bookings'));
    const userRef = doc(db, 'users', currentUser.studentId);

    try {
      await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (roomDoc.exists() && roomDoc.data().status === 'occupied') {
          throw new Error('ขออภัย ห้องนี้มีผู้จองไปแล้ว');
        }

        transaction.set(
          roomRef,
          {
            roomId: selectedRoom.id,
            type: selectedRoom.type,
            price: selectedRoom.price,
            status: 'occupied',
            bookedBy: currentUser.studentId,
          },
          { merge: true }
        );

        transaction.set(bookingRef, {
          bookingCode: `BK-${Math.floor(1000 + Math.random() * 9000)}`,
          userId: currentUser.studentId,
          roomId: selectedRoom.id,
          roomType: selectedRoom.type,
          price: selectedRoom.price,
          moveInDate,
          status: 'รออนุมัติ',
          createdAt: serverTimestamp(),
        });

        transaction.set(
          userRef,
          { roomNumber: selectedRoom.id },
          { merge: true }
        );
      });

      showToast(`จองห้อง ${selectedRoom.id} สำเร็จ!`);
      setRoomTab('bookings');
      setCurrentScreen('S05');
    } catch (err: any) {
      showToast(err.message || 'ไม่สามารถจองห้องได้');
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  // --- ฟังก์ชันเปลี่ยนรูปโปรไฟล์ & บันทึกข้อมูลโปรไฟล์ ---
  const handleSelectAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImageToBase64(file, 300, 0.65);
      setEditAvatar(base64);
    } catch {
      showToast('ไม่สามารถประมวลผลรูปภาพได้');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingProfile(true);
    try {
      await setDoc(
        doc(db, 'users', currentUser.studentId),
        {
          name: editName,
          phone: editPhone,
          email: editEmail,
          avatar: editAvatar,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              name: editName,
              phone: editPhone,
              email: editEmail,
              avatar: editAvatar,
            }
          : null
      );
      showToast('บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว');
    } catch {
      showToast('บันทึกข้อมูลโปรไฟล์ไม่สำเร็จ');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --- ฟังก์ชันออกจากระบบ ---
  const handleLogout = () => {
    setCurrentUser(null);
    setLoginPass('');
    setCurrentScreen('S01');
    showToast('ออกจากระบบเรียบร้อยแล้ว');
  };

  const isAuthScreen = ['S01', 'S02', 'S03'].includes(currentScreen);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-lg flex items-center space-x-2.5 text-xs font-medium">
          <Icons.CheckCircle />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
        {/* S01: เข้าสู่ระบบ */}
        {currentScreen === 'S01' && (
          <div className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="mb-7 flex items-center space-x-3">
                <div className="w-11 h-11 bg-[#2A62F0] rounded-2xl flex items-center justify-center text-white shadow-sm">
                  <Icons.Home active />
                </div>
                <div>
                  <span className="text-xl font-bold tracking-tight text-slate-900 block leading-none">DormMate</span>
                  <span className="text-[11px] text-slate-400 font-medium">Smart Student Living</span>
                </div>
              </div>

              <h1 className="text-2xl font-bold text-slate-900 mb-1.5">ยินดีต้อนรับกลับมา</h1>
              <p className="text-sm text-slate-500 mb-6">เข้าสู่ระบบด้วยรหัสนักศึกษาเพื่อจัดการหอพักของคุณ</p>

              {loginError && (
                <div className="bg-red-50 text-red-600 text-xs p-3.5 rounded-2xl mb-4 font-medium border border-red-100">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">รหัสนักศึกษา</label>
                  <input
                    type="text"
                    placeholder="เช่น 68028531"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm focus:bg-white focus:outline-none focus:border-[#2A62F0] transition-colors"
                    required
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">รหัสผ่าน</label>
                    <button type="button" onClick={() => setCurrentScreen('S03')} className="text-xs font-medium text-[#2A62F0]">
                      ลืมรหัสผ่าน?
                    </button>
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm focus:bg-white focus:outline-none focus:border-[#2A62F0] transition-colors"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#2A62F0] text-white font-semibold py-3.5 rounded-2xl hover:bg-blue-700 active:scale-[0.98] transition-all mt-2 text-sm"
                >
                  {isLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
                </button>
              </form>
            </div>

            <div className="pt-7 text-center">
              <p className="text-xs text-slate-500">
                ยังไม่มีบัญชีผู้ใช้งาน?{' '}
                <button onClick={() => setCurrentScreen('S02')} className="text-[#2A62F0] font-semibold">
                  สมัครสมาชิก
                </button>
              </p>
            </div>
          </div>
        )}

        {/* S02: สมัครสมาชิก */}
        {currentScreen === 'S02' && (
          <div className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
            <button onClick={() => setCurrentScreen('S01')} className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 mb-4">
              <Icons.Back />
            </button>
            <h1 className="text-xl font-bold text-slate-900 mb-1">สร้างบัญชีใหม่</h1>
            <p className="text-xs text-slate-500 mb-5">กรอกข้อมูลนักศึกษาเพื่อลงทะเบียนเข้าใช้งาน</p>

            {regError && (
              <div className="bg-red-50 text-red-600 text-xs p-3 rounded-2xl mb-4 font-medium border border-red-100">
                {regError}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">รหัสนักศึกษา</label>
                <input type="text" placeholder="เช่น 68115600" value={regId} onChange={(e) => setRegId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm focus:bg-white focus:outline-none focus:border-[#2A62F0]" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อ - นามสกุล</label>
                <input type="text" placeholder="เช่น ศักดิ์ชัย บัวคำ" value={regName} onChange={(e) => setRegName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm focus:bg-white focus:outline-none focus:border-[#2A62F0]" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                <input type="tel" placeholder="08X-XXX-XXXX" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm focus:bg-white focus:outline-none focus:border-[#2A62F0]" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">อีเมล</label>
                <input type="email" placeholder="name@student.ac.th" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm focus:bg-white focus:outline-none focus:border-[#2A62F0]" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">รหัสผ่าน</label>
                  <input type="password" placeholder="••••" value={regPass} onChange={(e) => setRegPass(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm focus:bg-white focus:outline-none focus:border-[#2A62F0]" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ยืนยันรหัสผ่าน</label>
                  <input type="password" placeholder="••••" value={regConfirmPass} onChange={(e) => setRegConfirmPass(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm focus:bg-white focus:outline-none focus:border-[#2A62F0]" required />
                </div>
              </div>
              <button type="submit" disabled={isLoading} className="w-full bg-[#2A62F0] text-white font-semibold py-3.5 rounded-2xl hover:bg-blue-700 active:scale-[0.98] transition-all mt-3 text-sm">
                {isLoading ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันการสมัคร'}
              </button>
            </form>
          </div>
        )}

        {/* S03: ลืมรหัสผ่าน */}
        {currentScreen === 'S03' && (
          <div className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
            <button onClick={() => setCurrentScreen('S01')} className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 mb-4">
              <Icons.Back />
            </button>
            <h1 className="text-xl font-bold text-slate-900 mb-1">ลืมรหัสผ่าน?</h1>
            <p className="text-xs text-slate-500 mb-6">กรอกอีเมลที่ลงทะเบียนไว้เพื่อรับรหัสยืนยันตั้งรหัสผ่านใหม่</p>
            <form onSubmit={(e) => { e.preventDefault(); showToast('ส่งรหัส OTP ไปที่อีเมลของคุณแล้ว'); setCurrentScreen('S01'); }} className="space-y-4">
              <input type="email" placeholder="example@student.ac.th" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm focus:bg-white focus:outline-none focus:border-[#2A62F0]" required />
              <button type="submit" className="w-full bg-[#2A62F0] text-white font-semibold py-3.5 rounded-2xl text-sm">ส่งรหัสยืนยัน</button>
            </form>
          </div>
        )}

        {/* S04: หน้าหลัก (HOME) */}
        {currentScreen === 'S04' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center pt-1">
              <div className="flex items-center space-x-3">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                ) : null}
                <div>
                  <p className="text-xs text-slate-400 font-medium">ยินดีต้อนรับกลับมา</p>
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">สวัสดี, {currentUser?.name || 'ศักดิ์ชัย'}</h1>
                </div>
              </div>
              <button onClick={() => showToast('ไม่มีการแจ้งเตือนใหม่')} className="w-10 h-10 rounded-full bg-white border border-slate-200/70 flex items-center justify-center text-slate-600 relative active:scale-95 transition-transform">
                <Icons.Bell />
                <span className="w-2 h-2 bg-red-500 rounded-full absolute top-2.5 right-2.5"></span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Hero Card */}
              <div className="bg-[#2A62F0] rounded-[24px] p-5 text-white relative overflow-hidden">
                <div className="flex justify-between items-center relative z-10">
                  <div className="space-y-1.5">
                    <span className="inline-block text-[11px] bg-white/15 backdrop-blur-sm px-2.5 py-0.5 rounded-full font-medium">
                      ห้องพักปัจจุบัน
                    </span>
                    <h2 className="text-xl font-bold tracking-tight">ห้องเดี่ยว แอร์</h2>
                    <p className="text-xs text-blue-100">อาคาร A · ชั้น 3</p>
                    <div className="pt-2 flex items-center space-x-2">
                      <span className="bg-emerald-400/20 text-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-semibold">เข้าพักแล้ว</span>
                      <span className="text-[11px] text-blue-200">เข้าพัก 1 ต.ค. 69</span>
                    </div>
                  </div>

                  <div className="bg-[#FFC93C] text-slate-900 w-20 h-28 rounded-2xl p-2.5 flex flex-col justify-between items-center shadow-md transform rotate-3">
                    <div className="w-2.5 h-2.5 bg-[#2A62F0] rounded-full"></div>
                    <div className="text-center">
                      <span className="block font-extrabold text-base leading-none">{currentUser?.roomNumber || 'A-312'}</span>
                      <span className="text-[9px] font-semibold text-slate-700 mt-1 block">ห้องของฉัน</span>
                    </div>
                    <div className="w-6 h-1 bg-slate-900/15 rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Alert Strip */}
              <div className="bg-white p-5 rounded-[24px] border border-slate-200/70 flex justify-between items-center">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-800">ค่าเช่า ต.ค. 2569</span>
                    {billStatus === 'verifying' && (
                      <span className="bg-amber-50 text-amber-600 text-[10px] px-2 py-0.5 rounded-full font-semibold">รอตรวจสอบ</span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-slate-900">4,200 <span className="text-xs font-normal text-slate-500">บาท</span></p>
                  <p className="text-[11px] text-rose-500 font-medium">ครบกำหนด 10 ต.ค. 2569</p>
                </div>
                <button
                  onClick={() => setCurrentScreen('S08')}
                  className="bg-[#2A62F0] text-white px-4 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
                >
                  {billStatus === 'unpaid' ? 'ชำระเลย' : 'ดูรายการ'}
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-1">เมนูลัด</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button onClick={() => setCurrentScreen('S05')} className="bg-white p-3.5 rounded-[20px] border border-slate-200/70 flex flex-col items-center justify-center space-y-1.5 active:scale-95 transition-transform">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2A62F0] flex items-center justify-center">
                    <Icons.Door />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">จองห้อง</span>
                </button>

                <button onClick={() => setCurrentScreen('S08')} className="bg-white p-3.5 rounded-[20px] border border-slate-200/70 flex flex-col items-center justify-center space-y-1.5 active:scale-95 transition-transform">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Icons.Wallet />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">ชำระเงิน</span>
                </button>

                <button onClick={() => setCurrentScreen('S10')} className="bg-white p-3.5 rounded-[20px] border border-slate-200/70 flex flex-col items-center justify-center space-y-1.5 active:scale-95 transition-transform">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Icons.Wrench />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">แจ้งซ่อม</span>
                </button>

                <button onClick={() => setCurrentScreen('S13')} className="bg-white p-3.5 rounded-[20px] border border-slate-200/70 flex flex-col items-center justify-center space-y-1.5 active:scale-95 transition-transform">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Icons.ScanFace />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">เวลาเข้า-ออก</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* งานซ่อมล่าสุด */}
              <div className="bg-white p-4 rounded-[20px] border border-slate-200/70 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">งานซ่อมล่าสุด</span>
                  <button onClick={() => setCurrentScreen('S10')} className="text-xs text-[#2A62F0] font-medium">ทั้งหมด</button>
                </div>
                {repairs[0] && (
                  <>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{repairs[0].title}</p>
                        <p className="text-[11px] text-slate-400">ผู้รับผิดชอบ: {repairs[0].tech}</p>
                      </div>
                      <span className="bg-amber-50 text-amber-600 border border-amber-200/60 text-[10px] px-2.5 py-1 rounded-full font-semibold">
                        {repairs[0].status}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {[1, 2, 3, 4].map((s) => (
                        <div key={s} className={`h-1.5 rounded-full ${s <= repairs[0].step ? 'bg-[#2A62F0]' : 'bg-slate-100'}`}></div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* ประวัติเวลาเข้า-ออก */}
              <div onClick={() => setCurrentScreen('S13')} className="bg-white p-4 rounded-[20px] border border-slate-200/70 flex justify-between items-center cursor-pointer active:bg-slate-50">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Icons.ScanFace />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-slate-900">ประวัติเวลาเข้า-ออก</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-600">
                        อัตโนมัติ
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">ดูบันทึกวันและเวลาสแกนใบหน้าเข้า-ออกหอพัก</p>
                  </div>
                </div>
                <Icons.ChevronRight />
              </div>
            </div>
          </div>
        )}

        {/* S05 & S07: จองห้อง */}
        {currentScreen === 'S05' && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-slate-900">ห้องพัก</h1>

            <div className="bg-slate-200/60 p-1 rounded-2xl flex max-w-md">
              <button
                onClick={() => setRoomTab('search')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${roomTab === 'search' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                ค้นหาห้องว่าง
              </button>
              <button
                onClick={() => setRoomTab('bookings')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${roomTab === 'bookings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                การจองของฉัน ({myBookings.length + 1})
              </button>
            </div>

            {roomTab === 'search' ? (
              <>
                <div className="flex space-x-2 overflow-x-auto py-1">
                  {['ทั้งหมด', 'ห้องเดี่ยว พัดลม', 'ห้องเดี่ยว แอร์', 'ห้องคู่ แอร์'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setRoomFilter(type)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${roomFilter === type ? 'bg-[#2A62F0] text-white' : 'bg-white text-slate-600 border border-slate-200/80'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-slate-400 font-medium">พบ {filteredRooms.filter(r => r.status === 'ว่าง').length} ห้องว่าง</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredRooms.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => {
                        setSelectedRoom(room);
                        setCurrentScreen('S06');
                      }}
                      className="bg-white p-4 rounded-[20px] border border-slate-200/70 flex justify-between items-center cursor-pointer active:scale-[0.99] transition-transform"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-base text-slate-900">{room.id}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              room.status === 'ว่าง'
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {room.status}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-600">{room.type}</p>
                        <p className="text-[11px] text-slate-400">{room.floor} · {room.size}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-[#2A62F0]">{room.price}</p>
                        <p className="text-[10px] text-slate-400">บาท/เดือน</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {myBookings.map((bk) => (
                  <div key={bk.id} className="bg-white p-4 rounded-[20px] border border-slate-200/70 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs font-semibold text-slate-400">{bk.bookingCode}</span>
                      <span className="bg-emerald-50 text-emerald-600 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">
                        {bk.status || 'จองสำเร็จ'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{bk.roomId} · {bk.roomType}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">วันที่แจ้งเข้าพัก: {bk.moveInDate}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400">
                      <span>บันทึกการจองลงระบบเรียบร้อยแล้ว</span>
                    </div>
                  </div>
                ))}

                <div className="bg-white p-4 rounded-[20px] border border-slate-200/70 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs font-semibold text-slate-400">BK-0022</span>
                    <span className="bg-amber-50 text-amber-600 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">รออนุมัติ</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">B-105 · ห้องคู่ แอร์</h3>
                    <p className="text-xs text-slate-500 mt-0.5">วันที่แจ้งเข้าพัก: 1 พ.ย. 2569</p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400">
                    <span>ส่งคำขอแล้ว → รอเจ้าของหอพักตรวจสอบ</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* S06: รายละเอียดห้อง & กดจองจริง */}
        {currentScreen === 'S06' && selectedRoom && (
          <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200/80 flex flex-col justify-between p-6">
            <div className="space-y-4">
              <button onClick={() => setCurrentScreen('S05')} className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-600">
                <Icons.Back />
              </button>
              <div className="bg-blue-50/70 rounded-3xl p-5 flex justify-between items-center border border-blue-100">
                <div>
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${selectedRoom.status === 'ว่าง' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {selectedRoom.status}
                  </span>
                  <h1 className="text-2xl font-bold text-slate-900 mt-1.5">ห้อง {selectedRoom.id}</h1>
                  <p className="text-xs text-slate-600">{selectedRoom.type} · {selectedRoom.floor} ({selectedRoom.size})</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-[#2A62F0]">{selectedRoom.price}</span>
                  <span className="block text-[11px] text-slate-500">บาท/เดือน</span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-800 mb-2">สิ่งอำนวยความสะดวก</h3>
                <div className="grid grid-cols-2 gap-2">
                  {selectedRoom.amenities.map((item: string) => (
                    <div key={item} className="bg-slate-50 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 border border-slate-100">
                      • {item}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">วันที่ต้องการเข้าพัก</label>
                <input
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleConfirmBooking}
              disabled={selectedRoom.status !== 'ว่าง' || isBookingSubmitting}
              className="w-full bg-[#2A62F0] text-white font-semibold py-3.5 rounded-2xl text-sm mt-6 disabled:opacity-50"
            >
              {selectedRoom.status !== 'ว่าง'
                ? 'ห้องนี้ถูกจองไปแล้ว'
                : isBookingSubmitting
                ? 'กำลังดำเนินการจอง...'
                : 'ยืนยันการจองห้องนี้'}
            </button>
          </div>
        )}

        {/* S08: ชำระเงิน & แนบสลิปรูปภาพ (Base64 -> Firestore) */}
        {currentScreen === 'S08' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <h1 className="text-xl font-bold text-slate-900">ชำระเงิน & แนบสลิป</h1>

            <div className="bg-slate-200/60 p-1 rounded-2xl flex">
              <button
                onClick={() => setPayTab('due')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${payTab === 'due' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                รายการค้างชำระ
              </button>
              <button
                onClick={() => setPayTab('history')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${payTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                ประวัติการส่งสลิป ({paymentHistory.length})
              </button>
            </div>

            {payTab === 'due' ? (
              <div className="bg-white p-5 rounded-[24px] border border-slate-200/70 space-y-4">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3.5">
                  <div>
                    <span className="text-xs font-bold text-slate-900">ค่าเช่าประจำเดือน ต.ค. 2569</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">ห้อง {currentUser?.roomNumber || 'A-312'} · ครบกำหนด 10 ต.ค. 69</p>
                  </div>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${billStatus === 'verifying' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                    {billStatus === 'verifying' ? 'รอตรวจสอบ' : 'ค้างชำระ'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">ยอดรวมสุทธิ</span>
                  <span className="text-2xl font-extrabold text-[#2A62F0]">4,200 <span className="text-xs font-normal text-slate-500">บาท</span></span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayMethod('qr')}
                    className={`py-2.5 rounded-xl text-xs font-semibold border ${payMethod === 'qr' ? 'bg-blue-50 border-[#2A62F0] text-[#2A62F0]' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    PromptPay QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMethod('bank')}
                    className={`py-2.5 rounded-xl text-xs font-semibold border ${payMethod === 'bank' ? 'bg-blue-50 border-[#2A62F0] text-[#2A62F0]' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    โอนผ่านบัญชีธนาคาร
                  </button>
                </div>

                {payMethod === 'bank' && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl text-xs space-y-1 border border-slate-100">
                    <p className="font-semibold text-slate-800">ธนาคารกสิกรไทย (KBank)</p>
                    <p className="text-slate-600 font-mono">123-4-56789-0 · หอพัก DormMate</p>
                  </div>
                )}

                <div className="space-y-2.5 pt-1">
                  <label className="block text-xs font-bold text-slate-800">แนบสลิปหลักฐานการโอนเงิน</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSelectSlip}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#2A62F0]"
                  />
                  {slipPreview && (
                    <div className="pt-2 flex flex-col items-center space-y-3">
                      <img src={slipPreview} alt="Slip preview" className="max-h-60 rounded-2xl border border-slate-200 object-contain" />
                      <button
                        type="button"
                        onClick={handleConfirmSlipUpload}
                        disabled={isUploadingSlip}
                        className="w-full bg-[#2A62F0] text-white font-semibold py-3 rounded-2xl text-xs"
                      >
                        {isUploadingSlip ? 'กำลังอัปโหลดสลิป...' : 'ยืนยันส่งสลิปชำระเงิน'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentHistory.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/70 text-center text-xs text-slate-400">
                    ยังไม่มีประวัติการส่งสลิป
                  </div>
                ) : (
                  paymentHistory.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-200/70 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-slate-900">บิล {item.billMonth || 'ต.ค. 2569'}</p>
                        <p className="text-xs text-slate-500">ยอด {item.amount || 4200} บาท</p>
                      </div>
                      <span className="bg-amber-50 text-amber-600 text-[10px] px-2.5 py-1 rounded-full font-semibold">
                        {item.status || 'รอตรวจสอบ'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* S10: แจ้งซ่อม */}
        {currentScreen === 'S10' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-bold text-slate-900">แจ้งซ่อมบำรุง</h1>
              <button
                onClick={() => setShowRepairForm(!showRepairForm)}
                className="bg-[#2A62F0] text-white px-4 py-2 rounded-xl text-xs font-semibold"
              >
                {showRepairForm ? 'ปิดฟอร์ม' : '+ แจ้งซ่อมใหม่'}
              </button>
            </div>

            {showRepairForm && (
              <form onSubmit={handleSubmitRepair} className="bg-white p-4 rounded-2xl border border-slate-200/70 space-y-3 max-w-xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">หมวดหมู่</label>
                  <select
                    value={repairCategory}
                    onChange={(e) => setRepairCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="ประปา">ประปา</option>
                    <option value="ไฟฟ้า">ไฟฟ้า</option>
                    <option value="แอร์">แอร์</option>
                    <option value="เฟอร์นิเจอร์">เฟอร์นิเจอร์</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">รายละเอียดอาการ</label>
                  <input
                    type="text"
                    placeholder="เช่น ปลั๊กไฟห้องนอนหลวม"
                    value={repairDetail}
                    onChange={(e) => setRepairDetail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingRepair}
                  className="bg-[#2A62F0] text-white px-4 py-2.5 rounded-xl text-xs font-semibold"
                >
                  {isSubmittingRepair ? 'กำลังส่ง...' : 'ส่งเรื่องแจ้งซ่อม'}
                </button>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {repairs.map((rp) => (
                <div key={rp.id} className="bg-white p-4 rounded-2xl border border-slate-200/70 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs text-slate-400">{rp.id} · {rp.date}</span>
                    <span className="bg-blue-50 text-[#2A62F0] text-[10px] px-2.5 py-0.5 rounded-full font-semibold">
                      {rp.status}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{rp.title}</p>
                  <p className="text-xs text-slate-500">ผู้รับผิดชอบ: {rp.tech}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* S13: หน้าประวัติการบันทึกเวลาวันเข้า-ออก (ไม่มีระบบลงทะเบียนใบหน้า) */}
        {currentScreen === 'S13' && (
          <div className="max-w-xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setCurrentScreen('S04')}
                  className="w-9 h-9 rounded-full bg-white border border-slate-200/80 flex items-center justify-center text-slate-600"
                >
                  <Icons.Back />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">ประวัติเวลาเข้า-ออกหอพัก</h1>
                  <p className="text-xs text-slate-500">บันทึกวันและเวลาอัตโนมัติจากการสแกนใบหน้าผ่านบอร์ด</p>
                </div>
              </div>
              <span className="bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-3 py-1 rounded-full">
                {accessLogs.length} รายการ
              </span>
            </div>

            {/* ตัวกรองดูทั้งหมด / เฉพาะเข้า / เฉพาะออก */}
            <div className="bg-slate-200/60 p-1 rounded-2xl flex">
              <button
                type="button"
                onClick={() => setLogFilter('ALL')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  logFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                ทั้งหมด ({accessLogs.length})
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('IN')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  logFilter === 'IN' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                เข้า ({accessLogs.filter((l) => l.direction === 'IN').length})
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('OUT')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  logFilter === 'OUT' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                ออก ({accessLogs.filter((l) => l.direction === 'OUT').length})
              </button>
            </div>

            {/* รายการวันและเวลาเข้า-ออกที่บอร์ดส่งขึ้น Firestore */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
              {filteredAccessLogs.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  ยังไม่มีบันทึกเวลาเข้า-ออกในหมวดนี้
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filteredAccessLogs.map((log) => {
                    const { dateText, timeText } = formatAccessLogDateTime(
                      log.timestamp
                    );
                    const dirLabel =
                      log.direction === 'IN'
                        ? 'เข้า'
                        : log.direction === 'OUT'
                        ? 'ออก'
                        : 'บันทึกสแกน';

                    return (
                      <li
                        key={log.id}
                        className="flex items-center justify-between gap-2 py-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex min-w-[46px] justify-center rounded-full px-2.5 py-0.5 font-semibold ${
                                log.direction === 'OUT'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              }`}
                            >
                              {dirLabel}
                            </span>
                            <span className="font-bold text-slate-900">
                              รหัสนักศึกษา: {log.studentId || '-'}
                            </span>
                          </div>
                          <p className="text-slate-500">
                            สถานะ: {log.status || 'success'}
                          </p>
                        </div>

                        <div className="text-right font-medium text-slate-700">
                          <div className="text-sm font-bold text-slate-900">{timeText}</div>
                          <div className="text-slate-500">{dateText}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* S14: โปรไฟล์ */}
        {currentScreen === 'S14' && (
          <div className="max-w-xl mx-auto space-y-4">
            <form onSubmit={handleSaveProfile} className="bg-white p-6 rounded-3xl border border-slate-200/80 space-y-4">
              <h1 className="text-xl font-bold text-slate-900">ข้อมูลส่วนตัว</h1>
              <div className="flex items-center space-x-4">
                {editAvatar ? (
                  <img src={editAvatar} alt="Profile" className="w-16 h-16 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <Icons.User />
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleSelectAvatar} className="text-xs text-slate-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อ - นามสกุล</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">อีเมล</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>
              <button type="submit" disabled={isSavingProfile} className="w-full bg-[#2A62F0] text-white font-semibold py-3 rounded-2xl text-sm">
                {isSavingProfile ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </form>

            <div className="bg-white p-4 rounded-3xl border border-slate-200/80">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full bg-rose-50 text-rose-600 border border-rose-200/80 font-semibold py-3 rounded-2xl text-sm hover:bg-rose-100 transition-colors"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar (แสดงเมื่อล็อกอินแล้ว) */}
      {!isAuthScreen && (
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 flex justify-around items-center z-40">
          <button onClick={() => setCurrentScreen('S04')} className={`flex flex-col items-center space-y-1 ${currentScreen === 'S04' ? 'text-[#2A62F0]' : 'text-slate-400'}`}>
            <Icons.Home active={currentScreen === 'S04'} />
            <span className="text-[10px] font-semibold">หน้าหลัก</span>
          </button>
          <button onClick={() => setCurrentScreen('S05')} className={`flex flex-col items-center space-y-1 ${['S05', 'S06'].includes(currentScreen) ? 'text-[#2A62F0]' : 'text-slate-400'}`}>
            <Icons.Door active={['S05', 'S06'].includes(currentScreen)} />
            <span className="text-[10px] font-semibold">จองห้อง</span>
          </button>
          <button onClick={() => setCurrentScreen('S08')} className={`flex flex-col items-center space-y-1 ${currentScreen === 'S08' ? 'text-[#2A62F0]' : 'text-slate-400'}`}>
            <Icons.Wallet active={currentScreen === 'S08'} />
            <span className="text-[10px] font-semibold">ชำระเงิน</span>
          </button>
          <button onClick={() => setCurrentScreen('S10')} className={`flex flex-col items-center space-y-1 ${currentScreen === 'S10' ? 'text-[#2A62F0]' : 'text-slate-400'}`}>
            <Icons.Wrench active={currentScreen === 'S10'} />
            <span className="text-[10px] font-semibold">แจ้งซ่อม</span>
          </button>
          <button onClick={() => setCurrentScreen('S14')} className={`flex flex-col items-center space-y-1 ${currentScreen === 'S14' ? 'text-[#2A62F0]' : 'text-slate-400'}`}>
            <Icons.User active={currentScreen === 'S14'} />
            <span className="text-[10px] font-semibold">โปรไฟล์</span>
          </button>
        </div>
      )}
    </div>
  );
}