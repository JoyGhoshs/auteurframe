from __future__ import annotations

import os
from urllib.parse import urlsplit

LOOPBACK = {"127.0.0.1", "localhost", "::1", "[::1]"}
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "camera=(), geolocation=(), usb=(), serial=(), bluetooth=(), payment=()",
}


def allowed_hosts() -> set[str] | None:
    raw = os.environ.get("AUTEUR_ALLOWED_HOSTS", "").strip()
    if raw == "*":
        return None
    extra = {h.strip().lower() for h in raw.split(",") if h.strip()}
    return LOOPBACK | extra


def host_name(value: str) -> str:
    value = (value or "").strip().lower()
    if not value:
        return ""
    if value.startswith("["):
        end = value.find("]")
        return value[: end + 1] if end > 0 else value
    return value.rsplit(":", 1)[0] if value.count(":") == 1 else value


def origin_host(origin: str) -> str:
    try:
        parts = urlsplit(origin)
    except ValueError:
        return ""
    if parts.scheme not in ("http", "https"):
        return ""
    return host_name(parts.netloc)


def check(method: str, path: str, host: str, origin: str | None, fetch_site: str | None) -> str | None:
    hosts = allowed_hosts()
    if hosts is not None and host_name(host) not in hosts:
        return "host not allowed"
    if fetch_site and fetch_site.lower() == "cross-site" and (path.startswith("/api/") or method in UNSAFE_METHODS):
        return "cross-site request blocked"
    if origin and method in UNSAFE_METHODS:
        if origin == "null":
            return "opaque origin blocked"
        oh = origin_host(origin)
        if hosts is not None and oh not in hosts:
            return "cross-origin request blocked"
        if hosts is None and oh != host_name(host):
            return "cross-origin request blocked"
    return None
