"""WebSocket router for real-time updates."""

from typing import List
import json
import asyncio
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accept and track a new connection."""
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        """Remove a connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal(self, message: dict, websocket: WebSocket):
        """Send a message to a specific client."""
        await websocket.send_json(message)

    async def broadcast(self, message: dict):
        """Broadcast a message to all connected clients."""
        disconnected = []
        for connection in self.active_connections:
            try:
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
    await manager.connect(websocket)

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
                # TODO: Implement subscription management
                await manager.send_personal({
                    "type": "subscribed",
                    "channels": message.get("channels", [])
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
