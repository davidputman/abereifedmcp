// server.js (ES module)
import express from "express";
import fs from 'fs';
import path from 'path';

const projecsRoot = "d:/projects";

const log = (...args) => console.debug("[MCP]", ...args);

const initializeResponse = (msg)=>{
	return {
		result: {
			protocolVersion: msg.params.protocolVersion,
			capabilities: {},
			serverInfo: { name: "abereifed", version: "1.0.0" },
		}
	};
}
const methodNotFoundResponse = {
			  error: { code: -32601, message: "Method not found" },
			};
const tools = [
	{
		toolObject:{
			name: "cwd",
			description: "Get current working directory",
			inputSchema: {
				type: "object",
				properties: {},
				required: []
			}
		},
		func:(params)=>{
			log("called cwd tool",process.cwd());
			return {content: [{type: "text", text: process.cwd()}]};
		}
	},
	{
		toolObject:{
			name: "create folder",
			description: "create a new folder in the current working directory",
			inputSchema: {
				type: "object",
				properties: {
					folderName: {type: "string", description: "name of the new folder"}
				},
				required: ["folderName"]
			}
		},
		func:(params)=>{
			const folderPath = `${process.cwd()}/${params.folderName}`;
			log("called create folder tool",folderPath);
			if (!fs.existsSync(folderPath)){
				fs.mkdirSync(folderPath);
				return {content: [{type: "text", text: `Folder '${params.folderName}' created successfully.`}]};
			} else {
				return {content: [{type: "text", text: `Folder '${params.folderName}' already exists.`}]};
			}
		}
	},
	{
		toolObject:{
			name: "list folder contents",
			description: "lists the contents of the current working directory",
			inputSchema: {
				type: "object",
				properties: {
					folderName: {type: "string", description: "the folder to be listed"}
				},
				required: []		
			}
		},
		func:(params)=>{
			log("called list folder contents tool",params);
			const folderName = params.folderName || ".";
			const contents = fs.readdirSync(`${process.cwd()}/${params.folderName}`);
			return {content: [{type: "text", text: JSON.stringify(contents)}]};
		}
	},
	{
		toolObject:{
			name: "write file",
			description: "writes to a file in the current working directory",
			inputSchema: {
				type: "object",
				properties: {
					filename: {type: "string", description: "name of the file to be written to"},
					filecontents: {type: "string", description: "text to be written to the file"}
				},
				required: []
			}
		},
		func:(params)=>{
			log(params);
			const fullPath = `${process.cwd()}/${params.filename}`;
			const fileContents = params.filecontents || "";
			log("called write file tool",fullPath);
			try {
				fs.access(fullPath, fs.constants.F_OK, (err) => {
					if (err) {
						fs.writeFile(fullPath, fileContents, (err) => {
							if (err) {
								console.error(`Error writing to the file: ${err}`);
								return;
							}
							console.log(`File created and written successfully.`);
						});
					} else {
						// File exists, open it in write mode
						fs.open(fullPath, 'w', (err, fd) => {
							if (err) {
								console.error(`Error opening the file: ${err}`);
								return;
							}
							// Write to the file using the file descriptor
							fs.write(fd, fileContents, 0, fileContents.length, (err) => {
								if (err) {
									console.error(`Error writing to the file: ${err}`);
								} else {
									console.log('File written successfully.');
								}
								fs.close(fd, err => {
									if (err) {
										console.error(`Error closing the file: ${err}`);
									}
								});
							});
						});
					}
				});
			} catch (error) {
				console.error(`An unexpected error occurred: ${error.message}`);
			}
			return {content: [{type: "text", text: "File write successfull"}]};
		}
	}
];

const app = express();
app.use(express.json({ limit: "2mb" }));
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
    log("RPC received POST:",msg.method);
    function reply(result) {
      const out = { jsonrpc: "2.0", id: msg.id, ...result };
      //log("RPC reply:", JSON.stringify(out, null, 2));
      res.json(out);
    };
	switch(msg.method){
		case  "initialize": 
			return reply(initializeResponse(msg));
		case "notifications/initialized":
		case "notifications/cancelled": 
			return reply({}); 
		case "tools/list": 
			log("Listing tools");
			return reply({result: {tools: tools.map(tool => tool.toolObject),}});
		case "tools/call": 
			log("writing file, calling tool", msg.params.arguments);
			const toolName = msg.params.name;
			const matchingTool = tools.find(tool => tool.toolObject.name === toolName);
			return reply({result: matchingTool.func(msg.params.arguments)});
		default:
			return reply(methodNotFoundResponse);
	}
  }
  else {
    res.status(405).send("Method Not Allowed");
  } 
});


const PORT = 3000;
app.listen(PORT, () => log(`MCP server running on http://localhost:${PORT}`));
