#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const MODEL = process.env.VISION_MODEL || "gpt-4o";
const WSL_PATH_MAPPING = process.env.WSL_PATH_MAPPING === "true";

if (!API_KEY) {
  console.error("Warning: OPENAI_API_KEY is not set in environment variables.");
}

const server = new Server(
  {
    name: "visionvisor",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Helper to get image as data URI or URL
 */
async function processImageSource(imageSource) {
  if (imageSource.startsWith("http://") || imageSource.startsWith("https://")) {
    return imageSource;
  }

  if (imageSource.startsWith("data:")) {
    return imageSource;
  }

  let targetPath = imageSource;

  // WSL Path Mapping: convert C:/path to /mnt/c/path
  if (WSL_PATH_MAPPING && /^[a-zA-Z]:/.test(targetPath)) {
    const drive = targetPath[0].toLowerCase();
    targetPath = `/mnt/${drive}${targetPath.slice(2).replace(/\\/g, "/")}`;
  }

  // Check if it's a local file
  try {
    const checkPath = async (p) => {
      if (fs.existsSync(p)) {
        const ext = path.extname(p).toLowerCase();
        let mimeType = "image/jpeg";
        if (ext === ".png") mimeType = "image/png";
        else if (ext === ".gif") mimeType = "image/gif";
        else if (ext === ".webp") mimeType = "image/webp";

        const base64 = fs.readFileSync(p, { encoding: "base64" });
        return `data:${mimeType};base64,${base64}`;
      }
      return null;
    };

    let result = await checkPath(targetPath);
    if (result) return result;

    if (targetPath !== imageSource) {
      result = await checkPath(imageSource);
      if (result) return result;
    }
  } catch (e) {
    // Not a file, proceed to base64 check
  }

  // If we thought it was a path but it doesn't exist, throw a specific error
  if (targetPath.includes("/") || targetPath.includes("\\")) {
    throw new Error(`Local image file not found: ${imageSource}${WSL_PATH_MAPPING ? ` (tried as ${targetPath})` : ""}`);
  }

  // If it's a raw base64 string (no data: prefix), add it.
  if (/^[A-Za-z0-9+/=]+$/.test(imageSource.trim())) {
    return `data:image/jpeg;base64,${imageSource.trim()}`;
  }

  throw new Error(`Invalid image source. Not a valid URL, existing file path, or base64 string: ${imageSource}`);
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "ask_vision_model",
        description: "Ask a question about an image using a vision LLM. The vision model has no memory of prior conversation, so you MUST include all relevant context directly in the prompt.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The question for the vision model. IMPORTANT: Since the vision model has no conversation history, you MUST include: 1) A brief summary of the conversation so far if relevant, 2) Any prior context needed to understand the question, 3) Clear and specific instructions about what you want to know from the image. Treat this as a standalone message — the vision model should be able to understand everything from this prompt alone without any prior messages.",
            },
            image_source: {
              type: "string",
              description: "The image source: web URL, local file path, or base64 string.",
            },
          },
          required: ["prompt", "image_source"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "ask_vision_model") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const { prompt, image_source } = request.params.arguments;

  try {
    const imageUrl = await processImageSource(image_source);

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        content: [
          {
            type: "text",
            text: `API Error (${response.status}): ${errorText}`,
          },
        ],
        isError: true,
      };
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content || "No response content from model.";

    return {
      content: [
        {
          type: "text",
          text: resultText,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error processing request: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("VisionVisor MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
