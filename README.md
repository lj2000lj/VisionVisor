# VisionVisor

An MCP (Model Context Protocol) server that proxies vision requests to an external OpenAI-compatible LLM.

> [!IMPORTANT]
> This project is built entirely on **Vibe**. High signal, low friction, pure flow.

## Features

- **Multi-Source Support**: Accepts image URLs, local file paths, or Base64 strings.
- **OpenAI Compatible**: Works with any API that follows the OpenAI Vision API specification (GPT-4o, Claude 3.5 Sonnet, etc.).
- **WSL Support**: Automatic path mapping for WSL environments.
- **MCP Tool**: Exposes the `ask_vision_model` tool to other LLMs.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   Copy `.env.example` to `.env` (already done if you ran the init) and fill in your keys:
   ```env
   OPENAI_API_KEY=your_key_here
   OPENAI_BASE_URL=https://api.openai.com/v1 # Or your provider's URL
   VISION_MODEL=gpt-4o # Or your preferred vision model
   ```

3. **Run the server**:
   ```bash
   node index.js
   ```

## Integration with Claude/Desktop

Add this to your MCP settings configuration file:

```json
{
  "mcpServers": {
    "visionvisor": {
      "command": "npx",
      "args": ["-y", "visionvisor"],
      "env": {
        "OPENAI_API_KEY": "your_key_here"
      }
    }
  }
}
```

## Integration with OpenCode

Add this to your `opencode.json`:

```json
{
  "mcp": {
    "visionvisor": {
      "type": "local",
      "command": ["npx", "-y", "visionvisor"],
      "environment": {
        "OPENAI_API_KEY": "your_key_here"
      },
      "enabled": true
    }
  }
}
```

## Tool Usage: `ask_vision_model`

**Arguments:**

- `prompt` (string): Your question about the image. **Pro-tip**: Since vision models are stateless, include all necessary context in this prompt.
- `image_source` (string): Image URL, local file path, or Base64 string.

## License

WTFPL - Do What the Fuck You Want to Public License.
