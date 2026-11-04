# 🎓 Diyorbek Alikuziev CRM — O'quvchilar Boshqaruv Tizimi (v4.0)

Serverga o'rnatishga va xavfsiz foydalanishga to'liq tayyorlangan professional CRM tizimi.

---

## 🔐 Xavfsizlik va Kirish Huquqlari (RBAC)

Tizim serverda ommaviy ishlashi uchun **2 xil kirish darajasi (Rol)** bilan himoyalangan:

### 1. 👥 Oddiy Begona Odamlar (Mehmonlar / Read-Only):
- Barcha o'quvchilar ro'yxatini, telefonlarini, guruhlarini bemalol **ko'ra oladi**.
- Ikkala filialni (Yangiqo'rg'on va Uchko'prik) va oylar tarixini (Oktyabr 100%, Noyabr) to'liq ko'radi.
- Statistika, moliyaviy hisobotlar, qidiruv va filtrlarni ishlatishi mumkin.
- Excel formatida yuklab olish va chop etish mumkin.
- **LEKIN BIRORTA MA'LUMOTNI O'ZGARTIRA OLMAYDI:**
  * To'lov qilish ("To'landi" tugmasi) mehmonlarga ko'rinmaydi va bloklangan;
  * Yangi o'quvchi qo'shish va o'chirish tugmalari yashirilgan;
  * Yangi oy boshlash tugmasi yashirilgan;
  * Backend API darajasida ham tokenni tekshiradi — hatto tashqaridan so'rov yuborilsa ham server ruxsat bermaydi (`403 Forbidden`).

### 2. 👑 Administrator (Diyorbek Alikuziev / Full Access):
- Barcha ma'lumotlarni tahrirlash, yangi o'quvchi qo'shish va o'chirish;
- Bir klikda to'lovlarni qabul qilish yoki bekor qilish;
- Har oy yangi toza daftarni boshlash;
- Ommaviy o'chirish (bir nechta o'quvchini belgilab o'chirish).

**Admin hisob ma'lumotlari:**
- **Login:** `dalikuziev`
- **Parol:** `Dyrbk41Aiuie)`

---

## 🎨 Dizayn va Tashqi Ko'rinish:
- **Python logotipi**: Chap yuqori burchakda Python dasturlash tilining rasmiy ko'k va sariq SVG logotipi joylashtirilgan.
- **Yuqori o'ng burchak**: Tizim egasi **Diyorbek Alikuziev** nomi va Login / Logout tugmasi joylashtirilgan.
- **Ranglar palitrasi**: Korporativ Oq, Ko'k (Royal Blue) va Qora (Slate-900).

---

## 🏢 Bo'limlar va Oylar Tarixi:

### 1. 🏢 Al-Farg'oniy (yangiqo'rg'on) — 37 ta o'quvchi
- **Oktyabr 2026**: Barcha 37 ta o'quvchi **100% to'lagan** (11 100 000 so'm tarix saqlangan).
- **Noyabr 2026**: Yangi oy to'lovlari toza holatda kutilmoqda.

### 2. 🏢 Al-Farg'oniy (uchko'prik) — 23 ta o'quvchi
- **Oktyabr 2026**: Barcha 23 ta o'quvchi **100% to'lagan** (6 900 000 so'm tarix saqlangan).
- **Noyabr 2026**: Yangi oy to'lovlari toza holatda kutilmoqda.

### 💰 Standart to'lov:
- Barcha o'quvchilar uchun standart oylik to'lov summasi **300 000 so'm**.

---

## ⚡ Qanday ishga tushiriladi?

- Kompyuterda: `D:\full\start.bat` faylini ikki marta bosing.
- Serverda: `python server.py` buyrug'i orqali doimiy xizmatda ishga tushirishingiz mumkin (Port: 8080).
- Offline holda: To'g'ridan-to'g'ri `index.html` faylini brauzerda ochishingiz ham mumkin.
