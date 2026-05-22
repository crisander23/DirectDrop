const http = require("http");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const port = Number(process.argv[2] || 8088);
const rooms = new Map();
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function createRoomId() {
  let id = "";

  do {
    id = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(id));

  return id;
}

function cleanupRooms() {
  const expiresBefore = Date.now() - 30 * 60 * 1000;

  for (const [id, room] of rooms) {
    if (room.updatedAt < expiresBefore) {
      rooms.delete(id);
    }
  }
}

async function handleApi(request, response, url) {
  if (request.method === "POST" && url.pathname === "/api/rooms") {
    const body = await readJson(request);

    if (!body.offer) {
      sendJson(response, 400, { error: "Missing offer" });
      return;
    }

    cleanupRooms();

    const id = createRoomId();
    rooms.set(id, {
      answer: null,
      createdAt: Date.now(),
      offer: body.offer,
      updatedAt: Date.now(),
    });
    sendJson(response, 200, { roomId: id });
    return;
  }

  const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})$/);

  if (!match) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  const id = match[1];
  const room = rooms.get(id);

  if (!room) {
    sendJson(response, 404, { error: "Room not found" });
    return;
  }

  room.updatedAt = Date.now();

  if (request.method === "GET") {
    sendJson(response, 200, { answer: room.answer, offer: room.offer, roomId: id });
    return;
  }

  if (request.method === "POST") {
    const body = await readJson(request);

    if (!body.answer) {
      sendJson(response, 400, { error: "Missing answer" });
      return;
    }

    room.answer = body.answer;
    room.updatedAt = Date.now();
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    handleApi(request, response, url).catch((error) => {
      sendJson(response, 500, { error: error.message });
    });
    return;
  }

  const requestedPath = url.pathname === "/" ? "index.html" : url.pathname;
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(data);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`DirectDrop running at http://0.0.0.0:${port}`);
});
