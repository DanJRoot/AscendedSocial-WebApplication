// WebSocket handler for real-time Friends Watching updates
import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "http";

interface ViewingUpdate {
  type: "viewing_start" | "viewing_stop";
  userId: string;
  userName: string;
  userImage: string | null;
  contentId: number;
  contentType: "video" | "post";
}

const connectedClients = new Map<string, WebSocket>();

export function setupFriendsWatchingWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws/friends-watching" });

  wss.on("connection", (ws, req) => {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    connectedClients.set(clientId, ws);

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "viewing_start" || data.type === "viewing_stop") {
          // Broadcast to all connected clients
          broadcastViewingUpdate(data as ViewingUpdate, clientId);
        }
      } catch (error) {
        console.error("[WebSocket] Invalid message:", error);
      }
    });

    ws.on("close", () => {
      connectedClients.delete(clientId);
    });

    ws.on("error", (error) => {
      console.error("[WebSocket] Client error:", error);
      connectedClients.delete(clientId);
    });
  });

  console.log("[WebSocket] Friends Watching WebSocket server initialized");
}

function broadcastViewingUpdate(update: ViewingUpdate, excludeClient: string): void {
  const message = JSON.stringify(update);

  for (const [clientId, ws] of Array.from(connectedClients.entries())) {
    if (clientId !== excludeClient && ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}

export function broadcastWatchStart(
  userId: string,
  userName: string,
  userImage: string | null,
  contentId: number,
  contentType: "video" | "post"
): void {
  const update: ViewingUpdate = {
    type: "viewing_start",
    userId,
    userName,
    userImage,
    contentId,
    contentType,
  };

  const message = JSON.stringify(update);
  for (const ws of Array.from(connectedClients.values())) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}
