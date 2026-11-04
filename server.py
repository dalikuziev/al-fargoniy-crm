import os
import sys
import json
import sqlite3
import urllib.parse
import secrets
from http.server import HTTPServer, SimpleHTTPRequestHandler
import webbrowser

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')
PORT = int(os.environ.get('PORT', 8080))
DEFAULT_FEE = 300000  # Standart 300 ming so'm

# Administrator hisob ma'lumotlari
ADMIN_USER = 'dalikuziev'
ADMIN_PASS = 'Dyrbk41Aiuie)'
ADMIN_NAME = 'Diyorbek Alikuziev'

# Aktiv admin tokenlar (xotirada saqlanadi)
ACTIVE_TOKENS = set()

# ========================================================
# 1. DATABASE & INITIAL SEED DATA
# ========================================================

RAW_LEFT_STUDENTS = [
    ("Hojiakbar 2", "99-047-7786"),
    ("Turdimuhammad 2", "94-131-9002"),
    ("Nursaid Abdulhamidov 2 ", "94-444-1299"),
    ("Ne'matjon Normatov 2", "93-874-5092"),
    ("Jo'rabek Nematov 2 ", "93-401-6163"),
    ("Abdujamil Ro'zaliyev 2", "93-982-5148"),
    ("Muhammadaziz Maripov 2", "93-974-9595"),
    ("Yaxyobek Turdaliyev 2", "77-143-1379"),
    ("Mustafo 1", "94-680-1168"),
    ("Ziyodullo Rahmatullayev 1", "94-402-0769"),
    ("Ibrohimjon Yetovqo'ziyev 1", "93-688-4262"),
    ("Muhammadaziz Nosirov 1", "99-365-4333"),
    ("Abdulloh Ahmadjonov 3", "94-444-4420"),
    ("Jamshidbek Jumaqo'ziyev 3", "91-140-4776"),
    ("Abdulhay Madaminov 1", "99-341-0070"),
    ("Nurmuhammad Ikromjonov 1", "50-500-9569"),
    ("Shahrizoda Bahodirjonova 1", "91-750-6339"),
    ("Inoyatxon 1", "94-491-9125"),
    ("Azizbek Munavvarjonov 1", "94-137-1670"),
    ("Kozimbek Muhammadjonov 1", "94-130-4900"),
    ("Muhammadaziz G'ofurjonov 1", "94-225-2985"),
    ("Ziyodullo Xoliqjonov 1", "94-726-9388"),
    ("Xudoberdi Abduvahobov 1", "93-738-8845"),
    ("Islomjon Anvarjonov 1", "93-760-0900"),
    ("Kamoliddin Shemuhammedov 1", "99-090-5535"),
    ("Muhammadiso Sadiraliyev 1", "33-408-7373"),
    ("Akbarjon Abdullayev 1", "99-603-3662"),
    ("Shamshodbek Toshtemirov 3", "99-530-9956"),
    ("Sunnatillo Qo'chorov 3", "91-695-5473"),
    ("Oyatillo 3", "94-058-0390"),
    ("Elmurodjon Bahodirjonov 1", "99-999-0922"),
    ("Abdulloh Odiljonov 1", "77-500-8986"),
    ("Muhammadfayiz Mirzarahmonov 1", "93-645-5587"),
    ("Iskandar Sultonaliyev 2", "93-375-0080"),
    ("Muhammadiso Mahmudjonov 2", "50-005-3071"),
    ("Miryoqub G'ulomov 2", "94-153-9847"),
    ("Ibrobimjon Botiraliyev 2", "99-293-0147")
]

RAW_RIGHT_STUDENTS = [
    ("Omadbek 2", "90-850-7743"),
    ("Dostonbek 2", "99-440-7200"),
    ("Otabek 2", "91-754-4486"),
    ("Ayubxon 2", "90-059-1189"),
    ("Azizbek I 2", "94-894-1123"),
    ("Azizbek U 1", "95-004-7396"),
    ("Sultonali 1", "93-622-8490"),
    ("Sobirjon 1", "91-746-1917"),
    ("Abduhoshim 1", "91-153-0608"),
    ("Muhammadrizo 1", "91-744-8795"),
    ("Muhammadjon 1", "93-981-6050"),
    ("Barkamol 2", "50-704-7503"),
    ("Akobir 2", "50-704-7503"),
    ("Murodali 2", "90-360-9182"),
    ("Muhammadiy 1", "91-737-5060"),
    ("Abdusalom 1", "90-586-6005"),
    ("Rasulxon 1", "95-005-0747"),
    ("Sahobiddin 1", "97-040-0211"),
    ("Nabibullo 1", "94-134-6113"),
    ("Sherzodbek 1", "91-154-5100"),
    ("Hurshidbek 1", "91-052-8286"),
    ("Kamron 3", "90-344-8082"),
    ("Shohruh 3", "90-040-0470")
]

def parse_raw(item):
    raw_name, raw_phone = item
    raw_name = raw_name.strip()
    import re
    match = re.search(r'^(.*?)\s*([1-3])$', raw_name)
    if match:
        name = match.group(1).strip()
        group = f"{match.group(2)}-guruh"
    else:
        name = raw_name
        group = "1-guruh"
    
    phone = raw_phone.strip()
    if phone and not phone.startswith('+998'):
        phone = '+998 ' + phone
    
    return name, phone, group

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_database(force_reseed=False):
    conn = get_db()
    c = conn.cursor()

    if force_reseed:
        c.execute('DROP TABLE IF EXISTS payments')
        c.execute('DROP TABLE IF EXISTS branch_months')
        c.execute('DROP TABLE IF EXISTS students')
        c.execute('DROP TABLE IF EXISTS branches')

    # Branches
    c.execute('''
        CREATE TABLE IF NOT EXISTS branches (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            order_num INTEGER DEFAULT 0
        )
    ''')

    # Students
    c.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            branch_id TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            group_name TEXT DEFAULT '1-guruh',
            monthly_fee INTEGER DEFAULT 300000,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (branch_id) REFERENCES branches(id)
        )
    ''')

    # Months
    c.execute('''
        CREATE TABLE IF NOT EXISTS branch_months (
            branch_id TEXT NOT NULL,
            month_key TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (branch_id, month_key)
        )
    ''')

    # Payments
    c.execute('''
        CREATE TABLE IF NOT EXISTS payments (
            branch_id TEXT NOT NULL,
            month_key TEXT NOT NULL,
            student_id TEXT NOT NULL,
            paid INTEGER DEFAULT 0,
            amount INTEGER DEFAULT 0,
            pay_date TEXT DEFAULT '',
            note TEXT DEFAULT '',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (branch_id, month_key, student_id),
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
    ''')

    c.execute('SELECT COUNT(*) as cnt FROM branches')
    if c.fetchone()['cnt'] == 0:
        c.execute('INSERT INTO branches (id, name, order_num) VALUES (?, ?, ?)',
                  ('yangiqorgon', "Al-Farg'oniy (yangiqo'rg'on)", 1))
        c.execute('INSERT INTO branches (id, name, order_num) VALUES (?, ?, ?)',
                  ('uchkoprik', "Al-Farg'oniy (uchko'prik)", 2))
        
        months = ['2026-10', '2026-11']
        for m in months:
            c.execute('INSERT INTO branch_months (branch_id, month_key) VALUES (?, ?)', ('yangiqorgon', m))
            c.execute('INSERT INTO branch_months (branch_id, month_key) VALUES (?, ?)', ('uchkoprik', m))

        # Seed Left Branch (Yangiqo'rg'on - 37 o'quvchi)
        idx = 1
        for item in RAW_LEFT_STUDENTS:
            name, phone, group = parse_raw(item)
            sid = f'std_yq_{idx}'
            c.execute('''
                INSERT INTO students (id, branch_id, name, phone, group_name, monthly_fee)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (sid, 'yangiqorgon', name, phone, group, DEFAULT_FEE))

            # Oktyabr 100% to'langan tarix
            c.execute('''
                INSERT INTO payments (branch_id, month_key, student_id, paid, amount, pay_date, note)
                VALUES (?, ?, ?, 1, ?, '2026-10-15', ?)
            ''', ('yangiqorgon', '2026-10', sid, DEFAULT_FEE, "To'liq to'langan (100%)"))
            idx += 1

        # Seed Right Branch (Uchko'prik - 23 o'quvchi)
        idx = 1
        for item in RAW_RIGHT_STUDENTS:
            name, phone, group = parse_raw(item)
            sid = f'std_uk_{idx}'
            c.execute('''
                INSERT INTO students (id, branch_id, name, phone, group_name, monthly_fee)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (sid, 'uchkoprik', name, phone, group, DEFAULT_FEE))

            # Oktyabr 100% to'langan tarix
            c.execute('''
                INSERT INTO payments (branch_id, month_key, student_id, paid, amount, pay_date, note)
                VALUES (?, ?, ?, 1, ?, '2026-10-15', ?)
            ''', ('uchkoprik', '2026-10', sid, DEFAULT_FEE, "To'liq to'langan (100%)"))
            idx += 1

        conn.commit()

    conn.close()

# ========================================================
# 2. HTTP REQUEST HANDLER (REST API + AUTHENTICATION)
# ========================================================

class CRMRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        directory = os.path.dirname(os.path.abspath(__file__))
        super().__init__(*args, directory=directory, **kwargs)

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def parse_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            post_data = self.rfile.read(content_length)
            return json.loads(post_data.decode('utf-8'))
        return {}

    def is_authenticated(self):
        auth_header = self.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split('Bearer ')[1].strip()
            if token in ACTIVE_TOKENS:
                return True
        return False

    # ========================================================
    # GET REQUESTS
    # ========================================================
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. API: Bootstrap (Oddiy odamlar ham barcha ma'lumotlarni ko'ra oladi)
        if path == '/api/bootstrap':
            conn = get_db()
            c = conn.cursor()
            
            c.execute('SELECT * FROM branches ORDER BY order_num ASC')
            branches = [dict(row) for row in c.fetchall()]

            c.execute('SELECT * FROM branch_months ORDER BY month_key ASC')
            months_rows = c.fetchall()
            branch_months = {}
            for row in months_rows:
                bid = row['branch_id']
                if bid not in branch_months: branch_months[bid] = []
                branch_months[bid].append(row['month_key'])

            c.execute("SELECT * FROM students WHERE status = 'active' ORDER BY rowid ASC")
            students = [dict(row) for row in c.fetchall()]

            c.execute('SELECT * FROM payments')
            payments = [dict(row) for row in c.fetchall()]

            conn.close()

            self.send_json({
                'ok': True,
                'default_fee': DEFAULT_FEE,
                'branches': branches,
                'branch_months': branch_months,
                'students': students,
                'payments': payments,
                'is_admin': self.is_authenticated()
            })
            return

        # 2. API: Auth check
        elif path == '/api/auth/check':
            self.send_json({
                'ok': True,
                'is_admin': self.is_authenticated(),
                'admin_name': ADMIN_NAME if self.is_authenticated() else None
            })
            return

        super().do_GET()

    # ========================================================
    # POST REQUESTS
    # ========================================================
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_body()

        # LOGIN ENDPOINT (Hamma uchun ochiq)
        if path == '/api/auth/login':
            username = body.get('username', '').strip()
            password = body.get('password', '').strip()

            if username == ADMIN_USER and password == ADMIN_PASS:
                token = secrets.token_hex(20)
                ACTIVE_TOKENS.add(token)
                self.send_json({
                    'ok': True,
                    'token': token,
                    'user': {
                        'name': ADMIN_NAME,
                        'username': ADMIN_USER
                    },
                    'message': f"Xush kelibsiz, {ADMIN_NAME}!"
                })
            else:
                self.send_json({
                    'ok': False,
                    'error': "Login yoki parol noto'g'ri! Iltimos qaytadan tekshirib ko'ring."
                }, status=401)
            return

        # LOGOUT ENDPOINT
        elif path == '/api/auth/logout':
            auth_header = self.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                token = auth_header.split('Bearer ')[1].strip()
                ACTIVE_TOKENS.discard(token)
            self.send_json({'ok': True, 'message': 'Tizimdan muvaffaqiyatli chiqildi.'})
            return

        # ========================================================
        # HIMOYALANGAN OPERATSIYALAR (FAQAT ADMIN O'ZGARTIRA OLADI!)
        # ========================================================
        if not self.is_authenticated():
            self.send_json({
                'ok': False,
                'error': "Ruxsat etilmadi! Ushbu amalni bajarish uchun administrator (Diyorbek Alikuziev) sifatida tizimga kiring."
            }, status=403)
            return

        conn = get_db()
        c = conn.cursor()

        try:
            # A) YANGI O'QUVCHI QO'SHISH
            if path == '/api/students':
                branch_id = body.get('branch_id', 'yangiqorgon')
                name = body.get('name', '').strip()
                phone = body.get('phone', '').strip()
                group_name = body.get('group_name', '1-guruh').strip()
                monthly_fee = int(body.get('monthly_fee', DEFAULT_FEE))

                if not name or not phone:
                    self.send_json({'ok': False, 'error': "Ism va telefon raqami kiritilishi shart!"}, status=400)
                    conn.close()
                    return

                new_id = f"std_{branch_id}_{int(os.urandom(4).hex(), 16)}"
                c.execute('''
                    INSERT INTO students (id, branch_id, name, phone, group_name, monthly_fee, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'active')
                ''', (new_id, branch_id, name, phone, group_name, monthly_fee))
                conn.commit()

                c.execute('SELECT * FROM students WHERE id = ?', (new_id,))
                student = dict(c.fetchone())
                conn.close()

                self.send_json({'ok': True, 'student': student, 'message': f"'{name}' muvaffaqiyatli qo'shildi!"})
                return

            # B) BIR KLIKDA TEZKOR TO'LOV
            elif path == '/api/payments/quick':
                branch_id = body.get('branch_id')
                month_key = body.get('month_key')
                student_id = body.get('student_id')

                c.execute('SELECT monthly_fee FROM students WHERE id = ?', (student_id,))
                std_row = c.fetchone()
                fee = std_row['monthly_fee'] if std_row else DEFAULT_FEE

                from datetime import date
                today_str = date.today().isoformat()

                c.execute('''
                    INSERT INTO payments (branch_id, month_key, student_id, paid, amount, pay_date, note)
                    VALUES (?, ?, ?, 1, ?, ?, 'To\'liq to\'landi')
                    ON CONFLICT(branch_id, month_key, student_id) DO UPDATE SET
                        paid = 1,
                        amount = excluded.amount,
                        pay_date = excluded.pay_date,
                        note = excluded.note
                ''', (branch_id, month_key, student_id, fee, today_str))
                conn.commit()
                conn.close()

                self.send_json({'ok': True, 'paid': True, 'amount': fee, 'date': today_str})
                return

            # C) TO'LOVNI BEKOR QILISH
            elif path == '/api/payments/cancel':
                branch_id = body.get('branch_id')
                month_key = body.get('month_key')
                student_id = body.get('student_id')

                c.execute('''
                    DELETE FROM payments
                    WHERE branch_id = ? AND month_key = ? AND student_id = ?
                ''', (branch_id, month_key, student_id))
                conn.commit()
                conn.close()

                self.send_json({'ok': True, 'paid': False})
                return

            # D) MOSLASHTIRILGAN TO'LOV
            elif path == '/api/payments/custom':
                branch_id = body.get('branch_id')
                month_key = body.get('month_key')
                student_id = body.get('student_id')
                amount = int(body.get('amount', 0))
                pay_date = body.get('pay_date', '')
                note = body.get('note', '')

                if amount > 0:
                    c.execute('''
                        INSERT INTO payments (branch_id, month_key, student_id, paid, amount, pay_date, note)
                        VALUES (?, ?, ?, 1, ?, ?, ?)
                        ON CONFLICT(branch_id, month_key, student_id) DO UPDATE SET
                            paid = 1,
                            amount = excluded.amount,
                            pay_date = excluded.pay_date,
                            note = excluded.note
                    ''', (branch_id, month_key, student_id, amount, pay_date, note))
                else:
                    c.execute('''
                        DELETE FROM payments
                        WHERE branch_id = ? AND month_key = ? AND student_id = ?
                    ''', (branch_id, month_key, student_id))
                conn.commit()
                conn.close()

                self.send_json({'ok': True, 'paid': amount > 0, 'amount': amount})
                return

            # E) YANGI OYNI TOZA HOLDA BOSHLASH
            elif path == '/api/months/start-new':
                branch_id = body.get('branch_id')
                month_key = body.get('month_key')

                if not branch_id or not month_key:
                    self.send_json({'ok': False, 'error': "Bo'lim va oy kiritilishi shart!"}, status=400)
                    conn.close()
                    return

                c.execute('''
                    INSERT OR IGNORE INTO branch_months (branch_id, month_key)
                    VALUES (?, ?)
                ''', (branch_id, month_key))

                reset_payments = body.get('reset_payments', False)
                if reset_payments:
                    c.execute('''
                        DELETE FROM payments WHERE branch_id = ? AND month_key = ?
                    ''', (branch_id, month_key))

                conn.commit()
                conn.close()

                self.send_json({'ok': True, 'month_key': month_key, 'message': f"'{month_key}' oyi toza holda boshlandi!"})
                return

            # F) OMMAVIY O'CHIRISH
            elif path == '/api/students/bulk-delete':
                student_ids = body.get('student_ids', [])
                if student_ids:
                    placeholders = ','.join('?' for _ in student_ids)
                    c.execute(f"DELETE FROM payments WHERE student_id IN ({placeholders})", student_ids)
                    c.execute(f"DELETE FROM students WHERE id IN ({placeholders})", student_ids)
                    conn.commit()
                conn.close()
                self.send_json({'ok': True, 'deleted_count': len(student_ids)})
                return

            else:
                self.send_json({'ok': False, 'error': 'Endpoint not found'}, status=404)
                conn.close()

        except Exception as e:
            conn.close()
            self.send_json({'ok': False, 'error': str(e)}, status=500)

    # ========================================================
    # PUT REQUESTS (FAQAT ADMIN)
    # ========================================================
    def do_PUT(self):
        if not self.is_authenticated():
            self.send_json({
                'ok': False,
                'error': "Ruxsat etilmadi! O'zgartirish uchun admin sifatida kiring."
            }, status=403)
            return

        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_body()
        conn = get_db()
        c = conn.cursor()

        try:
            if path == '/api/students':
                sid = body.get('id')
                name = body.get('name', '').strip()
                phone = body.get('phone', '').strip()
                group_name = body.get('group_name', '').strip()
                monthly_fee = int(body.get('monthly_fee', DEFAULT_FEE))
                branch_id = body.get('branch_id')

                c.execute('''
                    UPDATE students
                    SET name = ?, phone = ?, group_name = ?, monthly_fee = ?, branch_id = ?
                    WHERE id = ?
                ''', (name, phone, group_name, monthly_fee, branch_id, sid))
                conn.commit()
                conn.close()

                self.send_json({'ok': True, 'message': "O'quvchi ma'lumotlari yangilandi!"})
                return
            else:
                self.send_json({'ok': False, 'error': 'Endpoint not found'}, status=404)
                conn.close()
        except Exception as e:
            conn.close()
            self.send_json({'ok': False, 'error': str(e)}, status=500)

    # ========================================================
    # DELETE REQUESTS (FAQAT ADMIN)
    # ========================================================
    def do_DELETE(self):
        if not self.is_authenticated():
            self.send_json({
                'ok': False,
                'error': "Ruxsat etilmadi! O'quvchini o'chirish uchun admin sifatida kiring."
            }, status=403)
            return

        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_body()
        conn = get_db()
        c = conn.cursor()

        try:
            if path == '/api/students':
                sid = body.get('id')
                if not sid:
                    query = urllib.parse.parse_qs(parsed.query)
                    sid = query.get('id', [None])[0]

                if not sid:
                    self.send_json({'ok': False, 'error': 'Student ID berilmadi!'}, status=400)
                    conn.close()
                    return

                c.execute('DELETE FROM payments WHERE student_id = ?', (sid,))
                c.execute('DELETE FROM students WHERE id = ?', (sid,))
                conn.commit()
                conn.close()

                self.send_json({'ok': True, 'message': "O'quvchi butunlay o'chirildi!"})
                return
            else:
                self.send_json({'ok': False, 'error': 'Endpoint not found'}, status=404)
                conn.close()
        except Exception as e:
            conn.close()
            self.send_json({'ok': False, 'error': str(e)}, status=500)

# ========================================================
# 3. MAIN RUNNER
# ========================================================

def run():
    init_database()
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, CRMRequestHandler)
    url = f"http://localhost:{PORT}/index.html"
    print("=" * 65)
    print("  DIYORBEK ALIKUZIEV CRM - O'QUVCHILAR TO'LOV TIZIMI")
    print("=" * 65)
    print(f"  [+] Server: {url}")
    print(f"  [+] Admin Login: {ADMIN_USER}")
    print(f"  [+] Begona odamlar: Faqat ko'rish rejimi (Read-only)")
    print(f"  [+] Standart to'lov: 300 000 so'm")
    print("=" * 65)
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer to'xtatildi.")
        sys.exit(0)

if __name__ == '__main__':
    run()
