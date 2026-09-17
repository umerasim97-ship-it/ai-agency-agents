# Switchboard

A polished, dependency-free multi-model AI workspace prototype. It demonstrates a calm chat experience where users can switch between Claude, OpenAI, and local/Ollama models without losing the conversation.

## Run locally

From this directory:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## What is included

- Responsive workspace layout with sidebar navigation
- Model picker for Claude 3.7 Sonnet, GPT-4.1, and Qwen 3 32B (Local)
- Simulated chat responses so the prototype works without API keys
- Recent conversations, prompt library, and side-by-side model comparison
- Connection settings modal with provider status toggles
- Mobile navigation, keyboard shortcuts, file attachment affordance, and toast feedback

## Connecting real models

The current app intentionally uses local demo replies. To make it production-ready, add a server-side `/api/chat` route and replace the response inside `sendMessage()` with a `fetch('/api/chat', ...)` call. Keep Anthropic and OpenAI credentials on the server; do not expose provider keys in browser JavaScript. For Ollama, proxy requests through the same backend rather than calling `localhost` from the browser in a deployed environment.
