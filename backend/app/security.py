import hashlib
import hmac
import secrets
import string

from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 256
PASSWORD_SPECIAL_CHARS = string.punctuation


def validate_password_policy(password: str) -> str:
    if len(password) < PASSWORD_MIN_LENGTH or len(password) > PASSWORD_MAX_LENGTH:
        raise ValueError("password_policy_violation")
    if not any("A" <= ch <= "Z" for ch in password):
        raise ValueError("password_policy_violation")
    if not any(ch in PASSWORD_SPECIAL_CHARS for ch in password):
        raise ValueError("password_policy_violation")
    return password


def normalize_username(username: str) -> str:
    return username.strip().casefold()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        return password_hash.verify(password, encoded_hash)
    except Exception:
        return False


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def session_csrf_token(session_token: str) -> str:
    return hmac.new(session_token.encode("ascii"), b"inpatient:csrf:v1", hashlib.sha256).hexdigest()


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def constant_time_match(candidate: str, expected_hash: str | None) -> bool:
    if not expected_hash:
        return False
    return hmac.compare_digest(token_hash(candidate), expected_hash)
