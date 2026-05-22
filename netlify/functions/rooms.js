const ROOM_TTL_MS = 30 * 60 * 1000;

globalThis.directDropRooms ||= new Map();

const jsonHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function send(statusCode, payload) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  };
}

function cleanupRooms() {
  const expiresBefore = Date.now() - ROOM_TTL_MS;

  for (const [id, room] of globalThis.directDropRooms) {
    if (room.updatedAt < expiresBefore) {
      globalThis.directDropRooms.delete(id);
    }
  }
}

function createRoomId() {
  let id = "";

  do {
    id = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (globalThis.directDropRooms.has(id));

  return id;
}

function roomIdFromPath(path) {
  const parts = path.split("/").filter(Boolean);
  const id = parts[parts.length - 1];

  return /^[A-Z0-9]{6}$/.test(id) ? id : "";
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return send(200, { ok: true });
  }

  cleanupRooms();

  try {
    const roomId = roomIdFromPath(event.path);

    if (event.httpMethod === "POST" && !roomId) {
      const body = JSON.parse(event.body || "{}");

      if (!body.offer) {
        return send(400, { error: "Missing offer" });
      }

      const id = createRoomId();
      globalThis.directDropRooms.set(id, {
        answer: null,
        createdAt: Date.now(),
        offer: body.offer,
        updatedAt: Date.now(),
      });

      return send(200, { roomId: id });
    }

    if (!roomId) {
      return send(404, { error: "Room not found" });
    }

    const room = globalThis.directDropRooms.get(roomId);

    if (!room) {
      return send(404, { error: "Room not found" });
    }

    room.updatedAt = Date.now();

    if (event.httpMethod === "GET") {
      return send(200, { answer: room.answer, offer: room.offer, roomId });
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");

      if (!body.answer) {
        return send(400, { error: "Missing answer" });
      }

      room.answer = body.answer;
      room.updatedAt = Date.now();
      return send(200, { ok: true });
    }

    return send(405, { error: "Method not allowed" });
  } catch (error) {
    return send(500, { error: error.message || "Unexpected function error" });
  }
};
