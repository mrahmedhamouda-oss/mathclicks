# Local preview server with caching disabled, so edits show up on refresh.
# Usage: python3 serve.py  →  http://localhost:8017 (or $PORT if set)
import http.server, os

PORT = int(os.environ.get("PORT", "8017"))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()

os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f"Serving on http://localhost:{PORT}")
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler).serve_forever()
