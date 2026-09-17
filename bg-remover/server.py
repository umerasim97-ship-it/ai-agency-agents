#!/usr/bin/env python3
"""
BG Remover — static file server (stdlib only, no dependencies).

Correct MIME types matter:
  .mjs  -> text/javascript  (ES modules strictly require a JS MIME type)
  .wasm -> application/wasm (enables WebAssembly streaming compilation)
"""
import http.server
import os
import socketserver

PORT = int(os.environ.get("PORT", "3000"))
ROOT = os.path.dirname(os.path.abspath(__file__))

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".wasm": "application/wasm",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def guess_type(self, path):
        ext = os.path.splitext(str(path))[1].lower()
        return MIME.get(ext, "application/octet-stream")

    def end_headers(self):
        path = self.path.split("?")[0].split("#")[0]
        if path.startswith("/models/"):
            # big binary model chunks — cache aggressively
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with Server(("0.0.0.0", PORT), Handler) as srv:
        print(f"BG Remover serving on http://0.0.0.0:{PORT}", flush=True)
        srv.serve_forever()
