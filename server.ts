import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { initSocketServer } from "@/sockets/server";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((request, response) => {
    handle(request, response);
  });

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;

  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin || !configuredOrigin || origin === configuredOrigin || dev) {
          callback(null, true);
          return;
        }

        callback(null, configuredOrigin);
      },
      credentials: true,
    },
  });

  initSocketServer(io);

  httpServer.listen(port, hostname, () => {
    console.log(`Track TDR listening on http://${hostname}:${port}`);
    console.log(`Open the app at http://localhost:${port}`);
    if (hostname === "0.0.0.0") {
      console.log("Mobile/LAN: use http://<your-machine-ip>:3000 on the same Wi-Fi");
    }
  });
});
