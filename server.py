#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Classroom Local & Cloud Server (v3.5 - Universal SQLite & MongoDB Atlas Engine)
Supports both local hosting (SQLite) and 24/7 cloud hosting (MongoDB Atlas + Render/Vercel/Railway).
"""

import http.server
import socketserver
import json
import os
import sys
import socket
import urllib.parse
import mimetypes
import time
import db_adapter

# Ensure UTF-8 console output
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

PORT = int(os.environ.get('PORT', 8000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def get_local_ips():
    ips = []
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith('127.'):
                ips.append(ip)
    except Exception:
        pass
    if not ips:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            if ip and not ip.startswith('127.'):
                ips.append(ip)
        except Exception:
            pass
    return ips or ['127.0.0.1']

class ClassroomRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, status_code, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                raw_data = self.rfile.read(content_length).decode('utf-8')
                return json.loads(raw_data)
        except Exception as e:
            print(f"[WARN] JSON parse error: {e}", file=sys.stderr)
        return {}

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. API: Server status
        if path == '/api/status':
            local_ips = get_local_ips()
            counts = db_adapter.get_status_counts()
            last_up = db_adapter.get_last_update()
            self.send_json(200, {
                "status": "online",
                "version": "3.5.0-universal",
                "database": db_adapter.get_engine_name(),
                "port": PORT,
                "localIps": local_ips,
                "serverTime": int(time.time() * 1000),
                "lastUpdate": last_up,
                "coursesCount": counts.get("coursesCount", 0),
                "accountsCount": counts.get("accountsCount", 0)
            })
            return

        # 2. API: Full database payload
        if path == '/api/data':
            payload = db_adapter.build_full_payload()
            self.send_json(200, payload)
            return

        # 3. API: Poll updates
        if path == '/api/poll':
            query = urllib.parse.parse_qs(parsed.query)
            client_since = int(query.get('since', [0])[0])
            server_last = db_adapter.get_last_update()
            if server_last > client_since:
                payload = db_adapter.build_full_payload()
                self.send_json(200, { "hasUpdates": True, "data": payload, "lastUpdate": server_last })
            else:
                self.send_json(200, { "hasUpdates": False, "lastUpdate": server_last })
            return

        # 4. API: Get user settings
        if path == '/api/settings/get':
            query = urllib.parse.parse_qs(parsed.query)
            user_id = query.get('userId', [''])[0]
            if not user_id:
                self.send_json(400, { "error": "userId required" })
                return
            settings = db_adapter.get_user_settings(user_id)
            self.send_json(200, { "success": True, "settings": settings })
            return

        # 5. Static Files: serve index.html / Classroom.html as main page
        if path in ('/', '/index.html', '/classroom', '/classroom.html', '/Classroom.html'):
            target_file = os.path.join(BASE_DIR, 'index.html')
            if not os.path.exists(target_file):
                target_file = os.path.join(BASE_DIR, 'Classroom.html')
            
            if os.path.exists(target_file):
                with open(target_file, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()

        # ----------------- ACCOUNTS -----------------
        if path == '/api/accounts/register':
            acc, err = db_adapter.register_account(body)
            if err:
                self.send_json(400, { "error": err })
                return
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "account": acc, "data": payload })
            return

        if path == '/api/accounts/update':
            acc_id = body.get('id')
            db_adapter.update_account(acc_id, body)
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "data": payload })
            return

        if path == '/api/accounts/login':
            email = body.get('email', '').strip().lower()
            password = body.get('password', '').strip()
            payload = db_adapter.build_full_payload()
            acc = next((a for a in payload.get('accounts', []) if a.get('email', '').lower() == email), None)
            if not acc:
                self.send_json(404, { "error": "Пользователь с таким email не найден" })
                return
            if password and acc.get('password') and acc.get('password') != password:
                self.send_json(401, { "error": "Неверный пароль" })
                return
            self.send_json(200, { "success": True, "account": acc, "data": payload })
            return

        # ----------------- COURSES -----------------
        if path == '/api/courses/create':
            course = db_adapter.create_course(body)
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "course": course, "data": payload })
            return

        if path == '/api/courses/update':
            cid = body.get('id')
            db_adapter.update_course(cid, body)
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "data": payload })
            return

        if path == '/api/courses/delete':
            cid = body.get('id')
            db_adapter.delete_course(cid)
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "data": payload })
            return

        if path == '/api/courses/join':
            code = body.get('code', '')
            user_id = body.get('userId', '')
            course, err = db_adapter.join_course_by_code(code, user_id)
            if err:
                self.send_json(400, { "error": err })
                return
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "course": course, "data": payload })
            return

        # ----------------- ANNOUNCEMENTS -----------------
        if path == '/api/announcements/create':
            ann = db_adapter.create_announcement(body)
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "announcement": ann, "data": payload })
            return

        if path == '/api/announcements/comment':
            aid = body.get('announcementId')
            com = db_adapter.add_announcement_comment(aid, body)
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "comment": com, "data": payload })
            return

        # ----------------- ASSIGNMENTS -----------------
        if path == '/api/assignments/create':
            assign = db_adapter.create_assignment(body)
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "assignment": assign, "data": payload })
            return

        if path == '/api/assignments/update':
            as_id = body.get('id')
            # update
            mdb = db_adapter.get_mongo_db()
            if mdb is not None:
                mdb.assignments.update_one({"id": as_id}, {"$set": body})
                db_adapter.touch_last_update()
            else:
                with db_adapter.db_lock:
                    conn = db_adapter.get_sqlite_conn()
                    try:
                        with conn:
                            conn.execute("""
                            UPDATE assignments SET title = ?, instructions = ?, points = ?, deadline = ?, topic = ?, attachments = ?, updated_at = ?
                            WHERE id = ?
                            """, (body.get('title'), body.get('instructions', ''), int(body.get('points', 100)),
                                  body.get('deadline', 'Без срока'), body.get('topic', ''),
                                  json.dumps(body.get('attachments', []), ensure_ascii=False),
                                  db_adapter.get_now_ms(), as_id))
                        db_adapter.touch_last_update()
                    finally:
                        conn.close()
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "data": payload })
            return

        if path == '/api/assignments/delete':
            as_id = body.get('id')
            mdb = db_adapter.get_mongo_db()
            if mdb is not None:
                mdb.assignments.delete_one({"id": as_id})
                db_adapter.touch_last_update()
            else:
                with db_adapter.db_lock:
                    conn = db_adapter.get_sqlite_conn()
                    try:
                        with conn:
                            conn.execute("DELETE FROM assignments WHERE id = ?", (as_id,))
                            conn.execute("DELETE FROM assignment_submissions WHERE assignment_id = ?", (as_id,))
                        db_adapter.touch_last_update()
                    finally:
                        conn.close()
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "data": payload })
            return

        if path == '/api/assignments/submit':
            as_id = body.get('assignmentId')
            student_id = body.get('studentId')
            files = body.get('files', [])
            link = body.get('link', '')
            sub = db_adapter.submit_assignment(as_id, student_id, files, link)
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "submission": sub, "data": payload })
            return

        if path == '/api/assignments/grade':
            as_id = body.get('assignmentId')
            student_id = body.get('studentId')
            grade = body.get('grade')
            db_adapter.grade_assignment(as_id, student_id, grade)
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "data": payload })
            return

        if path == '/api/assignments/comment':
            as_id = body.get('assignmentId')
            now_ms = db_adapter.get_now_ms()
            com = {
                "id": f"com_{now_ms}",
                "authorName": body.get('authorName', ''),
                "authorAvatar": body.get('authorAvatar', ''),
                "text": body.get('text', ''),
                "date": body.get('date', 'Только что'),
                "createdAt": now_ms
            }
            mdb = db_adapter.get_mongo_db()
            if mdb is not None:
                mdb.assignments.update_one({"id": as_id}, {"$push": {"comments": com}})
                db_adapter.touch_last_update()
            else:
                with db_adapter.db_lock:
                    conn = db_adapter.get_sqlite_conn()
                    try:
                        with conn:
                            conn.execute("""
                            INSERT INTO assignment_comments (id, assignment_id, author_name, author_avatar, text, date_str, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                            """, (com['id'], as_id, com['authorName'], com['authorAvatar'], com['text'], com['date'], now_ms))
                        db_adapter.touch_last_update()
                    finally:
                        conn.close()
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "comment": com, "data": payload })
            return

        if path == '/api/assignments/private-comment':
            as_id = body.get('assignmentId')
            student_id = body.get('studentId')
            now_ms = db_adapter.get_now_ms()
            p_com = {
                "id": f"pcom_{now_ms}",
                "studentId": student_id,
                "authorName": body.get('authorName', ''),
                "authorAvatar": body.get('authorAvatar', ''),
                "text": body.get('text', ''),
                "date": body.get('date', 'Только что'),
                "createdAt": now_ms
            }
            mdb = db_adapter.get_mongo_db()
            if mdb is not None:
                mdb.assignments.update_one({"id": as_id}, {"$push": {"privateComments": p_com}})
                db_adapter.touch_last_update()
            else:
                with db_adapter.db_lock:
                    conn = db_adapter.get_sqlite_conn()
                    try:
                        with conn:
                            conn.execute("""
                            INSERT INTO assignment_private_comments (id, assignment_id, student_id, author_name, author_avatar, text, date_str, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            """, (p_com['id'], as_id, student_id, p_com['authorName'], p_com['authorAvatar'], p_com['text'], p_com['date'], now_ms))
                        db_adapter.touch_last_update()
                    finally:
                        conn.close()
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "comment": p_com, "data": payload })
            return

        # ----------------- CHATS -----------------
        if path == '/api/chats/create':
            chat = db_adapter.create_chat(body)
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "chat": chat, "data": payload })
            return

        if path == '/api/chats/message':
            msg = db_adapter.add_chat_message(body)
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "message": msg, "data": payload })
            return

        if path == '/api/chats/delete':
            cid = body.get('chatId')
            mdb = db_adapter.get_mongo_db()
            if mdb is not None:
                mdb.chats.delete_one({"id": cid})
                mdb.chat_messages.delete_many({"chatId": cid})
                db_adapter.touch_last_update()
            else:
                with db_adapter.db_lock:
                    conn = db_adapter.get_sqlite_conn()
                    try:
                        with conn:
                            conn.execute("DELETE FROM chats WHERE id = ?", (cid,))
                            conn.execute("DELETE FROM chat_members WHERE chat_id = ?", (cid,))
                            conn.execute("DELETE FROM chat_messages WHERE chat_id = ?", (cid,))
                        db_adapter.touch_last_update()
                    finally:
                        conn.close()
            payload = db_adapter.build_full_payload()
            self.send_json(200, { "success": True, "data": payload })
            return

        # ----------------- SETTINGS -----------------
        if path == '/api/settings/save':
            user_id = body.get('userId')
            settings = body.get('settings', {})
            db_adapter.save_user_settings(user_id, settings)
            self.send_json(200, { "success": True })
            return

        self.send_json(404, { "error": "Endpoint not found" })

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

def main():
    db_adapter.init_db()
    server_address = ('0.0.0.0', PORT)
    httpd = ThreadingHTTPServer(server_address, ClassroomRequestHandler)

    print("=" * 60)
    print("   Google Classroom Cloud & Local Server (v3.5)")
    print(f"   Database: {db_adapter.get_engine_name()}")
    print(f"   Port:     {PORT}")
    print("-" * 60)
    print(f"   Local URL:   http://localhost:{PORT}")
    for ip in get_local_ips():
        print(f"   Network URL: http://{ip}:{PORT}")
    print("=" * 60)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Server stopped gracefully.")
        httpd.server_close()

if __name__ == '__main__':
    main()
