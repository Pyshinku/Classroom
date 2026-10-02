import sqlite3
import time

conn = sqlite3.connect('classroom.db')
cur = conn.cursor()

# 1. Clear accounts
cur.execute("DELETE FROM accounts")
cur.execute("DELETE FROM user_settings")
cur.execute("DELETE FROM notifications")
cur.execute("DELETE FROM chat_members")
cur.execute("DELETE FROM chat_messages")
cur.execute("DELETE FROM chats")
cur.execute("DELETE FROM course_members")
cur.execute("DELETE FROM assignment_submissions")
cur.execute("DELETE FROM assignment_comments")
cur.execute("DELETE FROM assignment_private_comments")
cur.execute("DELETE FROM announcement_comments")

# Clear teacher_id from courses or retain courses for when user signs in
cur.execute("UPDATE courses SET teacher_id = ''")

# Update meta
ts = int(time.time() * 1000)
cur.execute("INSERT OR REPLACE INTO server_meta (key, value) VALUES ('lastUpdate', ?)", (str(ts),))

conn.commit()
print("All accounts, chat messages, submissions, and temporary user data cleared!")

cur.execute("SELECT count(*) FROM accounts")
print("Accounts in DB now:", cur.fetchone()[0])
conn.close()
