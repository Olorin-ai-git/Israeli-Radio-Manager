"""WebSocket router for real-time updates."""

import logging
from typing import List
import json
import asyncio
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections with subscription support."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        # Map of websocket to subscribed channels
        self.subscriptions: dict[WebSocket, set[str]] = {}

    async def connect(self, websocket: WebSocket):
        """Accept and track a new connection."""
        # Accept without origin validation - Cloud Run/production environment
        await websocket.accept()
        self.active_connections.append(websocket)
        self.subscriptions[websocket] = set()  # No subscriptions by default

    def disconnect(self, websocket: WebSocket):
        """Remove a connection and its subscriptions."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.subscriptions:
            del self.subscriptions[websocket]

    def subscribe(self, websocket: WebSocket, channels: List[str]):
        """Subscribe a connection to specific channels."""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].update(channels)

    def unsubscribe(self, websocket: WebSocket, channels: List[str]):
        """Unsubscribe a connection from specific channels."""
        if websocket in self.subscriptions:
            self.subscriptions[websocket] -= set(channels)

    def get_subscriptions(self, websocket: WebSocket) -> List[str]:
        """Get list of channels a websocket is subscribed to."""
        return list(self.subscriptions.get(websocket, set()))

    async def send_personal(self, message: dict, websocket: WebSocket):
        """Send a message to a specific client."""
        await websocket.send_json(message)

    async def broadcast(self, message: dict, channel: str = None):
        """
        Broadcast a message to connected clients.

        If channel is specified, only sends to clients subscribed to that channel.
        If channel is None, sends to all connected clients.
        """
        disconnected = []
        for connection in self.active_connections:
            try:
                # If channel specified, check if client is subscribed
                if channel:
                    client_channels = self.subscriptions.get(connection, set())
                    # Send if subscribed to this channel or to "all"
                    if channel in client_channels or "all" in client_channels or not client_channels:
                        await connection.send_json(message)
                else:
                    # No channel filter - send to everyone
                    await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn)


# Global connection manager
manager = ConnectionManager()


@router.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for real-time updates."""
    logger.info(f"WebSocket connection attempt from: {websocket.client}")
    logger.info(f"Headers: {dict(websocket.headers)}")
    logger.info(f"Query params: {dict(websocket.query_params)}")
    logger.info(f"Path params: {websocket.path_params}")

    # Try to accept without validation
    try:
        # Accept the WebSocket connection
        await websocket.accept()
        logger.info("WebSocket connection accepted successfully!")

        # Add to manager manually
        manager.active_connections.append(websocket)
        manager.subscriptions[websocket] = set()
    except Exception as e:
        logger.error(f"WebSocket accept failed: {type(e).__name__}: {e}")
        logger.error(f"Full error: {repr(e)}")
        raise

    # Send initial connection confirmation
    await manager.send_personal({
        "type": "connected",
        "timestamp": datetime.utcnow().isoformat()
    }, websocket)

    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_text()
            message = json.loads(data)

            # Handle different message types
            if message.get("type") == "ping":
                await manager.send_personal({
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat()
                }, websocket)

            elif message.get("type") == "subscribe":
                # Client subscribing to specific event types
                channels = message.get("channels", [])
                manager.subscribe(websocket, channels)
                await manager.send_personal({
                    "type": "subscribed",
                    "channels": manager.get_subscriptions(websocket)
                }, websocket)

            elif message.get("type") == "unsubscribe":
                # Client unsubscribing from event types
                channels = message.get("channels", [])
                manager.unsubscribe(websocket, channels)
                await manager.send_personal({
                    "type": "unsubscribed",
                    "channels": channels,
                    "remaining": manager.get_subscriptions(websocket)
                }, websocket)

            elif message.get("type") == "get_subscriptions":
                # Client requesting current subscriptions
                await manager.send_personal({
                    "type": "subscriptions",
                    "channels": manager.get_subscriptions(websocket)
                }, websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        manager.disconnect(websocket)


# Helper functions for broadcasting events (to be used by other parts of the app)

async def broadcast_playback_update(status: dict):
    """Broadcast playback status update."""
    await manager.broadcast({
        "type": "playback_update",
        "data": status,
        "timestamp": datetime.utcnow().isoformat()
    })


async def broadcast_confirmation_required(pending_action: dict):
    """Broadcast that a confirmation is required."""
    await manager.broadcast({
        "type": "confirmation_required",
        "data": pending_action,
        "timestamp": datetime.utcnow().isoformat()
    })


async def broadcast_agent_decision(decision: dict):
    """Broadcast an agent decision."""
    await manager.broadcast({
        "type": "agent_decision",
        "data": decision,
        "timestamp": datetime.utcnow().isoformat()
    })


async def broadcast_content_update(content: dict, action: str):
    """Broadcast content library update."""
    await manager.broadcast({
        "type": "content_update",
        "action": action,  # "added", "updated", "deleted"
        "data": content,
        "timestamp": datetime.utcnow().isoformat()
    })


async def broadcast_notification(message: str, level: str = "info"):
    """Broadcast a notification."""
    await manager.broadcast({
        "type": "notification",
        "message": message,
        "level": level,  # "info", "warning", "error", "success"
        "timestamp": datetime.utcnow().isoformat()
    })


async def broadcast_scheduled_playback(content: dict):
    """Broadcast that a scheduled content should start playing."""
    logger.info(f"Broadcasting scheduled_playback: {content.get('title', 'Unknown')} to {len(manager.active_connections)} clients")
    await manager.broadcast({
        "type": "scheduled_playback",
        "data": content,
        "timestamp": datetime.utcnow().isoformat()
    }, channel="playback")


async def broadcast_queue_tracks(tracks: list):
    """Broadcast multiple tracks to be added to the queue."""
    logger.info(f"Broadcasting queue_tracks: {len(tracks)} tracks to {len(manager.active_connections)} clients")
    await manager.broadcast({
        "type": "queue_tracks",
        "data": tracks,
        "timestamp": datetime.utcnow().isoformat()
    }, channel="playback")


async def broadcast_queue_update(queue: list):
    """Broadcast the full queue state to all clients."""
    logger.info(f"Broadcasting queue_update: {len(queue)} items to {len(manager.active_connections)} clients")
    await manager.broadcast({
        "type": "queue_update",
        "data": queue,
        "timestamp": datetime.utcnow().isoformat()
    }, channel="playback")


async def broadcast_calendar_update(action: str = "updated"):
    """Broadcast that calendar was updated (event added/modified/deleted)."""
    logger.info(f"Broadcasting calendar_update ({action}) to {len(manager.active_connections)} clients")
    await manager.broadcast({
        "type": "calendar_update",
        "action": action,
        "timestamp": datetime.utcnow().isoformat()
    }, channel="all")
