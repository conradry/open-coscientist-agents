"""
FastAPI Container Application for Cloudflare Container Registry
A production-ready Python API container optimized for Cloudflare deployment.
"""

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import asyncio
import time
import uuid
from datetime import datetime
import os
from contextlib import asynccontextmanager
import uvicorn
import aioredis
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response
import structlog
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, String, DateTime, Text, Integer
import json
import hashlib
from functools import wraps

# Configuration
class Config:
    # Server Configuration
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8080))
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"

    # Database Configuration
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./app.db")

    # Redis Configuration
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

    # Application Configuration
    APP_NAME = os.getenv("APP_NAME", "FastAPI Cloudflare Container")
    APP_VERSION = os.getenv("APP_VERSION", "1.0.0")

    # Security
    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", 30))

    # Performance
    MAX_CONNECTIONS = int(os.getenv("MAX_CONNECTIONS", 100))
    WORKERS = int(os.getenv("WORKERS", 1))

    # Cloudflare specific
    CLOUDFLARE_WORKERS = os.getenv("CLOUDFLARE_WORKERS", "false").lower() == "true"

    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT = os.getenv("LOG_FORMAT", "json")

# Structured logging setup
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer() if Config.LOG_FORMAT == "json" else structlog.dev.ConsoleRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Prometheus Metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('http_request_duration_seconds', 'HTTP request duration')
ACTIVE_CONNECTIONS = Counter('active_connections', 'Active database connections')

# Database Models
Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True)
    name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    metadata = Column(Text, default="{}")

class APILog(Base):
    __tablename__ = "api_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    method = Column(String)
    path = Column(String)
    status_code = Column(Integer)
    duration_ms = Column(Integer)
    user_id = Column(String, nullable=True)
    ip_address = Column(String)
    user_agent = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    request_id = Column(String)

# Pydantic Models
class UserCreate(BaseModel):
    email: str
    name: str
    metadata: Optional[Dict[str, Any]] = {}

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime
    updated_at: datetime
    metadata: Dict[str, Any]

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str
    database: str
    redis: str
    uptime: float

class MetricsResponse(BaseModel):
    requests_total: int
    active_connections: int
    uptime_seconds: float
    memory_usage_mb: float

# Application State
class AppState:
    def __init__(self):
        self.redis = None
        self.engine = None
        self.session_factory = None
        self.start_time = time.time()

app_state = AppState()

# Database dependency
async def get_db() -> AsyncSession:
    async with app_state.session_factory() as session:
        try:
            ACTIVE_CONNECTIONS.inc()
            yield session
        finally:
            ACTIVE_CONNECTIONS.dec()

# Redis dependency
async def get_redis():
    return app_state.redis

# Application Lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Application starting up", version=Config.APP_VERSION)

    # Initialize database
    app_state.engine = create_async_engine(
        Config.DATABASE_URL,
        echo=Config.DEBUG,
        pool_size=20,
        max_overflow=30
    )
    app_state.session_factory = async_sessionmaker(
        app_state.engine, class_=AsyncSession, expire_on_commit=False
    )

    # Create tables
    async with app_state.engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Initialize Redis
    try:
        app_state.redis = await aioredis.from_url(Config.REDIS_URL)
        await app_state.redis.ping()
        logger.info("Redis connection established")
    except Exception as e:
        logger.error("Redis connection failed", error=str(e))
        app_state.redis = None

    logger.info("Application startup complete")

    yield

    # Shutdown
    logger.info("Application shutting down")
    if app_state.redis:
        await app_state.redis.close()
    if app_state.engine:
        await app_state.engine.dispose()

# FastAPI Application
app = FastAPI(
    title=Config.APP_NAME,
    version=Config.APP_VERSION,
    description="FastAPI application optimized for Cloudflare Container Registry",
    lifespan=lifespan,
    docs_url="/docs" if Config.DEBUG else None,
    redoc_url="/redoc" if Config.DEBUG else None
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    request_id = str(uuid.uuid4())

    # Add request ID to request state
    request.state.request_id = request_id

    # Log request
    logger.info(
        "Request started",
        method=request.method,
        path=request.url.path,
        request_id=request_id,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None
    )

    try:
        response = await call_next(request)
        duration = time.time - start_time

        # Log response
        logger.info(
            "Request completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration * 1000, 2),
            request_id=request_id
        )

        # Update metrics
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code
        ).inc()

        # Log to database (async)
        asyncio.create_task(log_to_database(request, response, duration, request_id))

        # Add headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration:.3f}s"

        return response

    except Exception as e:
        duration = time.time - start_time
        logger.error(
            "Request failed",
            method=request.method,
            path=request.url.path,
            error=str(e),
            duration_ms=round(duration * 1000, 2),
            request_id=request_id
        )
        raise

async def log_to_database(request: Request, response: Response, duration: float, request_id: str):
    """Log API requests to database for analytics"""
    try:
        async with app_state.session_factory() as session:
            log_entry = APILog(
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(duration * 1000),
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent", ""),
                request_id=request_id
            )
            session.add(log_entry)
            await session.commit()
    except Exception as e:
        logger.error("Failed to log to database", error=str(e))

# Rate limiting decorator
def rate_limit(max_requests: int = 100, window_seconds: int = 60):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request = kwargs.get('request')
            if not request or not app_state.redis:
                return await func(*args, **kwargs)

            client_ip = request.client.host if request.client else "unknown"
            key = f"rate_limit:{client_ip}"

            current_requests = await app_state.redis.get(key)
            if current_requests and int(current_requests) >= max_requests:
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded"
                )

            # Increment counter
            await app_state.redis.incr(key)
            await app_state.redis.expire(key, window_seconds)

            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Cache decorator
def cache(ttl: int = 300):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not app_state.redis:
                return await func(*args, **kwargs)

            # Generate cache key
            cache_key = f"cache:{func.__name__}:{hash(str(args) + str(kwargs))}"

            # Try to get from cache
            cached_result = await app_state.redis.get(cache_key)
            if cached_result:
                return json.loads(cached_result)

            # Execute function and cache result
            result = await func(*args, **kwargs)

            # Serialize result for caching
            if hasattr(result, 'dict'):
                serialized = json.dumps(result.dict())
            else:
                serialized = json.dumps(result)

            await app_state.redis.setex(cache_key, ttl, serialized)

            return result
        return wrapper
    return decorator

# API Routes
@app.get("/health", response_model=HealthResponse)
@REQUEST_DURATION.time()
async def health_check(request: Request, db: AsyncSession = Depends(get_db)):
    """Health check endpoint optimized for Cloudflare Container Registry"""

    # Check database
    db_status = "healthy"
    try:
        await db.execute("SELECT 1")
    except Exception as e:
        db_status = "unhealthy"
        logger.error("Database health check failed", error=str(e))

    # Check Redis
    redis_status = "healthy"
    if app_state.redis:
        try:
            await app_state.redis.ping()
        except Exception as e:
            redis_status = "unhealthy"
            logger.error("Redis health check failed", error=str(e))
    else:
        redis_status = "disabled"

    uptime = time.time() - app_state.start_time

    overall_status = "healthy" if db_status == "healthy" else "unhealthy"

    return HealthResponse(
        status=overall_status,
        timestamp=datetime.utcnow(),
        version=Config.APP_VERSION,
        database=db_status,
        redis=redis_status,
        uptime=uptime
    )

@app.get("/metrics", response_model=MetricsResponse)
@REQUEST_DURATION.time()
@cache(ttl=60)
async def get_metrics():
    """Application metrics endpoint"""

    import psutil
    process = psutil.Process()

    return MetricsResponse(
        requests_total=int(REQUEST_COUNT._value.get()),
        active_connections=int(ACTIVE_CONNECTIONS._value.get()),
        uptime_seconds=time.time() - app_state.start_time,
        memory_usage_mb=process.memory_info().rss / 1024 / 1024
    )

@app.get("/prometheus/metrics")
async def prometheus_metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.post("/users", response_model=UserResponse)
@REQUEST_DURATION.time()
@rate_limit(max_requests=10, window_seconds=60)
async def create_user(
    user: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Create a new user"""

    # Check if user already exists
    existing_user = await db.execute(
        "SELECT id FROM users WHERE email = ?",
        (user.email,)
    )
    if existing_user.fetchone():
        raise HTTPException(status_code=409, detail="User already exists")

    # Create user
    db_user = User(
        email=user.email,
        name=user.name,
        metadata=json.dumps(user.metadata)
    )

    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    logger.info("User created", user_id=db_user.id, email=user.email)

    return UserResponse(
        id=db_user.id,
        email=db_user.email,
        name=db_user.name,
        created_at=db_user.created_at,
        updated_at=db_user.updated_at,
        metadata=json.loads(db_user.metadata)
    )

@app.get("/users", response_model=List[UserResponse])
@REQUEST_DURATION.time()
@rate_limit(max_requests=100, window_seconds=60)
@cache(ttl=300)
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """List users with pagination"""

    result = await db.execute(
        "SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (limit, skip)
    )
    users = result.fetchall()

    return [
        UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            created_at=user.created_at,
            updated_at=user.updated_at,
            metadata=json.loads(user.metadata)
        )
        for user in users
    ]

@app.get("/users/{user_id}", response_model=UserResponse)
@REQUEST_DURATION.time()
@cache(ttl=600)
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    """Get user by ID"""

    result = await db.execute(
        "SELECT * FROM users WHERE id = ?",
        (user_id,)
    )
    user = result.fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        created_at=user.created_at,
        updated_at=user.updated_at,
        metadata=json.loads(user.metadata)
    )

@app.put("/users/{user_id}", response_model=UserResponse)
@REQUEST_DURATION.time()
@rate_limit(max_requests=50, window_seconds=60)
async def update_user(
    user_id: str,
    user_update: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Update user"""

    # Check if user exists
    result = await db.execute(
        "SELECT * FROM users WHERE id = ?",
        (user_id,)
    )
    user = result.fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update user
    await db.execute(
        "UPDATE users SET name = ?, metadata = ?, updated_at = ? WHERE id = ?",
        (user_update.name, json.dumps(user_update.metadata), datetime.utcnow(), user_id)
    )
    await db.commit()

    # Clear cache
    if app_state.redis:
        await app_state.redis.delete(f"cache:get_user:{user_id}")

    logger.info("User updated", user_id=user_id, email=user_update.email)

    return UserResponse(
        id=user.id,
        email=user.email,  # Email typically not updated
        name=user_update.name,
        created_at=user.created_at,
        updated_at=datetime.utcnow(),
        metadata=user_update.metadata
    )

@app.delete("/users/{user_id}")
@REQUEST_DURATION.time()
@rate_limit(max_requests=20, window_seconds=60)
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db)):
    """Delete user"""

    # Check if user exists
    result = await db.execute(
        "SELECT id FROM users WHERE id = ?",
        (user_id,)
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="User not found")

    # Delete user
    await db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    await db.commit()

    # Clear cache
    if app_state.redis:
        await app_state.redis.delete(f"cache:get_user:{user_id}")

    logger.info("User deleted", user_id=user_id)

    return {"message": "User deleted successfully"}

# Cloudflare Workers integration endpoint
@app.post("/webhook/cloudflare")
async def cloudflare_webhook(request: Request):
    """Handle Cloudflare Workers webhooks"""

    try:
        payload = await request.json()

        # Process webhook
        logger.info("Cloudflare webhook received", payload=payload)

        # Example: Handle deployment notifications
        if payload.get("type") == "deployment":
            await handle_deployment_webhook(payload)

        return {"status": "processed"}

    except Exception as e:
        logger.error("Cloudflare webhook processing failed", error=str(e))
        raise HTTPException(status_code=500, detail="Webhook processing failed")

async def handle_deployment_webhook(payload):
    """Handle deployment notifications from Cloudflare Workers"""
    # Implementation for deployment webhook handling
    logger.info("Processing deployment webhook", deployment=payload.get("deployment"))

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(
        "HTTP exception",
        status_code=exc.status_code,
        detail=exc.detail,
        path=request.url.path,
        request_id=getattr(request.state, 'request_id', None)
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "request_id": getattr(request.state, 'request_id', None)
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception",
        error=str(exc),
        path=request.url.path,
        request_id=getattr(request.state, 'request_id', None)
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "request_id": getattr(request.state, 'request_id', None)
        }
    )

# Main execution
if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host=Config.HOST,
        port=Config.PORT,
        workers=Config.WORKERS,
        log_level=Config.LOG_LEVEL.lower(),
        access_log=Config.DEBUG,
        reload=Config.DEBUG
    )