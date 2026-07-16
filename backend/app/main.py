import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.v1.router import router as api_v1_router

_dev = os.getenv("ENVIRONMENT", "production") == "development"

app = FastAPI(
    title="FRIDAY API",
    description="API for FRIDAY - Personal Financial Projection App",
    version="0.1.0",
    docs_url="/docs" if _dev else None,
    redoc_url="/redoc" if _dev else None,
    openapi_url="/openapi.json" if _dev else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://sebitass47.com",
        "https://www.sebitass47.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}