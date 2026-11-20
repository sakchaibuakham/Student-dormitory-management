const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// ค้นหาไฟล์ serviceAccountKey.json จากโฟลเดอร์นอกสุดที่ย้ายไปไว้ หรือในโฟลเดอร์ server
const candidatePaths = [
  path.join(__dirname, '..', 'serviceAccountKey.json'),
  path.join(__dirname, 'serviceAccountKey.json'),
];

const keyPath = candidatePaths.find((p) => fs.existsSync(p));

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else if (keyPath) {
  const serviceAccount = require(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('Loaded Firebase key from:', keyPath);
} else {
  console.warn('Warning: serviceAccountKey.json not found. Using default credentials.');
  admin.initializeApp();
}

const db = admin.firestore();

// API สำหรับสมัครสมาชิก
app.post('/api/register', async (req, res) => {
  try {
    const { studentId, name, phone, email, password } = req.body;
    if (!studentId || !name || !password) {
      return res.status(400).json({ status: 'error', message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    const userRef = db.collection('users').doc(studentId);
    const docSnap = await userRef.get();

    if (docSnap.exists) {
      return res.status(400).json({ status: 'error', message: 'รหัสนักศึกษานี้ถูกลงทะเบียนไปแล้ว' });
    }

    await userRef.set({
      studentId,
      name,
      phone: phone || '',
      email: email || '',
      password,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({ status: 'success', message: 'สมัครสมาชิกสำเร็จ' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ status: 'error', message: 'Database error' });
  }
});

// API สำหรับเข้าสู่ระบบ
app.post('/api/login', async (req, res) => {
  try {
    const { studentId, password } = req.body;
    if (!studentId || !password) {
      return res.status(400).json({ status: 'error', message: 'กรุณากรอกรหัสนักศึกษาและรหัสผ่าน' });
    }

    const userDoc = await db.collection('users').doc(studentId).get();
    if (!userDoc.exists) {
      return res.status(401).json({ status: 'error', message: 'ไม่พบรหัสนักศึกษานี้ในระบบ' });
    }

    const userData = userDoc.data();
    if (userData.password !== password) {
      return res.status(401).json({ status: 'error', message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    res.json({
      status: 'success',
      message: 'เข้าสู่ระบบสำเร็จ',
      user: {
        studentId: userData.studentId,
        name: userData.name,
        phone: userData.phone,
        email: userData.email || '',
      },
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ status: 'error', message: 'Database error' });
  }
});

app.listen(5000, () => {
  console.log('Server running on port 5000');
});