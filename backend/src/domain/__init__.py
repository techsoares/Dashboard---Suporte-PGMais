"""
Módulo Domain — Modelos e lógica de negócio.

Exporta:
- Models (Pydantic schemas)
- Enums (valores constantes)
- Exceptions (exceções customizadas)
- Entities (agregações de domínio)
"""

from .models import (
    # Auth
    LoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    # Components
    TimeInStatus,
    Assignee,
    IssueType,
    Status,
    Priority,
    Component,
    # Issue
    Issue,
    # Dashboard
    DevSummary,
    KpiSummary,
    KpiDelta,
    DashboardResponse,
    # Management
    WeekSummary,
    DevDelivery,
    ProductDelivery,
    TypeBreakdown,
    DevWeekSummary,
    ManagementData,
    # Admin
    BU,
    AccountRanking,
    User,
    UserCreate,
    UserUpdate,
)

from .enums import (
    Role,
    BUType,
    StatusCategory,
    ActivityType,
    IssueTypeValue,
    PriorityLevel,
    TokenType,
)

from .exceptions import (
    # Base
    DomainException,
    # Auth
    AuthenticationException,
    InvalidCredentialsException,
    TokenExpiredException,
    InvalidTokenException,
    UnauthorizedException,
    # Resource
    ResourceException,
    ResourceNotFoundException,
    ResourceAlreadyExistsException,
    # Validation
    ValidationException,
    InvalidInputException,
    RateLimitException,
    # Integration
    IntegrationException,
    JiraException,
    CacheException,
    DatabaseException,
    # Business
    BusinessRuleException,
    InsufficientPermissionsException,
)

from .entities import (
    Dev,
    IssueAggregate,
    Team,
)

__all__ = [
    # Models
    "LoginRequest",
    "TokenResponse",
    "RefreshTokenRequest",
    "TimeInStatus",
    "Assignee",
    "IssueType",
    "Status",
    "Priority",
    "Component",
    "Issue",
    "DevSummary",
    "KpiSummary",
    "KpiDelta",
    "DashboardResponse",
    "WeekSummary",
    "DevDelivery",
    "ProductDelivery",
    "TypeBreakdown",
    "DevWeekSummary",
    "ManagementData",
    "BU",
    "AccountRanking",
    "User",
    "UserCreate",
    "UserUpdate",
    # Enums
    "Role",
    "BUType",
    "StatusCategory",
    "ActivityType",
    "IssueTypeValue",
    "PriorityLevel",
    "TokenType",
    # Exceptions
    "DomainException",
    "AuthenticationException",
    "InvalidCredentialsException",
    "TokenExpiredException",
    "InvalidTokenException",
    "UnauthorizedException",
    "ResourceException",
    "ResourceNotFoundException",
    "ResourceAlreadyExistsException",
    "ValidationException",
    "InvalidInputException",
    "RateLimitException",
    "IntegrationException",
    "JiraException",
    "CacheException",
    "DatabaseException",
    "BusinessRuleException",
    "InsufficientPermissionsException",
    # Entities
    "Dev",
    "IssueAggregate",
    "Team",
]
