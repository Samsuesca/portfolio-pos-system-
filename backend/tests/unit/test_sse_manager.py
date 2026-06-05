"""
Tests for SSEManager.

Covers:
- subscribe: returns Queue, adds to connections, multiple queues per user
- unsubscribe: removes queue, removes user key when empty
- broadcast_to_user: sends to correct user only, no-op if disconnected
- broadcast_to_all: sends to all connected users
- broadcast_print_queue_event: event prefix, delegates to broadcast_to_all
- get_connection_count: total across users
- get_user_count: unique users
"""
import asyncio
import uuid

import pytest

from app.services.sse_manager import SSEManager


def _uid() -> uuid.UUID:
    return uuid.uuid4()


# ---------------------------------------------------------------------------
# subscribe
# ---------------------------------------------------------------------------

class TestSubscribe:

    @pytest.mark.asyncio
    async def test_returns_queue(self):
        mgr = SSEManager()
        q = await mgr.subscribe(_uid())
        assert isinstance(q, asyncio.Queue)

    @pytest.mark.asyncio
    async def test_adds_to_connections(self):
        mgr = SSEManager()
        uid = _uid()
        await mgr.subscribe(uid)
        assert uid in mgr._connections
        assert len(mgr._connections[uid]) == 1

    @pytest.mark.asyncio
    async def test_multiple_queues_per_user(self):
        mgr = SSEManager()
        uid = _uid()
        q1 = await mgr.subscribe(uid)
        q2 = await mgr.subscribe(uid)
        assert len(mgr._connections[uid]) == 2
        assert q1 is not q2

    @pytest.mark.asyncio
    async def test_multiple_users(self):
        mgr = SSEManager()
        u1, u2 = _uid(), _uid()
        await mgr.subscribe(u1)
        await mgr.subscribe(u2)
        assert len(mgr._connections) == 2


# ---------------------------------------------------------------------------
# unsubscribe
# ---------------------------------------------------------------------------

class TestUnsubscribe:

    @pytest.mark.asyncio
    async def test_removes_queue(self):
        mgr = SSEManager()
        uid = _uid()
        q1 = await mgr.subscribe(uid)
        q2 = await mgr.subscribe(uid)

        await mgr.unsubscribe(uid, q1)

        assert q1 not in mgr._connections[uid]
        assert q2 in mgr._connections[uid]

    @pytest.mark.asyncio
    async def test_removes_user_key_when_empty(self):
        mgr = SSEManager()
        uid = _uid()
        q = await mgr.subscribe(uid)

        await mgr.unsubscribe(uid, q)

        assert uid not in mgr._connections

    @pytest.mark.asyncio
    async def test_noop_for_unknown_user(self):
        mgr = SSEManager()
        await mgr.unsubscribe(_uid(), asyncio.Queue())

    @pytest.mark.asyncio
    async def test_noop_for_unknown_queue(self):
        mgr = SSEManager()
        uid = _uid()
        await mgr.subscribe(uid)
        await mgr.unsubscribe(uid, asyncio.Queue())
        assert len(mgr._connections[uid]) == 1


# ---------------------------------------------------------------------------
# broadcast_to_user
# ---------------------------------------------------------------------------

class TestBroadcastToUser:

    @pytest.mark.asyncio
    async def test_sends_to_correct_user(self):
        mgr = SSEManager()
        u1, u2 = _uid(), _uid()
        q1 = await mgr.subscribe(u1)
        q2 = await mgr.subscribe(u2)

        await mgr.broadcast_to_user(u1, "test_event", {"key": "val"})

        assert not q1.empty()
        assert q2.empty()

        event = await q1.get()
        assert event["event"] == "test_event"
        assert event["data"] == {"key": "val"}

    @pytest.mark.asyncio
    async def test_sends_to_all_user_queues(self):
        mgr = SSEManager()
        uid = _uid()
        q1 = await mgr.subscribe(uid)
        q2 = await mgr.subscribe(uid)

        await mgr.broadcast_to_user(uid, "evt", {})

        assert not q1.empty()
        assert not q2.empty()

    @pytest.mark.asyncio
    async def test_noop_if_user_not_connected(self):
        mgr = SSEManager()
        await mgr.broadcast_to_user(_uid(), "evt", {"x": 1})


# ---------------------------------------------------------------------------
# broadcast_to_all
# ---------------------------------------------------------------------------

class TestBroadcastToAll:

    @pytest.mark.asyncio
    async def test_sends_to_all_users(self):
        mgr = SSEManager()
        u1, u2, u3 = _uid(), _uid(), _uid()
        q1 = await mgr.subscribe(u1)
        q2 = await mgr.subscribe(u2)
        q3 = await mgr.subscribe(u3)

        await mgr.broadcast_to_all("global_evt", {"msg": "hello"})

        for q in (q1, q2, q3):
            assert not q.empty()
            event = await q.get()
            assert event["event"] == "global_evt"
            assert event["data"]["msg"] == "hello"

    @pytest.mark.asyncio
    async def test_noop_no_connections(self):
        mgr = SSEManager()
        await mgr.broadcast_to_all("evt", {})


# ---------------------------------------------------------------------------
# broadcast_print_queue_event
# ---------------------------------------------------------------------------

class TestBroadcastPrintQueueEvent:

    @pytest.mark.asyncio
    async def test_prefixes_event_type(self):
        mgr = SSEManager()
        uid = _uid()
        q = await mgr.subscribe(uid)

        await mgr.broadcast_print_queue_event("new_sale", {"sale_id": "123"})

        event = await q.get()
        assert event["event"] == "print_queue:new_sale"
        assert event["data"]["sale_id"] == "123"

    @pytest.mark.asyncio
    async def test_delegates_to_broadcast_to_all(self):
        mgr = SSEManager()
        u1, u2 = _uid(), _uid()
        q1 = await mgr.subscribe(u1)
        q2 = await mgr.subscribe(u2)

        await mgr.broadcast_print_queue_event("item_updated", {"id": "x"})

        assert not q1.empty()
        assert not q2.empty()


# ---------------------------------------------------------------------------
# get_connection_count / get_user_count
# ---------------------------------------------------------------------------

class TestConnectionCounts:

    @pytest.mark.asyncio
    async def test_connection_count_empty(self):
        mgr = SSEManager()
        assert mgr.get_connection_count() == 0

    @pytest.mark.asyncio
    async def test_connection_count_multiple(self):
        mgr = SSEManager()
        u1, u2 = _uid(), _uid()
        await mgr.subscribe(u1)
        await mgr.subscribe(u1)
        await mgr.subscribe(u2)
        assert mgr.get_connection_count() == 3

    @pytest.mark.asyncio
    async def test_user_count_empty(self):
        mgr = SSEManager()
        assert mgr.get_user_count() == 0

    @pytest.mark.asyncio
    async def test_user_count(self):
        mgr = SSEManager()
        u1, u2 = _uid(), _uid()
        await mgr.subscribe(u1)
        await mgr.subscribe(u1)
        await mgr.subscribe(u2)
        assert mgr.get_user_count() == 2

    @pytest.mark.asyncio
    async def test_counts_after_unsubscribe(self):
        mgr = SSEManager()
        uid = _uid()
        q1 = await mgr.subscribe(uid)
        q2 = await mgr.subscribe(uid)

        await mgr.unsubscribe(uid, q1)

        assert mgr.get_connection_count() == 1
        assert mgr.get_user_count() == 1

        await mgr.unsubscribe(uid, q2)

        assert mgr.get_connection_count() == 0
        assert mgr.get_user_count() == 0
