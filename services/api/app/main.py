from fastapi import FastAPI

from services.api.app.knowledgebase import router as knowledgebase_router

app = FastAPI(title="GURU API", version="0.1.0")
app.include_router(knowledgebase_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "guru-api"}
