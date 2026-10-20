from typing import Optional
from pydantic import BaseModel, Field
from app.schemas.common import DialectType, IntentType
from app.schemas.entity import ExtractedEntities

class ParseRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Raw customer message from WhatsApp")
    business_id: str = Field(..., description="SalesPilot merchant/tenant ID")
    customer_phone: Optional[str] = Field(None, description="Customer phone number (e.g., +9477...)")
    
    
class ParseResponse(BaseModel):
    intent: IntentType
    confidence: float = Field(..., ge=0.0, le=1.0)
    detected_dialect: DialectType
    language_code: str = Field(..., description="Language identifier (e.g., 'si-en', 'si', 'en')")
    entities: ExtractedEntities
    is_greeting: bool = False
    cached: bool = False
