# คลังอัลบั้มรูป — เซิร์ฟเวอร์ Node.js ตัวเดียว

เว็บแอปเก็บรูปเป็นอัลบั้ม มีฐานข้อมูลเซิร์ฟเวอร์ คนอื่นเปิดลิงก์เดียวกันจะเห็นอัลบั้มที่อัปโหลดทันที
**เว็บ + ฐานข้อมูลอยู่เซิร์ฟเวอร์เดียวกัน ไม่แยกกัน ไม่ต้องติดตั้ง dependency ใดๆ** (ใช้โมดูลในตัวของ Node.js)

## รันบนคอมพิวเตอร์

```bash
node server.js
```

แล้วเปิด http://localhost:3000
(เปลี่ยนพอร์ตได้ด้วย `PORT=8080 node server.js`)

- รหัสผู้ดูแลเริ่มต้น: `admin123` (เข้าสู่ระบบแล้วเปลี่ยนได้ทันที)
- ผู้ดูแล: สร้างอัลบั้ม อัปโหลดรูป แก้ไข/ลบ
- ผู้ชมทั่วไป: ดูอัลบั้ม ค้นหาชื่ออัลบั้ม ดาวน์โหลดรูปทีละใบหรือทั้งหมดเป็น ZIP

## โครงสร้างไฟล์

```
album-server/
├── server.js        # เซิร์ฟเวอร์ (ให้บริการเว็บ + API + จัดเก็บ)
├── package.json
├── public/
│   └── index.html   # หน้าเว็บ (เรียก API ผ่าน fetch)
├── data/            # สร้างอัตโนมัติ — albums.json + config.json (รหัสผู้ดูแลแฮช)
└── uploads/         # สร้างอัตโนมัติ — ไฟล์รูปภาพจริง
```

**สำรองข้อมูล**: แค่คัดลอกโฟลเดอร์ `data/` และ `uploads/` ไปเก็บไว้

## Deploy ขึ้นอินเทอร์เน็ต (ให้คนอื่นเข้าถึงได้)

### วิธีที่ 1: Glitch (ฟรี, ง่ายที่สุด, ไม่ต้องใช้ CLI)
1. ไป https://glitch.com สร้าง account ฟรี
2. กด **New Project → Import from GitHub** หรือสร้างโปรเจกต์เปล่า แล้วอัปโหลดไฟล์ `server.js`, `package.json`, และ `public/index.html` (ใส่ในโฟลเดอร์ public)
3. Glitch จะรันอัตโนมัติ ได้ลิงก์ `https://<ชื่อโปรเจกต์>.glitch.me` แชร์ให้คนอื่นได้เลย

### วิธีที่ 2: Render.com (ฟรี tier)
1. อัปโหลดโฟลเดอร์นี้ขึ้น GitHub repository
2. ไป https://render.com → New → Web Service → เชื่อมต่อ repo
3. Build Command: ไม่ต้องใส่ (ว่าง) / Start Command: `node server.js`
4. ได้ลิงก์ `https://<ชื่อ>.onrender.com`

### วิธีที่ 3: VPS / โฮสติ้งใดๆ ที่รัน Node.js ได้
```bash
# ติดตั้ง Node.js 14+ แล้ว
node server.js
# แนะนำให้รันด้วย pm2 เพื่อให้ทำงานตลอด:
npm install -g pm2 && pm2 start server.js --name album
```

## API (สำหรับนักพัฒนา)

| Method | Path | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| GET | `/api/albums` | สาธารณะ | รายการอัลบั้มทั้งหมด |
| GET | `/api/albums/:id` | สาธารณะ | รายละเอียดอัลบั้ม + รูปทั้งหมด |
| POST | `/api/admin/login` | — | ตรวจสอบรหัสผู้ดูแล |
| POST | `/api/admin/passcode` | ผู้ดูแล | เปลี่ยนรหัสผู้ดูแล |
| POST | `/api/albums` | ผู้ดูแล | สร้างอัลบั้ม |
| DELETE | `/api/albums/:id` | ผู้ดูแล | ลบอัลบั้ม |
| POST | `/api/albums/:id/images` | ผู้ดูแล | อัปโหลดรูป (base64) |
| PATCH | `/api/albums/:id/images/:imgId` | ผู้ดูแล | แก้ไขคำอธิบายรูป |
| DELETE | `/api/albums/:id/images/:imgId` | ผู้ดูแล | ลบรูป |
| GET | `/uploads/<file>` | สาธารณะ | ไฟล์รูปภาพ |

การยืนยันตัวตนผู้ดูแล: ส่ง `passcode` ใน body ของ request ที่ต้องการสิทธิ์
