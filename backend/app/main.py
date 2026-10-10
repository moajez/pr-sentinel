import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import analytics, audit, auth, compliance, evals, governance, orgs, repos, reviews
from app.core.auth import get_principal
from app.api.v1.webhooks import router as webhooks_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="PR Sentinel")
app.add_middleware(
    CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"], allow_headers=["*"], allow_credentials=True,
)
app.include_router(webhooks_router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
for r in (reviews.router, repos.router, analytics.router, evals.router, orgs.router, audit.router,
          governance.router, compliance.router):
    app.include_router(r, prefix="/api/v1", dependencies=[Depends(get_principal)])


@app.get("/health")
async def health():
    return {"status": "ok"}


# Mount frontend static files so http://localhost:8000 also renders the React dashboard and handles SPA routing
from pathlib import Path
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

_frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _frontend_dist.exists():
    if (_frontend_dist / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(_frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = _frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_frontend_dist / "index.html")


