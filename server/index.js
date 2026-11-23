const express = require('express');
const cors = require('cors');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// ค้นหาไฟล์ serviceAccountKey.json จากโฟลเดอร์นอกสุด หรือในโฟลเดอร์ server
const candidatePaths = [
  path.join(__dirname, '..', 'serviceAccountKey.json'),
  path.join(__dirname, 'serviceAccountKey.json'),
];

const keyPath = candidatePaths.find((p) => fs.existsSync(p));

if (!getApps().length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else if (keyPath) {
    const serviceAccount = require(keyPath);
    initializeApp({
      credential: cert(serviceAccount),
    });
    console.log('Loaded Firebase key from:', keyPath);
  } else {
    console.warn('Warning: serviceAccountKey.json not found. Using default credentials.');
    initializeApp();
  }
}

const db = getFirestore();

// ทดสอบสถานะ Server
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'DormMate Server is running' });
});

// API เข้าสู่ระบบ
app.post('/api/login', async (req, res) => {
  try {
    const { studentId, password } = req.body;
    if (!studentId || !password) {
      return res.status(400).json({ message: 'กรุณากรอกรหัสนักศึกษาและรหัสผ่าน' });
    }

    const userDoc = await db.collection('users').doc(studentId).get();
    if (!userDoc.exists) {
      return res.status(401).json({ message: 'ไม่พบรหัสนักศึกษานี้ในระบบ' });
    }

    const userData = userDoc.data();
    if (userData.password !== password) {
      return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    return res.json({
      message: 'เข้าสู่ระบบสำเร็จ',
      user: {
        studentId,
        name: userData.name || 'นักศึกษา',
        phone: userData.phone || '',
        email: userData.email || '',
        avatar: userData.avatar || '',
        roomNumber: userData.roomNumber || 'A-312',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดที่ Server' });
  }
});

// API สมัครสมาชิก
app.post('/api/register', async (req, res) => {
  try {
    const { studentId, name, phone, email, password } = req.body;
    if (!studentId || !name || !password) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    const userRef = db.collection('users').doc(studentId);
    const existing = await userRef.get();
    if (existing.exists) {
      return res.status(409).json({ message: 'รหัสนักศึกษานี้ถูกลงทะเบียนแล้ว' });
    }

    await userRef.set({
      studentId,
      name,
      phone: phone || '',
      email: email || '',
      password,
      roomNumber: 'A-312',
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ' });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});