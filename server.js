// server.js (ES module)
import express from "express";
import fs from 'fs';
const app = express();
app.use(express.json({ limit: "2mb" }));

// ---------------------------
// Debug logger
// ---------------------------
const log = (...args) => console.debug("[MCP]", ...args);

// ---------------------------
// Combined /mcp endpoint
// ---------------------------
app.all("/mcp", (req, res) => {
  log("HTTP", req.method, req.url);

  if (req.method === "GET") {
    log("SSE client connected");
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.flushHeaders();
    res.write("retry: 2000\n\n");
    const initialized = {
      jsonrpc: "2.0",
      method: "initialized",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "abereifed", version: "1.0.0" },
      },
    };
    res.write("data: " + JSON.stringify(initialized) + "\n\n");
    res.flush?.();
    const onClose = () => log("SSE client disconnected");
    req.on("close", onClose);
    res.on("close", onClose);
    res.on("end", onClose);
  }

  else if (req.method === "POST") {
    const msg = req.body;
    log("RPC received:", JSON.stringify(msg, null, 2));
    const reply = (result) => {
      const out = { jsonrpc: "2.0", id: msg.id, ...result };
      log("RPC reply:", JSON.stringify(out, null, 2));
      res.json(out);
    };
	switch(msg.method){
		case  "initialize": {
			return reply({
			  result: {
				protocolVersion: msg.params.protocolVersion,
				capabilities: {},
				serverInfo: { name: "abereifed", version: "1.0.0" },
			  },
			});
		} break;
		case "notifications/initialized":
		case "notifications/cancelled": {
		  // just acknowledge; no action needed
		  return reply({}); // empty JSON-RPC reply is fine
		}
		break;
		case "tools/list": {
		  return reply({
			result: {
			  tools: [
				{
				  name: "get_weather",
				  description: "Get current weather by latitude/longitude",
				  inputSchema: {
					type: "object",
					properties: {
					  latitude: { type: "number" },
					  longitude: { type: "number" },
					},
					required: ["latitude", "longitude"],
				  },
				},
			  ],
			},
		  });
		} break;
		case "tools/call": {
		  const { name, arguments: args } = msg.params;
		  if (name === "get_weather") {
			const weather = {
			  latitude: args.latitude,
			  longitude: args.longitude,
			  description: "just so fucking sunny",
			  temperatureC: 7.2,
			  windKph: 13
			};
			return reply({result: {content: [{type: "text",text:JSON.stringify(weather)}]}});
		  }
		} break;
		default:{
			return reply({
			  error: { code: -32601, message: "Method not found" },
			});
		}
	}
  }
  else {
    res.status(405).send("Method Not Allowed");
  }
});

// ---------------------------
// Start server
// ---------------------------
const PORT = 3000;
app.listen(PORT, () => log(`MCP server running on http://localhost:${PORT}`));
