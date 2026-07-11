# chutcenter

คลังโจทย์ข้อสอบแข่งขันคณิตศาสตร์ — เลือกเรื่อง/แหล่งที่มา/ช่วงปี แล้วสร้างเป็นชุดข้อสอบ **PDF จริง
ที่ compile ในเบราว์เซอร์** ผ่าน [typst.ts](https://github.com/Myriad-Dreamin/typst.ts) — ไม่มีเซิร์ฟเวอร์
ไม่ต้องอัปโหลด ฟอนต์ฝังในไฟล์ (TH Sarabun New + STIX Two Math) ใช้ได้ฟรี บนมือถือก็ได้

**เว็บจริง:** https://zenithjuno.github.io/chutcenter/

## ใช้งาน

เปิดเว็บ → เลือก **เรื่อง** / **แหล่งที่มา** / **ช่วงปี พ.ศ.** → ระบบบอก "พบ N ข้อ" →
กด **สร้างชุดข้อสอบ** → ได้ PDF (โจทย์ + ที่ว่างทด + เฉลย) เปิดดูในหน้าเว็บและดาวน์โหลดได้เลย
ครั้งแรกดาวน์โหลดตัวสร้าง ~28MB ครั้งเดียว จากนั้นเบราว์เซอร์จำไว้ เปิดครั้งต่อไปเร็ว

## รันในเครื่อง (สำหรับผู้พัฒนา)

```sh
npm install
npm run dev      # เปิดที่ http://localhost:5187/chutcenter/
npm run build    # สร้าง dist/ สำหรับ deploy
```

## โครงสร้าง

- static site ล้วน ไม่มี backend — WASM compiler + ฟอนต์เสิร์ฟเป็น static asset (ทำงาน offline ได้)
- deploy = GitHub Pages ผ่าน Actions (auto-deploy ทุก push ขึ้น `main`)
- ข้อมูลโจทย์ (L2) + ตัวสร้างเอกสาร sync มาจาก monorepo ต้นทาง — อัปเดตด้วยสคริปต์คำสั่งเดียว
  (ผู้ดูแลดูคู่มือที่ `docs/RUNBOOK-chutcenter-web.md` ใน monorepo)
