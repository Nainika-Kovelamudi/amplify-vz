"""
Run once to create local dev test users in the DB.
Usage: python seed_dev_users.py
"""
import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]

from app.db.models import UserProfile, UserRole

async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    dev_users = [
        {"email": "standarduser@amplify.local", "display_name": "Standard User",  "role": UserRole.user,  "oid": "dev-oid-user"},
        {"email": "admin@amplify.local",         "display_name": "Admin User",     "role": UserRole.admin, "oid": "dev-oid-admin"},
        {"email": "owner@amplify.local",         "display_name": "Platform Owner", "role": UserRole.owner, "oid": "dev-oid-owner"},
    ]

    async with async_session() as session:
        for u in dev_users:
            result = await session.execute(select(UserProfile).where(UserProfile.email == u["email"]))
            existing = result.scalars().first()
            if existing:
                print(f"  already exists: {u['email']}")
                continue
            user = UserProfile(
                id=uuid.uuid4(),
                azure_oid=u["oid"],
                email=u["email"],
                display_name=u["display_name"],
                role=u["role"],
            )
            session.add(user)
            print(f"  created: {u['email']} ({u['role'].value})")
        await session.commit()
    await engine.dispose()
    print("Done.")

asyncio.run(seed())
