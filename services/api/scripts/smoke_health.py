import json
from urllib.request import urlopen


def main() -> None:
    with urlopen("http://127.0.0.1:8000/health", timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))

    expected = {"status": "ok", "service": "guru-api"}
    if payload != expected:
        raise SystemExit(f"Unexpected health payload: {payload!r}")

    print(json.dumps(payload, separators=(",", ":")))


if __name__ == "__main__":
    main()
