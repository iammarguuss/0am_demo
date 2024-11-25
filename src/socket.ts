import io, { Socket } from "socket.io-client";

export class SocketApi {
  static instance?: Socket;

  static createConnection(key?: string): Socket {
    const socket = io(import.meta.env.VITE_SERVER_URL, {
      query: {
        key,
      },
    });

    socket.on("connect", () => {
      this.instance = socket;
    });

    socket.on("disconnect", () => {
      this.instance = undefined;
    });

    if (import.meta.env.MODE === "dev") {
      socket.onAny((event, ...args) => {
        console.log("ANY: ", {
          socket: socket.id,
          event,
          args,
          instance: SocketApi.instance,
        });
      });
    }

    return socket;
  }
}
