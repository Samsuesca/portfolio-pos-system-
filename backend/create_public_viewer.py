"""
Create public-viewer user for web portal catalog access
"""
import asyncio
import uuid
from app.db.session import get_db
from app.models.user import User, UserSchoolRole, UserRole
from app.models.school import School
from passlib.context import CryptContext
from sqlalchemy import select

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_public_viewer():
    """Create public-viewer user with VIEWER role for all schools"""
    async for db in get_db():
        try:
            # Check if user already exists
            result = await db.execute(
                select(User).where(User.username == "public-viewer")
            )
            existing_user = result.scalar_one_or_none()

            if existing_user:
                print("✅ public-viewer user already exists")
                return

            # Create user
            hashed_password = pwd_context.hash("PublicView2025!")
            user = User(
                id=uuid.uuid4(),
                username="public-viewer",
                email="public@uniformes.system",
                full_name="Public Viewer",
                hashed_password=hashed_password,
                is_active=True,
                is_superuser=False
            )
            db.add(user)
            await db.flush()

            # Get all schools
            result = await db.execute(select(School))
            schools = result.scalars().all()

            # Assign VIEWER role for each school
            for school in schools:
                role = UserSchoolRole(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    school_id=school.id,
                    role=UserRole.VIEWER
                )
                db.add(role)

            await db.commit()
            print(f"✅ Created public-viewer user with VIEWER role for {len(schools)} schools")
            print(f"   Username: public-viewer")
            print(f"   Password: PublicView2025!")

        except Exception as e:
            await db.rollback()
            print(f"❌ Error: {e}")
            raise
        finally:
            break

if __name__ == "__main__":
    asyncio.run(create_public_viewer())
