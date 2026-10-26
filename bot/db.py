"""Kanallar va yuborilgan reklamalarni saqlash uchun oddiy SQLite ombori."""

import sqlite3
import time
from pathlib import Path


class DB:
    def __init__(self, path: str):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS channels (
                chat_id   INTEGER PRIMARY KEY,
                title     TEXT,
                username  TEXT,
                active    INTEGER NOT NULL DEFAULT 1,
                added_at  INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS broadcasts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id    INTEGER NOT NULL,
                created_at  INTEGER NOT NULL,
                ok          INTEGER NOT NULL DEFAULT 0,
                failed      INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS sent_messages (
                broadcast_id  INTEGER NOT NULL,
                chat_id       INTEGER NOT NULL,
                message_id    INTEGER NOT NULL
            );
            """
        )
        self.conn.commit()

    # --- kanallar ---

    def upsert_channel(self, chat_id: int, title: str | None, username: str | None) -> None:
        self.conn.execute(
            """
            INSERT INTO channels (chat_id, title, username, active, added_at)
            VALUES (?, ?, ?, 1, ?)
            ON CONFLICT(chat_id) DO UPDATE SET
                title = excluded.title, username = excluded.username, active = 1
            """,
            (chat_id, title, username, int(time.time())),
        )
        self.conn.commit()

    def deactivate_channel(self, chat_id: int) -> bool:
        cur = self.conn.execute(
            "UPDATE channels SET active = 0 WHERE chat_id = ? AND active = 1", (chat_id,)
        )
        self.conn.commit()
        return cur.rowcount > 0

    def active_channels(self) -> list[sqlite3.Row]:
        return self.conn.execute(
            "SELECT * FROM channels WHERE active = 1 ORDER BY added_at"
        ).fetchall()

    def count_active(self) -> int:
        return self.conn.execute("SELECT COUNT(*) FROM channels WHERE active = 1").fetchone()[0]

    # --- reklamalar ---

    def create_broadcast(self, admin_id: int) -> int:
        cur = self.conn.execute(
            "INSERT INTO broadcasts (admin_id, created_at) VALUES (?, ?)",
            (admin_id, int(time.time())),
        )
        self.conn.commit()
        return cur.lastrowid

    def finish_broadcast(self, broadcast_id: int, ok: int, failed: int) -> None:
        self.conn.execute(
            "UPDATE broadcasts SET ok = ?, failed = ? WHERE id = ?", (ok, failed, broadcast_id)
        )
        self.conn.commit()

    def add_sent(self, broadcast_id: int, chat_id: int, message_ids: list[int]) -> None:
        self.conn.executemany(
            "INSERT INTO sent_messages (broadcast_id, chat_id, message_id) VALUES (?, ?, ?)",
            [(broadcast_id, chat_id, mid) for mid in message_ids],
        )
        self.conn.commit()

    def last_broadcast_with_messages(self) -> sqlite3.Row | None:
        return self.conn.execute(
            """
            SELECT b.* FROM broadcasts b
            WHERE EXISTS (SELECT 1 FROM sent_messages s WHERE s.broadcast_id = b.id)
            ORDER BY b.id DESC LIMIT 1
            """
        ).fetchone()

    def sent_messages(self, broadcast_id: int) -> dict[int, list[int]]:
        rows = self.conn.execute(
            "SELECT chat_id, message_id FROM sent_messages WHERE broadcast_id = ?",
            (broadcast_id,),
        ).fetchall()
        result: dict[int, list[int]] = {}
        for row in rows:
            result.setdefault(row["chat_id"], []).append(row["message_id"])
        return result

    def forget_sent(self, broadcast_id: int) -> None:
        self.conn.execute("DELETE FROM sent_messages WHERE broadcast_id = ?", (broadcast_id,))
        self.conn.commit()
