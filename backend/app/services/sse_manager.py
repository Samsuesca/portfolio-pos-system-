"""
SSE (Server-Sent Events) Manager

Manages connections and broadcasts events to subscribed clients.
Used for real-time print queue notifications.
"""
import asyncio
import logging
from typing import Dict, Set
from uuid import UUID

logger = logging.getLogger(__name__)


class SSEManager:
    """
    Singleton manager for SSE connections.

    Maintains a registry of connected clients and provides
    methods to broadcast events to all subscribers.
    """

    def __init__(self):
        # Map of user_id -> set of asyncio.Queue objects
        self._connections: Dict[UUID, Set[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, user_id: UUID) -> asyncio.Queue:
        """
        Subscribe a client to receive events.

        Returns an asyncio.Queue that will receive events.
        """
        queue: asyncio.Queue = asyncio.Queue()

        async with self._lock:
            if user_id not in self._connections:
                self._connections[user_id] = set()
            self._connections[user_id].add(queue)
            total_connections = sum(len(q) for q in self._connections.values())
            logger.info(
                f"SSE: User {user_id} subscribed. "
                f"User connections: {len(self._connections[user_id])}, "
                f"Total: {total_connections}"
            )

        return queue

    async def unsubscribe(self, user_id: UUID, queue: asyncio.Queue):
        """Remove a client's subscription"""
        async with self._lock:
            if user_id in self._connections:
                self._connections[user_id].discard(queue)
                if not self._connections[user_id]:
                    del self._connections[user_id]
                logger.info(f"SSE: User {user_id} unsubscribed")

    async def broadcast_to_user(self, user_id: UUID, event_type: str, data: dict):
        """Send an event to a specific user's connections"""
        async with self._lock:
            if user_id not in self._connections:
                return

            event_data = {
                "event": event_type,
                "data": data
            }

            for queue in self._connections[user_id]:
                try:
                    await queue.put(event_data)
                except Exception as e:
                    logger.error(f"SSE: Error sending to user {user_id}: {e}")

    async def broadcast_to_all(self, event_type: str, data: dict):
        """Broadcast an event to all connected clients"""
        async with self._lock:
            event_data = {
                "event": event_type,
                "data": data
            }

            for user_id, queues in self._connections.items():
                for queue in queues:
                    try:
                        await queue.put(event_data)
                    except Exception as e:
                        logger.error(f"SSE: Error broadcasting to {user_id}: {e}")

    async def broadcast_print_queue_event(self, event_type: str, item_data: dict):
        """
        Broadcast a print queue event to all connected clients.

        event_type: "new_sale", "item_updated", "queue_cleared"
        """
        await self.broadcast_to_all(f"print_queue:{event_type}", item_data)
        logger.debug(f"SSE: Broadcast print_queue:{event_type}")

    def get_connection_count(self) -> int:
        """Get total number of connected clients"""
        return sum(len(queues) for queues in self._connections.values())

    def get_user_count(self) -> int:
        """Get number of unique connected users"""
        return len(self._connections)


# Singleton instance
sse_manager = SSEManager()
