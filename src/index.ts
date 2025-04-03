
interface Env {
	COLLABORATIVE_DOCUMENT: DurableObjectNamespace
}
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === "/websocket") {
			const id = env.COLLABORATIVE_DOCUMENT.idFromName("collaborative-document");
			const obj = env.COLLABORATIVE_DOCUMENT.get(id);
			return obj.fetch(request);
		}
		return new Response("Hello World!", { status: 200 });
	},
} satisfies ExportedHandler<Env>;



export class CollaborativeDocument {
	state: DurableObjectState;
	clients: Map<WebSocket, string>;
	intervalId: any;
	messageDelay: number = 3000; // Store delay in class instead of global variable
	constructor(state: DurableObjectState) {
		this.state = state;
		this.clients = new Map();
	}
	startMessageStream(server: WebSocket) {
		if (this.intervalId) clearInterval(this.intervalId);
		this.intervalId = setInterval(() => {
			if (server.readyState === WebSocket.OPEN) {
				server.send(`Hi with delay of ${this.messageDelay}`);
			}
		}, this.messageDelay);
	}
	restartMessageStream(server: WebSocket) {
		this.startMessageStream(server);
	}
	async fetch(req: Request): Promise<Response> {
		if (req.headers.get("Upgrade") !== "websocket") {
			return new Response("Expected WebSocket", { status: 400 });
		}
		const { 0: client, 1: server } = new WebSocketPair();
		server.accept();
		this.startMessageStream(server);

		const clientId = crypto.randomUUID(); // Generate a unique client ID
		this.clients.set(server, clientId);

		server.addEventListener("message", (event) => {
			const message = event.data;
			const newDelay = parseInt(message.toString());
			if (!Number.isNaN(newDelay) && newDelay > 0) {
				this.messageDelay = newDelay;
				this.restartMessageStream(server); // ✅ Restart interval with new delay
			}
			// Broadcast the message to all connected clients
			for (const [ws, id] of this.clients) {
				if (ws !== server && ws.readyState === WebSocket.OPEN) {
					ws.send(message);
				}
			}
		});

		server.addEventListener("close", () => {
			this.clients.delete(server);
		});

		return new Response(null, { status: 101, webSocket: client });
	}
}