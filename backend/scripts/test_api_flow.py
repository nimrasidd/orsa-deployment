from __future__ import annotations

import json
from urllib.request import Request, urlopen


BASE = "http://127.0.0.1:8002"


def http_json(method: str, path: str, body: dict | None = None, token: str | None = None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = Request(BASE + path, method=method.upper(), data=data)
    req.add_header("Accept", "application/json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urlopen(req, timeout=15) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else None


def main() -> int:
    login = http_json(
        "POST",
        "/auth/login",
        {"email": "admin@sir.com", "password": "password123"},
    )
    token = login["access_token"]
    print("Logged in OK as:", login["user"]["email"], "is_admin=", login["user"].get("is_admin"))

    regions = http_json("GET", "/regions")
    if not regions:
        raise SystemExit("No regions returned; seed may not have run.")
    region_id = str(regions[0]["id"])
    countries = http_json("GET", f"/regions/{region_id}/countries")
    if not countries:
        raise SystemExit("No countries returned; seed may not have run.")
    country_id = str(countries[0]["id"])
    print("Using country:", countries[0]["name"], "id=", country_id)

    before = http_json("GET", "/models")
    print("Models before:", len(before))

    created = http_json("POST", "/models", {"country_id": country_id, "name": "Test Model (API)"}, token=token)
    print("Created model:", created)

    after = http_json("GET", "/models")
    print("Models after:", len(after))
    return 0


def test_company_models() -> int:
    login = http_json(
        "POST",
        "/auth/login",
        {"email": "admin@sir.com", "password": "password123"},
    )
    token = login["access_token"]
    print("Logged in OK as:", login["user"]["email"], "is_admin=", login["user"].get("is_admin"))

    regions = http_json("GET", "/regions")
    region_id = str(regions[0]["id"])
    countries = http_json("GET", f"/regions/{region_id}/countries")
    country_id = str(countries[0]["id"])

    before = http_json("GET", "/company-models", token=token)
    print("Company-models before:", len(before))

    created = http_json(
        "POST",
        "/company-models",
        {"country_id": country_id, "name": "UI Model Test"},
        token=token,
    )
    print("Created company-model:", created)

    after = http_json("GET", "/company-models", token=token)
    print("Company-models after:", len(after))
    return 0


if __name__ == "__main__":
    raise SystemExit(test_company_models())

