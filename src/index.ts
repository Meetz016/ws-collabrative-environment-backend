
interface Env {
	COLLABORATIVE_DOCUMENT: DurableObjectNamespace
}

// ✅ Cloudflare Worker Fetch Handler
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

	constructor(state: DurableObjectState) {
		this.state = state;
		this.clients = new Map();
	}

	async fetch(req: Request): Promise<Response> {
		if (req.headers.get("Upgrade") !== "websocket") {
			return new Response("Expected WebSocket", { status: 400 });
		}

		const { 0: client, 1: server } = new WebSocketPair();
		server.accept();
		const clientId = crypto.randomUUID(); // Generate a unique client ID
		this.clients.set(server, clientId);

		server.addEventListener("message", (event) => {
			const message = event.data;
			console.log("Received:", message);

			// Broadcast the message to all connected clients
			for (const [ws, id] of this.clients) {
				if (ws != server && ws.readyState === WebSocket.OPEN) {
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