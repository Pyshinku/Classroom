# -*- coding: utf-8 -*-
"""
Google Classroom - Universal Database Adapter (SQLite & MongoDB Atlas)
Automatically switches between SQLite (local development) and MongoDB Atlas (cloud production)
based on the presence of the MONGODB_URI environment variable or .env file.
"""

import os
import sys
import time
import json
import sqlite3
from threading import RLock

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

try:
    import pymongo
except ImportError:
    pymongo = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_PATH = os.path.join(BASE_DIR, 'classroom.db')
MONGODB_URI = os.environ.get('MONGODB_URI', '').strip()
MONGODB_DB_NAME = os.environ.get('MONGODB_DB_NAME', 'classroom')

db_lock = RLock()
_mongo_client = None
_mongo_db = None

def get_now_ms():
    return int(time.time() * 1000)

def is_mongo_enabled():
    return bool(MONGODB_URI and pymongo is not None)

def get_mongo_db():
    global _mongo_client, _mongo_db
    if _mongo_db is not None:
        return _mongo_db
    if not is_mongo_enabled():
        return None
    try:
        _mongo_client = pymongo.MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        _mongo_db = _mongo_client[MONGODB_DB_NAME]
        # Quick ping to verify connectivity
        _mongo_client.admin.command('ping')
        print(f"[DB] Successfully connected to MongoDB Atlas (database: {MONGODB_DB_NAME})")
        return _mongo_db
    except Exception as e:
        print(f"[WARN] Failed to connect to MongoDB Atlas ({e}). Falling back to SQLite.", file=sys.stderr)
        _mongo_client = None
        _mongo_db = None
        return None

def get_sqlite_conn():
    conn = sqlite3.connect(SQLITE_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    mdb = get_mongo_db()
    if mdb is not None:
        try:
            # Ensure indexes in MongoDB
            mdb.accounts.create_index([("email", pymongo.ASCENDING)], unique=True, sparse=True)
            mdb.courses.create_index([("code", pymongo.ASCENDING)], unique=True, sparse=True)
            mdb.chat_messages.create_index([("chatId", pymongo.ASCENDING), ("timestamp", pymongo.ASCENDING)])
            
            # Check meta
            meta = mdb.meta.find_one({"_id": "lastUpdate"})
            if not meta:
                mdb.meta.update_one({"_id": "lastUpdate"}, {"$set": {"value": get_now_ms()}}, upsert=True)
            print("[DB] MongoDB Atlas collections and indexes initialized!")
            return
        except Exception as e:
            print(f"[WARN] Error initializing MongoDB: {e}", file=sys.stderr)

    # SQLite initialization
    with db_lock:
        conn = get_sqlite_conn()
        try:
            with conn:
                conn.execute("CREATE TABLE IF NOT EXISTS server_meta (key TEXT PRIMARY KEY, value TEXT)")
                conn.execute("""
                CREATE TABLE IF NOT EXISTS accounts (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT,
                    role TEXT NOT NULL DEFAULT 'student',
                    avatar TEXT,
                    bg TEXT,
                    photo_url TEXT,
                    banner TEXT,
                    created_at INTEGER,
                    updated_at INTEGER
                )
                """)
                conn.execute("""
                CREATE TABLE IF NOT EXISTS courses (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    section TEXT,
                    subject TEXT,
                    description TEXT,
                    code TEXT UNIQUE NOT NULL,
                    gradient TEXT,
                    banner TEXT,
                    teacher_id TEXT,
                    is_archived INTEGER DEFAULT 0,
                    created_at INTEGER,
                    updated_at INTEGER
                )
                """)
                conn.execute("""
                CREATE TABLE IF NOT EXISTS course_members (
                    course_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    PRIMARY KEY (course_id, user_id)
                )
                """)
                conn.execute("""
                CREATE TABLE IF NOT EXISTS announcements (
                    id TEXT PRIMARY KEY,
                    course_id TEXT NOT NULL,
                    author_id TEXT,
                    author_name TEXT,
                    author_avatar TEXT,
                    date_str TEXT,
                    body TEXT NOT NULL,
                    attachments TEXT,
                    created_at INTEGER
                )
                """)
                conn.execute("""
                CREATE TABLE IF NOT EXISTS announcement_comments (
                    id TEXT PRIMARY KEY,
                    announcement_id TEXT NOT NULL,
                    author_name TEXT,
                    author_avatar TEXT,
                    text TEXT NOT NULL,
                    date_str TEXT,
                    created_at INTEGER
                )
                """)
                conn.execute("""
                CREATE TABLE IF NOT EXISTS assignments (
                    id TEXT PRIMARY KEY,
                    course_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    instructions TEXT,
                    points INTEGER DEFAULT 100,
                    deadline TEXT,
                    topic TEXT,
                    attachments TEXT,
                    created_at INTEGER,
                    updated_at INTEGER
                )
                """)
                conn.execute("""
                CREATE TABLE IF NOT EXISTS assignment_submissions (
                    assignment_id TEXT NOT NULL,
                    student_id TEXT NOT NULL,
                    files TEXT,
                    link TEXT,
                    submitted_at INTEGER,
                    status TEXT,
                    grade INTEGER,
                    PRIMARY KEY (assignment_id, student_id)
                )
                """)
                conn.execute("""
                CREATE TABLE IF NOT EXISTS assignment_comments (
                    id TEXT PRIMARY KEY,
                    assignment_id TEXT NOT NULL,
                    author_name TEXT,
                    author_avatar TEXT,
                    text TEXT NOT NULL,
                    date_str TEXT,
                    created_at INTEGER
                )
                """)
                conn.execute("""
                CREATE TABLE IF NOT EXISTS assignment_private_comments (
                    id TEXT PRIMARY KEY,
                    assignment_id TEXT NOT NULL,
                    student_id TEXT NOT NULL,
                    author_name TEXT,
                    author_avatar TEXT,
                    text TEXT NOT NULL,
                    date_str TEXT,
                    created_at INTEGER
                )
                """)
                conn.execute("""
                CREATE TABLE IF NOT EXISTS chats (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL DEFAULT 'direct',
                    name TEXT NOT NULL,
                    description TEXT,
                    avatar TEXT,
                    bg TEXT,
                    photo_url TEXT,
                    created_by TEXT,
                    created_at INTEGER
                )
                """)
                conn.execute("""
                CREATE TABLE IF NOT EXISTS chat_members (
                    chat_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    is_admin INTEGER DEFAULT 0,
                    PRIMARY KEY (chat_id, user_id)
                )
                """)
                conn.execute("""
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id TEXT PRIMARY KEY,
                    chat_id TEXT NOT NULL,
                    sender_id TEXT,
                    sender_name TEXT,
                    sender_avatar TEXT,
                    sender_photo TEXT,
                    text TEXT,
                    attachments TEXT,
                    reply_to TEXT,
                    reactions TEXT,
                    timestamp INTEGER
                )
                """)
                conn.execute("""
                CREATE TABLE IF NOT EXISTS user_settings (
                    user_id TEXT PRIMARY KEY,
                    settings_json TEXT,
                    updated_at INTEGER
                )
                """)
                conn.execute("""
                CREATE TABLE IF NOT EXISTS notifications (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    type TEXT,
                    title TEXT,
                    message TEXT,
                    link TEXT,
                    is_read INTEGER DEFAULT 0,
                    timestamp INTEGER
                )
                """)

                try:
                    conn.execute("ALTER TABLE courses ADD COLUMN is_archived INTEGER DEFAULT 0")
                except Exception:
                    pass

                cur = conn.execute("SELECT value FROM server_meta WHERE key = 'lastUpdate'")
                if not cur.fetchone():
                    ts = get_now_ms()
                    conn.execute("INSERT INTO server_meta (key, value) VALUES ('lastUpdate', ?)", (str(ts),))
        finally:
            conn.close()

def get_last_update():
    mdb = get_mongo_db()
    if mdb is not None:
        try:
            row = mdb.meta.find_one({"_id": "lastUpdate"})
            if row and "value" in row:
                return int(row["value"])
            return get_now_ms()
        except Exception:
            pass

    with db_lock:
        conn = get_sqlite_conn()
        try:
            cur = conn.execute("SELECT value FROM server_meta WHERE key = 'lastUpdate'")
            row = cur.fetchone()
            if row and row['value']:
                return int(row['value'])
            return get_now_ms()
        finally:
            conn.close()

def touch_last_update():
    ts = get_now_ms()
    mdb = get_mongo_db()
    if mdb is not None:
        try:
            mdb.meta.update_one({"_id": "lastUpdate"}, {"$set": {"value": ts}}, upsert=True)
            return ts
        except Exception:
            pass

    with db_lock:
        conn = get_sqlite_conn()
        try:
            with conn:
                conn.execute("INSERT INTO server_meta (key, value) VALUES ('lastUpdate', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (str(ts),))
            return ts
        finally:
            conn.close()

def get_engine_name():
    return "MongoDB Atlas Engine" if get_mongo_db() is not None else "SQLite Relational Engine"

def build_full_payload():
    mdb = get_mongo_db()
    if mdb is not None:
        try:
            last_update = get_last_update()

            accounts = []
            for doc in mdb.accounts.find({}, {"_id": 0}).sort("createdAt", 1):
                accounts.append({
                    "id": doc.get("id"),
                    "name": doc.get("name", ""),
                    "email": doc.get("email", ""),
                    "password": doc.get("password", ""),
                    "role": doc.get("role", "student"),
                    "avatar": doc.get("avatar", ""),
                    "bg": doc.get("bg", "from-blue-600 to-indigo-600"),
                    "photoUrl": doc.get("photoUrl", ""),
                    "banner": doc.get("banner", "")
                })

            courses = []
            for doc in mdb.courses.find({}, {"_id": 0}).sort("createdAt", -1):
                courses.append({
                    "id": doc.get("id"),
                    "name": doc.get("name", ""),
                    "section": doc.get("section", ""),
                    "subject": doc.get("subject", ""),
                    "description": doc.get("description", ""),
                    "code": doc.get("code", ""),
                    "gradient": doc.get("gradient", "from-blue-600 to-indigo-700"),
                    "banner": doc.get("banner", ""),
                    "teacherId": doc.get("teacherId", ""),
                    "isArchived": bool(doc.get("isArchived", False)),
                    "coTeacherIds": doc.get("coTeacherIds", []),
                    "studentIds": doc.get("studentIds", [])
                })

            announcements = []
            for doc in mdb.announcements.find({}, {"_id": 0}).sort("createdAt", -1):
                announcements.append({
                    "id": doc.get("id"),
                    "courseId": doc.get("courseId", ""),
                    "authorId": doc.get("authorId", ""),
                    "authorName": doc.get("authorName", ""),
                    "authorAvatar": doc.get("authorAvatar", ""),
                    "date": doc.get("date", "Только что"),
                    "body": doc.get("body", ""),
                    "attachments": doc.get("attachments", []),
                    "comments": doc.get("comments", [])
                })

            assignments = []
            for doc in mdb.assignments.find({}, {"_id": 0}).sort("createdAt", -1):
                assignments.append({
                    "id": doc.get("id"),
                    "courseId": doc.get("courseId", ""),
                    "title": doc.get("title", ""),
                    "instructions": doc.get("instructions", ""),
                    "points": doc.get("points", 100),
                    "deadline": doc.get("deadline", "Без срока"),
                    "topic": doc.get("topic", ""),
                    "attachments": doc.get("attachments", []),
                    "submissions": doc.get("submissions", {}),
                    "comments": doc.get("comments", []),
                    "privateComments": doc.get("privateComments", [])
                })

            chats = []
            for doc in mdb.chats.find({}, {"_id": 0}).sort("createdAt", -1):
                chats.append({
                    "id": doc.get("id"),
                    "type": doc.get("type", "direct"),
                    "name": doc.get("name", ""),
                    "description": doc.get("description", ""),
                    "avatar": doc.get("avatar", "💬"),
                    "bg": doc.get("bg", "from-sky-500 to-blue-600"),
                    "photoUrl": doc.get("photoUrl", ""),
                    "memberIds": doc.get("memberIds", []),
                    "adminIds": doc.get("adminIds", []),
                    "createdAt": doc.get("createdAt", 0)
                })

            chat_messages = []
            for doc in mdb.chat_messages.find({}, {"_id": 0}).sort("timestamp", 1):
                chat_messages.append({
                    "id": doc.get("id"),
                    "chatId": doc.get("chatId", ""),
                    "senderId": doc.get("senderId", ""),
                    "senderName": doc.get("senderName", ""),
                    "senderAvatar": doc.get("senderAvatar", ""),
                    "senderPhoto": doc.get("senderPhoto", ""),
                    "text": doc.get("text", ""),
                    "attachments": doc.get("attachments", []),
                    "replyTo": doc.get("replyTo"),
                    "reactions": doc.get("reactions", {}),
                    "timestamp": doc.get("timestamp", 0)
                })

            return {
                "lastUpdate": last_update,
                "accounts": accounts,
                "courses": courses,
                "announcements": announcements,
                "assignments": assignments,
                "chats": chats,
                "chatMessages": chat_messages
            }
        except Exception as e:
            print(f"[WARN] MongoDB build payload failed: {e}", file=sys.stderr)

    # SQLite Payload Fallback
    with db_lock:
        conn = get_sqlite_conn()
        try:
            last_update = get_last_update()

            cur = conn.execute("SELECT * FROM accounts ORDER BY created_at ASC")
            accounts = []
            for r in cur.fetchall():
                accounts.append({
                    "id": r['id'],
                    "name": r['name'],
                    "email": r['email'],
                    "password": r['password'],
                    "role": r['role'],
                    "avatar": r['avatar'] or '',
                    "bg": r['bg'] or 'from-blue-600 to-indigo-600',
                    "photoUrl": r['photo_url'] or '',
                    "banner": r['banner'] or ''
                })

            cur = conn.execute("SELECT * FROM courses ORDER BY created_at DESC")
            courses = []
            for r in cur.fetchall():
                cid = r['id']
                m_cur = conn.execute("SELECT user_id, role FROM course_members WHERE course_id = ?", (cid,))
                student_ids = []
                co_teacher_ids = []
                for m in m_cur.fetchall():
                    if m['role'] == 'student':
                        student_ids.append(m['user_id'])
                    elif m['role'] == 'co_teacher':
                        co_teacher_ids.append(m['user_id'])
                
                courses.append({
                    "id": cid,
                    "name": r['name'],
                    "section": r['section'] or '',
                    "subject": r['subject'] or '',
                    "description": r['description'] or '',
                    "code": r['code'],
                    "gradient": r['gradient'] or 'from-blue-600 to-indigo-700',
                    "banner": r['banner'] or '',
                    "teacherId": r['teacher_id'] or '',
                    "isArchived": bool(r['is_archived']) if 'is_archived' in r.keys() else False,
                    "coTeacherIds": co_teacher_ids,
                    "studentIds": student_ids
                })

            cur = conn.execute("SELECT * FROM announcements ORDER BY created_at DESC")
            announcements = []
            for r in cur.fetchall():
                aid = r['id']
                c_cur = conn.execute("SELECT * FROM announcement_comments WHERE announcement_id = ? ORDER BY created_at ASC", (aid,))
                comments = []
                for c in c_cur.fetchall():
                    comments.append({
                        "id": c['id'],
                        "authorName": c['author_name'] or '',
                        "authorAvatar": c['author_avatar'] or '',
                        "text": c['text'],
                        "date": c['date_str'] or 'Только что'
                    })
                
                attachments = []
                if r['attachments']:
                    try:
                        attachments = json.loads(r['attachments'])
                    except Exception:
                        attachments = []

                announcements.append({
                    "id": aid,
                    "courseId": r['course_id'],
                    "authorId": r['author_id'] or '',
                    "authorName": r['author_name'] or '',
                    "authorAvatar": r['author_avatar'] or '',
                    "date": r['date_str'] or 'Только что',
                    "body": r['body'],
                    "attachments": attachments,
                    "comments": comments
                })

            cur = conn.execute("SELECT * FROM assignments ORDER BY created_at DESC")
            assignments = []
            for r in cur.fetchall():
                as_id = r['id']

                s_cur = conn.execute("SELECT * FROM assignment_submissions WHERE assignment_id = ?", (as_id,))
                submissions = {}
                for s in s_cur.fetchall():
                    s_files = []
                    if s['files']:
                        try:
                            s_files = json.loads(s['files'])
                        except Exception:
                            s_files = []
                    submissions[s['student_id']] = {
                        "files": s_files,
                        "link": s['link'] or '',
                        "submittedAt": s['submitted_at'] or 0,
                        "status": s['status'] or 'assigned',
                        "grade": s['grade']
                    }

                c_cur = conn.execute("SELECT * FROM assignment_comments WHERE assignment_id = ? ORDER BY created_at ASC", (as_id,))
                comments = []
                for c in c_cur.fetchall():
                    comments.append({
                        "id": c['id'],
                        "authorName": c['author_name'] or '',
                        "authorAvatar": c['author_avatar'] or '',
                        "text": c['text'],
                        "date": c['date_str'] or 'Только что'
                    })

                p_cur = conn.execute("SELECT * FROM assignment_private_comments WHERE assignment_id = ? ORDER BY created_at ASC", (as_id,))
                p_comments = []
                for p in p_cur.fetchall():
                    p_comments.append({
                        "id": p['id'],
                        "studentId": p['student_id'],
                        "authorName": p['author_name'] or '',
                        "authorAvatar": p['author_avatar'] or '',
                        "text": p['text'],
                        "date": p['date_str'] or 'Только что'
                    })

                as_att = []
                if r['attachments']:
                    try:
                        as_att = json.loads(r['attachments'])
                    except Exception:
                        as_att = []

                assignments.append({
                    "id": as_id,
                    "courseId": r['course_id'],
                    "title": r['title'],
                    "instructions": r['instructions'] or '',
                    "points": r['points'] if r['points'] is not None else 100,
                    "deadline": r['deadline'] or 'Без срока',
                    "topic": r['topic'] or '',
                    "attachments": as_att,
                    "submissions": submissions,
                    "comments": comments,
                    "privateComments": p_comments
                })

            cur = conn.execute("SELECT * FROM chats ORDER BY created_at DESC")
            chats = []
            for r in cur.fetchall():
                cid = r['id']
                m_cur = conn.execute("SELECT user_id, is_admin FROM chat_members WHERE chat_id = ?", (cid,))
                member_ids = []
                admin_ids = []
                for m in m_cur.fetchall():
                    member_ids.append(m['user_id'])
                    if m['is_admin']:
                        admin_ids.append(m['user_id'])
                
                chats.append({
                    "id": cid,
                    "type": r['type'],
                    "name": r['name'],
                    "description": r['description'] or '',
                    "avatar": r['avatar'] or ('💬' if r['type'] != 'channel' else '📢'),
                    "bg": r['bg'] or 'from-sky-500 to-blue-600',
                    "photoUrl": r['photo_url'] or '',
                    "memberIds": member_ids,
                    "adminIds": admin_ids,
                    "createdAt": r['created_at'] or 0
                })

            cur = conn.execute("SELECT * FROM chat_messages ORDER BY timestamp ASC")
            chat_messages = []
            for r in cur.fetchall():
                msg_att = []
                if r['attachments']:
                    try:
                        msg_att = json.loads(r['attachments'])
                    except Exception:
                        msg_att = []
                
                reply_to = None
                if r['reply_to']:
                    try:
                        reply_to = json.loads(r['reply_to'])
                    except Exception:
                        reply_to = None

                reactions = {}
                if r['reactions']:
                    try:
                        reactions = json.loads(r['reactions'])
                    except Exception:
                        reactions = {}

                chat_messages.append({
                    "id": r['id'],
                    "chatId": r['chat_id'],
                    "senderId": r['sender_id'] or '',
                    "senderName": r['sender_name'] or '',
                    "senderAvatar": r['sender_avatar'] or '',
                    "senderPhoto": r['sender_photo'] or '',
                    "text": r['text'] or '',
                    "attachments": msg_att,
                    "replyTo": reply_to,
                    "reactions": reactions,
                    "timestamp": r['timestamp'] or 0
                })

            return {
                "lastUpdate": last_update,
                "accounts": accounts,
                "courses": courses,
                "announcements": announcements,
                "assignments": assignments,
                "chats": chats,
                "chatMessages": chat_messages
            }
        finally:
            conn.close()


# ----------------- DB OPERATIONS (MONGODB & SQLITE UNIFIED) -----------------

def register_account(acc):
    email = acc.get('email', '').strip().lower()
    name = acc.get('name', '').strip()
    now_ms = get_now_ms()
    acc_id = acc.get('id') or f"usr_{now_ms}"
    acc['id'] = acc_id
    acc['email'] = email
    acc['name'] = name
    acc['createdAt'] = now_ms
    acc['updatedAt'] = now_ms

    mdb = get_mongo_db()
    if mdb is not None:
        if mdb.accounts.find_one({"email": email}):
            return None, "Пользователь с таким email уже зарегистрирован"
        mdb.accounts.insert_one(dict(acc))
        touch_last_update()
        return acc, None

    with db_lock:
        conn = get_sqlite_conn()
        try:
            cur = conn.execute("SELECT id FROM accounts WHERE LOWER(email) = ?", (email,))
            if cur.fetchone():
                return None, "Пользователь с таким email уже зарегистрирован"
            with conn:
                conn.execute("""
                INSERT INTO accounts (id, name, email, password, role, avatar, bg, photo_url, banner, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (acc_id, name, email, acc.get('password', '123'), acc.get('role', 'student'),
                      acc.get('avatar', 'П'), acc.get('bg', 'from-blue-600 to-indigo-600'),
                      acc.get('photoUrl', ''), acc.get('banner', ''), now_ms, now_ms))
            touch_last_update()
            return acc, None
        finally:
            conn.close()

def update_account(acc_id, updates):
    now_ms = get_now_ms()
    updates['updatedAt'] = now_ms

    mdb = get_mongo_db()
    if mdb is not None:
        mdb.accounts.update_one({"id": acc_id}, {"$set": updates}, upsert=True)
        touch_last_update()
        return True

    with db_lock:
        conn = get_sqlite_conn()
        try:
            cur = conn.execute("SELECT * FROM accounts WHERE id = ?", (acc_id,))
            row = cur.fetchone()
            with conn:
                if not row:
                    conn.execute("""
                    INSERT INTO accounts (id, name, email, password, role, avatar, bg, photo_url, banner, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (acc_id, updates.get('name', 'Пользователь'), updates.get('email', 'user@school.local'),
                          updates.get('password', '123'), updates.get('role', 'student'), updates.get('avatar', 'П'),
                          updates.get('bg', 'from-blue-600 to-indigo-600'), updates.get('photoUrl', ''),
                          updates.get('banner', ''), now_ms, now_ms))
                else:
                    conn.execute("""
                    UPDATE accounts SET name = ?, email = ?, role = ?, avatar = ?, bg = ?, photo_url = ?, banner = ?, updated_at = ?
                    WHERE id = ?
                    """, (updates.get('name', row['name']), updates.get('email', row['email']),
                          updates.get('role', row['role']), updates.get('avatar', row['avatar']),
                          updates.get('bg', row['bg']), updates.get('photoUrl', row['photo_url']),
                          updates.get('banner', row['banner']), now_ms, acc_id))
            touch_last_update()
            return True
        finally:
            conn.close()

def create_course(course):
    now_ms = get_now_ms()
    cid = course.get('id') or f"course_{now_ms}"
    course['id'] = cid
    course['createdAt'] = now_ms
    course['updatedAt'] = now_ms
    course['isArchived'] = bool(course.get('isArchived', False))
    course.setdefault('coTeacherIds', [])
    course.setdefault('studentIds', [])

    mdb = get_mongo_db()
    if mdb is not None:
        mdb.courses.insert_one(dict(course))
        touch_last_update()
        return course

    with db_lock:
        conn = get_sqlite_conn()
        try:
            with conn:
                conn.execute("""
                INSERT INTO courses (id, name, section, subject, description, code, gradient, banner, teacher_id, is_archived, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (cid, course.get('name'), course.get('section', ''), course.get('subject', ''),
                      course.get('description', ''), course.get('code'), course.get('gradient', 'from-blue-600 to-indigo-700'),
                      course.get('banner', ''), course.get('teacherId', ''), 1 if course.get('isArchived') else 0, now_ms, now_ms))
                if course.get('teacherId'):
                    conn.execute("INSERT OR REPLACE INTO course_members (course_id, user_id, role) VALUES (?, ?, 'teacher')",
                                 (cid, course.get('teacherId')))
            touch_last_update()
            return course
        finally:
            conn.close()

def update_course(cid, updates):
    now_ms = get_now_ms()
    updates['updatedAt'] = now_ms

    mdb = get_mongo_db()
    if mdb is not None:
        mdb.courses.update_one({"id": cid}, {"$set": updates})
        touch_last_update()
        return True

    with db_lock:
        conn = get_sqlite_conn()
        try:
            cur = conn.execute("SELECT * FROM courses WHERE id = ?", (cid,))
            row = cur.fetchone()
            if not row:
                return False

            is_archived_val = updates.get('isArchived')
            if is_archived_val is None:
                is_archived_val = row['is_archived'] if 'is_archived' in row.keys() else 0
            else:
                is_archived_val = 1 if is_archived_val else 0

            with conn:
                conn.execute("""
                UPDATE courses SET name = ?, section = ?, subject = ?, description = ?, gradient = ?, banner = ?, is_archived = ?, updated_at = ?
                WHERE id = ?
                """, (updates.get('name', row['name']), updates.get('section', row['section']),
                      updates.get('subject', row['subject']), updates.get('description', row['description']),
                      updates.get('gradient', row['gradient']), updates.get('banner', row['banner']),
                      is_archived_val, now_ms, cid))
            touch_last_update()
            return True
        finally:
            conn.close()

def delete_course(cid):
    mdb = get_mongo_db()
    if mdb is not None:
        mdb.courses.delete_one({"id": cid})
        mdb.announcements.delete_many({"courseId": cid})
        mdb.assignments.delete_many({"courseId": cid})
        touch_last_update()
        return True

    with db_lock:
        conn = get_sqlite_conn()
        try:
            with conn:
                conn.execute("DELETE FROM courses WHERE id = ?", (cid,))
                conn.execute("DELETE FROM course_members WHERE course_id = ?", (cid,))
                conn.execute("DELETE FROM announcements WHERE course_id = ?", (cid,))
                conn.execute("DELETE FROM assignments WHERE course_id = ?", (cid,))
            touch_last_update()
            return True
        finally:
            conn.close()

def join_course_by_code(code, user_id):
    code = code.strip().upper()
    mdb = get_mongo_db()
    if mdb is not None:
        course = mdb.courses.find_one({"code": code})
        if not course:
            return None, "Курс с таким кодом не найден"
        if user_id in course.get("studentIds", []) or course.get("teacherId") == user_id:
            return course, None
        mdb.courses.update_one({"id": course["id"]}, {"$addToSet": {"studentIds": user_id}})
        touch_last_update()
        return course, None

    with db_lock:
        conn = get_sqlite_conn()
        try:
            cur = conn.execute("SELECT * FROM courses WHERE UPPER(code) = ?", (code,))
            row = cur.fetchone()
            if not row:
                return None, "Курс с таким кодом не найден"
            cid = row['id']
            with conn:
                conn.execute("INSERT OR IGNORE INTO course_members (course_id, user_id, role) VALUES (?, ?, 'student')", (cid, user_id))
            touch_last_update()
            return dict(row), None
        finally:
            conn.close()

def add_course_teacher(course_id, teacher_id):
    if not course_id or not teacher_id:
        return False, "Параметры не указаны"

    mdb = get_mongo_db()
    if mdb is not None:
        course = mdb.courses.find_one({"id": course_id})
        if not course:
            return False, "Курс не найден"
        mdb.courses.update_one({"id": course_id}, {"$addToSet": {"coTeacherIds": teacher_id}})
        touch_last_update()
        return True, None

    with db_lock:
        conn = get_sqlite_conn()
        try:
            cur = conn.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
            row = cur.fetchone()
            if not row:
                return False, "Курс не найден"
            with conn:
                # Remove from student if was student, and insert as co_teacher
                conn.execute("DELETE FROM course_members WHERE course_id = ? AND user_id = ?", (course_id, teacher_id))
                conn.execute("INSERT INTO course_members (course_id, user_id, role) VALUES (?, ?, 'co_teacher')", (course_id, teacher_id))
            touch_last_update()
            return True, None
        finally:
            conn.close()

def create_announcement(ann):
    now_ms = get_now_ms()
    aid = ann.get('id') or f"ann_{now_ms}"
    ann['id'] = aid
    ann['createdAt'] = now_ms
    ann.setdefault('comments', [])
    ann.setdefault('attachments', [])

    mdb = get_mongo_db()
    if mdb is not None:
        mdb.announcements.insert_one(dict(ann))
        touch_last_update()
        return ann

    with db_lock:
        conn = get_sqlite_conn()
        try:
            with conn:
                conn.execute("""
                INSERT INTO announcements (id, course_id, author_id, author_name, author_avatar, date_str, body, attachments, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (aid, ann.get('courseId'), ann.get('authorId', ''), ann.get('authorName', ''),
                      ann.get('authorAvatar', ''), ann.get('date', 'Только что'), ann.get('body', ''),
                      json.dumps(ann.get('attachments', []), ensure_ascii=False), now_ms))
            touch_last_update()
            return ann
        finally:
            conn.close()

def add_announcement_comment(aid, comment):
    now_ms = get_now_ms()
    cid = comment.get('id') or f"ann_com_{now_ms}"
    comment['id'] = cid
    comment['createdAt'] = now_ms

    mdb = get_mongo_db()
    if mdb is not None:
        mdb.announcements.update_one({"id": aid}, {"$push": {"comments": comment}})
        touch_last_update()
        return comment

    with db_lock:
        conn = get_sqlite_conn()
        try:
            with conn:
                conn.execute("""
                INSERT INTO announcement_comments (id, announcement_id, author_name, author_avatar, text, date_str, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (cid, aid, comment.get('authorName', ''), comment.get('authorAvatar', ''),
                      comment.get('text', ''), comment.get('date', 'Только что'), now_ms))
            touch_last_update()
            return comment
        finally:
            conn.close()

def create_assignment(assign):
    now_ms = get_now_ms()
    as_id = assign.get('id') or f"assign_{now_ms}"
    assign['id'] = as_id
    assign['createdAt'] = now_ms
    assign['updatedAt'] = now_ms
    assign.setdefault('submissions', {})
    assign.setdefault('comments', [])
    assign.setdefault('privateComments', [])
    assign.setdefault('attachments', [])

    mdb = get_mongo_db()
    if mdb is not None:
        mdb.assignments.insert_one(dict(assign))
        touch_last_update()
        return assign

    with db_lock:
        conn = get_sqlite_conn()
        try:
            with conn:
                conn.execute("""
                INSERT INTO assignments (id, course_id, title, instructions, points, deadline, topic, attachments, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (as_id, assign.get('courseId'), assign.get('title', ''), assign.get('instructions', ''),
                      int(assign.get('points', 100)), assign.get('deadline', 'Без срока'), assign.get('topic', ''),
                      json.dumps(assign.get('attachments', []), ensure_ascii=False), now_ms, now_ms))
            touch_last_update()
            return assign
        finally:
            conn.close()

def submit_assignment(as_id, student_id, files=None, link=""):
    now_ms = get_now_ms()
    sub_data = {
        "files": files or [],
        "link": link or "",
        "submittedAt": now_ms,
        "status": "submitted",
        "grade": None
    }

    mdb = get_mongo_db()
    if mdb is not None:
        mdb.assignments.update_one({"id": as_id}, {"$set": {f"submissions.{student_id}": sub_data}})
        touch_last_update()
        return sub_data

    with db_lock:
        conn = get_sqlite_conn()
        try:
            with conn:
                conn.execute("""
                INSERT INTO assignment_submissions (assignment_id, student_id, files, link, submitted_at, status, grade)
                VALUES (?, ?, ?, ?, ?, 'submitted', NULL)
                ON CONFLICT(assignment_id, student_id) DO UPDATE SET
                    files = excluded.files,
                    link = excluded.link,
                    submitted_at = excluded.submitted_at,
                    status = 'submitted'
                """, (as_id, student_id, json.dumps(files or [], ensure_ascii=False), link, now_ms))
            touch_last_update()
            return sub_data
        finally:
            conn.close()

def grade_assignment(as_id, student_id, grade):
    mdb = get_mongo_db()
    if mdb is not None:
        mdb.assignments.update_one(
            {"id": as_id},
            {"$set": {f"submissions.{student_id}.grade": grade, f"submissions.{student_id}.status": "graded"}}
        )
        touch_last_update()
        return True

    with db_lock:
        conn = get_sqlite_conn()
        try:
            with conn:
                conn.execute("""
                UPDATE assignment_submissions SET grade = ?, status = 'graded'
                WHERE assignment_id = ? AND student_id = ?
                """, (grade, as_id, student_id))
            touch_last_update()
            return True
        finally:
            conn.close()

def create_chat(chat):
    now_ms = get_now_ms()
    cid = chat.get('id') or f"chat_{now_ms}"
    chat['id'] = cid
    chat['createdAt'] = now_ms
    chat.setdefault('memberIds', [])
    chat.setdefault('adminIds', [])

    mdb = get_mongo_db()
    if mdb is not None:
        mdb.chats.insert_one(dict(chat))
        touch_last_update()
        return chat

    with db_lock:
        conn = get_sqlite_conn()
        try:
            with conn:
                conn.execute("""
                INSERT INTO chats (id, type, name, description, avatar, bg, photo_url, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (cid, chat.get('type', 'direct'), chat.get('name', ''), chat.get('description', ''),
                      chat.get('avatar', '💬'), chat.get('bg', 'from-sky-500 to-blue-600'),
                      chat.get('photoUrl', ''), chat.get('createdBy', ''), now_ms))
                for uid in chat.get('memberIds', []):
                    is_admin = 1 if uid in chat.get('adminIds', []) else 0
                    conn.execute("INSERT OR REPLACE INTO chat_members (chat_id, user_id, is_admin) VALUES (?, ?, ?)",
                                 (cid, uid, is_admin))
            touch_last_update()
            return chat
        finally:
            conn.close()

def add_chat_message(msg):
    now_ms = get_now_ms()
    mid = msg.get('id') or f"msg_{now_ms}"
    msg['id'] = mid
    msg['timestamp'] = now_ms
    msg.setdefault('attachments', [])
    msg.setdefault('reactions', {})

    mdb = get_mongo_db()
    if mdb is not None:
        mdb.chat_messages.insert_one(dict(msg))
        touch_last_update()
        return msg

    with db_lock:
        conn = get_sqlite_conn()
        try:
            with conn:
                conn.execute("""
                INSERT INTO chat_messages (id, chat_id, sender_id, sender_name, sender_avatar, sender_photo, text, attachments, reply_to, reactions, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (mid, msg.get('chatId'), msg.get('senderId', ''), msg.get('senderName', ''),
                      msg.get('senderAvatar', ''), msg.get('senderPhoto', ''), msg.get('text', ''),
                      json.dumps(msg.get('attachments', []), ensure_ascii=False),
                      json.dumps(msg.get('replyTo'), ensure_ascii=False) if msg.get('replyTo') else None,
                      json.dumps(msg.get('reactions', {}), ensure_ascii=False), now_ms))
            touch_last_update()
            return msg
        finally:
            conn.close()

def get_user_settings(uid):
    mdb = get_mongo_db()
    if mdb is not None:
        doc = mdb.user_settings.find_one({"_id": uid})
        if doc and "settings" in doc:
            return doc["settings"]
        return {}

    with db_lock:
        conn = get_sqlite_conn()
        try:
            row = conn.execute("SELECT settings_json FROM user_settings WHERE user_id = ?", (uid,)).fetchone()
            if row and row['settings_json']:
                return json.loads(row['settings_json'])
            return {}
        except Exception:
            return {}
        finally:
            conn.close()

def save_user_settings(uid, settings):
    now_ms = get_now_ms()
    mdb = get_mongo_db()
    if mdb is not None:
        mdb.user_settings.update_one({"_id": uid}, {"$set": {"settings": settings, "updatedAt": now_ms}}, upsert=True)
        return True

    with db_lock:
        conn = get_sqlite_conn()
        try:
            with conn:
                conn.execute("""
                INSERT INTO user_settings (user_id, settings_json, updated_at) VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at
                """, (uid, json.dumps(settings, ensure_ascii=False), now_ms))
            return True
        finally:
            conn.close()

def get_status_counts():
    mdb = get_mongo_db()
    if mdb is not None:
        try:
            return {
                "accountsCount": mdb.accounts.count_documents({}),
                "coursesCount": mdb.courses.count_documents({}),
                "chatsCount": mdb.chats.count_documents({})
            }
        except Exception:
            pass

    with db_lock:
        conn = get_sqlite_conn()
        try:
            acc_cnt = conn.execute("SELECT COUNT(*) as cnt FROM accounts").fetchone()['cnt']
            crs_cnt = conn.execute("SELECT COUNT(*) as cnt FROM courses").fetchone()['cnt']
            cht_cnt = conn.execute("SELECT COUNT(*) as cnt FROM chats").fetchone()['cnt']
            return {"accountsCount": acc_cnt, "coursesCount": crs_cnt, "chatsCount": cht_cnt}
        finally:
            conn.close()
