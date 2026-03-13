import sqlite3
import json
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "pgmais.db"

def init_db():
    """Inicializa banco de dados SQLite"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('''CREATE TABLE IF NOT EXISTS cache (
        id INTEGER PRIMARY KEY,
        key TEXT UNIQUE,
        value TEXT,
        expires_at REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS bus (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE,
        members TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS priority_requests (
        id INTEGER PRIMARY KEY,
        issue_key TEXT UNIQUE,
        priority TEXT,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    conn.commit()
    conn.close()

def get_cache(key: str):
    """Obtém valor do cache"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('SELECT value, expires_at FROM cache WHERE key = ?', (key,))
    result = c.fetchone()
    conn.close()
    
    if result:
        value, expires_at = result
        if expires_at is None or datetime.now().timestamp() < expires_at:
            return json.loads(value)
    return None

def set_cache(key: str, value, ttl: int = None):
    """Define valor no cache"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    expires_at = None
    if ttl:
        expires_at = datetime.now().timestamp() + ttl
    
    c.execute('''INSERT OR REPLACE INTO cache (key, value, expires_at) 
                 VALUES (?, ?, ?)''',
              (key, json.dumps(value), expires_at))
    conn.commit()
    conn.close()

def get_bus():
    """Obtém todas as BUs"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('SELECT name, members FROM bus')
    results = c.fetchall()
    conn.close()
    
    return [{"name": r[0], "members": json.loads(r[1])} for r in results]

def save_bus(bus_list):
    """Salva BUs"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('DELETE FROM bus')
    for bu in bus_list:
        c.execute('''INSERT INTO bus (name, members) VALUES (?, ?)''',
                  (bu["name"], json.dumps(bu.get("members", []))))
    
    conn.commit()
    conn.close()

def get_priority_requests():
    """Obtém requisições de priorização"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('SELECT issue_key, priority, reason FROM priority_requests')
    results = c.fetchall()
    conn.close()
    
    return [{"issue_key": r[0], "priority": r[1], "reason": r[2]} for r in results]

def save_priority_request(issue_key: str, priority: str, reason: str):
    """Salva requisição de priorização"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('''INSERT OR REPLACE INTO priority_requests (issue_key, priority, reason) 
                 VALUES (?, ?, ?)''',
              (issue_key, priority, reason))
    conn.commit()
    conn.close()

def clear_expired_cache():
    """Remove cache expirado"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('''DELETE FROM cache WHERE expires_at IS NOT NULL 
                 AND expires_at < ?''', (datetime.now().timestamp(),))
    conn.commit()
    conn.close()
