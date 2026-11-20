"""Read-only smoke test of the deployed LendLab service (Lab 5).

Usage: python3 deploy/smoke_test.py SERVICE_URL [EXPECTED_COMMIT]

Checks, each retried for Cloud Run cold starts:
  1. GET /api/health      -> status "ok" (and commit == EXPECTED_COMMIT when given, R-08)
  2. GET /api/ready       -> db "connected" (the app reaches Cloud SQL)
  3. GET /                -> HTML (the built React app is served)
  4. GET /api/categories  -> non-empty list (migration and seed ran)
  5. Optional sign-in     -> login, /api/auth/me, logout, only when both
                             SMOKE_EMAIL and SMOKE_PASSWORD are set.

Standard library only. Never prints credentials or tokens.
Adapted from the Lab 5 starter kit.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request


def request(base, path, data=None, token=None):
    headers = {}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(
        base + path,
        headers=headers,
        data=json.dumps(data).encode() if data is not None else None,
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def check(base, expected_commit=None):
    def health_ok(body):
        payload = json.loads(body)
        if payload.get('status') != 'ok':
            return False
        return expected_commit is None or payload.get('commit') == expected_commit

    checks = (
        ('/api/health', health_ok),
        ('/api/ready', lambda b: json.loads(b).get('db') == 'connected'),
        ('/', lambda b: b'<html' in b.lower()),
        ('/api/categories', lambda b: isinstance(json.loads(b), list) and len(json.loads(b)) > 0),
    )
    for path, predicate in checks:
        for attempt in range(5):
            try:
                if not predicate(request(base, path)):
                    raise ValueError('Unexpected response')
                break
            except (urllib.error.URLError, TimeoutError, ValueError):
                if attempt == 4:
                    raise RuntimeError('Smoke check failed: ' + path) from None
                time.sleep(3)
        print('PASS ' + path)
    if expected_commit:
        print('PASS running commit is ' + expected_commit)

    email, password = os.getenv('SMOKE_EMAIL'), os.getenv('SMOKE_PASSWORD')
    if bool(email) != bool(password):
        raise RuntimeError('Set both SMOKE_EMAIL and SMOKE_PASSWORD, or neither.')
    if not email:
        print('SKIP sign-in: optional smoke credentials not configured')
        return
    token = None
    try:
        token = json.loads(request(base, '/api/auth/login', {'email': email, 'password': password}))['token']
        request(base, '/api/auth/me', token=token)
        print('PASS sign-in and /api/auth/me')
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError):
        raise RuntimeError('Sign-in smoke check failed') from None
    finally:
        if token:
            request(base, '/api/auth/logout', data={}, token=token)
            print('PASS logout')


if __name__ == '__main__':
    if len(sys.argv) not in (2, 3):
        sys.exit('Usage: python3 deploy/smoke_test.py SERVICE_URL [EXPECTED_COMMIT]')
    check(sys.argv[1].rstrip('/'), sys.argv[2] if len(sys.argv) == 3 else None)
