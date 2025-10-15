# api/app/routers/users.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.auth import require_user, create_user_with_api_key
from app.database import get_db
from app.models import User, Memory

router = APIRouter(prefix="/api/v1/users", tags=["users"])


class UserResponse(BaseModel):
    id: str
    user_id: str
    name: str
    email: Optional[str]
    created_at: str
    last_active: Optional[str]
    memory_count: int = 0


class CreateUserRequest(BaseModel):
    user_id: str
    name: Optional[str] = None
    email: Optional[str] = None


class CreateUserResponse(BaseModel):
    success: bool
    user_id: str
    name: str
    email: Optional[str]
    api_key: str
    uuid: str
    created_at: str
    message: str


@router.get("/", response_model=List[UserResponse])
def get_all_users(
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db)
):
    """Get current user only"""
    # Count active memories for current user
    memory_count = db.query(Memory).filter(
        Memory.user_id == current_user.id,
        Memory.state == "active"
    ).count()

    user_response = UserResponse(
        id=str(current_user.id),
        user_id=current_user.user_id,
        name=current_user.name or current_user.user_id,
        email=current_user.email,
        created_at=current_user.created_at.isoformat(),
        last_active=current_user.last_active.isoformat() if current_user.last_active else None,
        memory_count=memory_count
    )

    return [user_response]


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: str,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db)
):
    """Get a specific user by user_id"""
    user = db.query(User).filter(User.user_id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    memory_count = db.query(Memory).filter(
        Memory.user_id == user.id,
        Memory.state == "active"
    ).count()

    return UserResponse(
        id=str(user.id),
        user_id=user.user_id,
        name=user.name or user.user_id,
        email=user.email,
        created_at=user.created_at.isoformat(),
        last_active=user.last_active.isoformat() if user.last_active else None,
        memory_count=memory_count
    )


@router.post("/create", response_model=CreateUserResponse)
def create_new_user(
    request: CreateUserRequest,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db)
):
    """Create a new user with API key (admin functionality)"""
    
    try:
        # Use the existing create_user_with_api_key function
        user, api_key = create_user_with_api_key(
            user_id=request.user_id,
            db=db,
            name=request.name,
            email=request.email
        )
        
        return CreateUserResponse(
            success=True,
            user_id=user.user_id,
            name=user.name or user.user_id,
            email=user.email,
            api_key=api_key,
            uuid=str(user.id),
            created_at=user.created_at.isoformat(),
            message=f"User '{request.user_id}' created successfully"
        )
        
    except ValueError as e:
        if "already exists" in str(e):
            raise HTTPException(status_code=409, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")
