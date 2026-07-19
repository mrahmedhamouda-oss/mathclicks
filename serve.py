# Local preview server with caching disabled, so edits show up on refresh.
# Usage: python3 serve.py  →  http://localhost:8017
import http.server, os

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()

os.chdir(os.path.dirname(os.path.abspath(__file__)))
print("Serving on http://localhost:8017")
http.server.ThreadingHTTPServer(("127.0.0.1", 8017), NoCacheHandler).serve_forever()
