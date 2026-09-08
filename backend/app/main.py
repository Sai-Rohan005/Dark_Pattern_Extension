from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router


app = FastAPI(
    title="Dark Pattern Detector API",
    description="Backend API for the Dark Pattern Detector Chrome Extension",
    version="1.0.0"
)


# ================================================================
# CORS
# ================================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=False,

    allow_methods=["*"],

    allow_headers=["*"],
)


# ================================================================
# Routes
# ================================================================

app.include_router(router)


# ================================================================
# Health Check
# ================================================================

@app.get("/")
def root():

    return {
        "success": True,
        "message": "Dark Pattern Detector API is running."
    }


@app.get("/health")
def health():

    return {
        "status": "healthy"
    }



# python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload