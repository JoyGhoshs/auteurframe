from __future__ import annotations

import asyncio
import json
import time
from collections import deque
from typing import Any

from . import config


class EventBus:
    def __init__(self) -> None:
        self.subscribers: dict[str, set[asyncio.Queue]] = {}
        self.history: dict[str, deque] = {}
        self.loop: asyncio.AbstractEventLoop | None = None
        self.seq = 0

    def bind(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop

    def publish(self, channel: str, kind: str, data: dict[str, Any] | None = None, persist: bool = True) -> dict[str, Any]:
        self.seq += 1
        event = {"seq": self.seq, "t": round(time.time(), 3), "channel": channel, "kind": kind, "data": data or {}}
        heavy = kind in ("render.preview", "browse.frame", "agent.token")
        if not heavy:
            self.history.setdefault(channel, deque(maxlen=600)).append(event)
        if persist and not heavy:
            try:
                with open(config.DATA / "events.jsonl", "a", encoding="utf-8") as handle:
                    handle.write(json.dumps(event, ensure_ascii=False)[:4000] + "\n")
            except OSError:
                pass
        for target in (channel, "*"):
            for queue in list(self.subscribers.get(target, ())):
                self._deliver(queue, event)
        return event

    def _deliver(self, queue: asyncio.Queue, event: dict[str, Any]) -> None:
        def put() -> None:
            if queue.qsize() > 2000:
                return
            queue.put_nowait(event)
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if self.loop and running is not self.loop:
            self.loop.call_soon_threadsafe(put)
        else:
            put()

    def subscribe(self, channel: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self.subscribers.setdefault(channel, set()).add(queue)
        return queue

    def unsubscribe(self, channel: str, queue: asyncio.Queue) -> None:
        self.subscribers.get(channel, set()).discard(queue)

    def recent(self, channel: str, limit: int = 300) -> list[dict[str, Any]]:
        return list(self.history.get(channel, ()))[-limit:]


bus = EventBus()
