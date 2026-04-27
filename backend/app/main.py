from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router as bot_router
from app.core.database import engine, Base

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="MeetClone API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bot_router, prefix="/bot", tags=["Bot"])

@app.get("/")
def read_root():
    return {"message": "Welcome to MeetClone API"}
