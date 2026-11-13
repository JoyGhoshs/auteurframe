import argparse
import os

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description="AuteurFrame")
    parser.add_argument("--host", default=os.environ.get("AUTEUR_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("AUTEUR_PORT", "8800")))
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()
    os.environ["AUTEUR_PORT"] = str(args.port)
    os.environ.setdefault("AUTEUR_INTERNAL_URL", f"http://127.0.0.1:{args.port}")
    uvicorn.run("server.app:app", host=args.host, port=args.port, reload=args.reload, log_level="info", timeout_graceful_shutdown=3)


if __name__ == "__main__":
    main()
