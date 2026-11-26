import asyncio
import getpass

from sqlalchemy import select

from app.db import get_session_factory
from app.models import User, UserGlobalRole
from app.security import hash_password, normalize_username, validate_password_policy


async def main() -> None:
    username = input("New system admin username: ").strip()
    password = getpass.getpass("New password (min 8 chars, 1+ uppercase A-Z, 1+ special char): ")
    confirm = getpass.getpass("Confirm password: ")
    if len(username) < 3 or len(username) > 80:
        raise SystemExit("Username must contain 3 to 80 characters.")
    try:
        validate_password_policy(password)
    except ValueError:
        raise SystemExit(
            "Password must be 8 to 256 characters and include at least 1 uppercase letter (A-Z) and 1 special character."
        )
    if password != confirm:
        raise SystemExit("Passwords do not match.")

    factory = get_session_factory()
    async with factory() as db:
        existing = await db.scalar(
            select(User).where(User.username_normalized == normalize_username(username))
        )
        if existing:
            raise SystemExit("That username already exists.")
        user = User(
            username=username,
            username_normalized=normalize_username(username),
            password_hash=hash_password(password),
        )
        db.add(user)
        await db.flush()
        db.add(UserGlobalRole(user_id=user.id, role_code="system_admin"))
        await db.commit()
    print("System administrator created.")


if __name__ == "__main__":
    asyncio.run(main())
