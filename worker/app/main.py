from fastapi import FastAPI

app = FastAPI(title="ACHARYA worker")


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
