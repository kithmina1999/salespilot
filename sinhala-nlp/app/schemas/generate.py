from typing import Any, Dict, List, Optional
from pydantic import BaseModel,Field
from app.schemas.common import DialectType,TonePolicy

class StoreContext(BaseModel):
    product_name: Optional[str] = None
    is_available: bool = True
    available_sizes: List[str] = Field(default_factory=list)
    price_lkr: Optional[int] = None
    delivery_cost_lkr: Optional[int] = None
    estimated_days: Optional[str] = None
    extra_details: Dict[str, Any] = Field(default_factory=dict)
    
    
class GenerateRequest(BaseModel):
    business_name: str
    customer_dialect: DialectType = DialectType.SINGLISH
    tone_policy: TonePolicy = TonePolicy.FRIENDLY_COLLOQUIAL
    context: StoreContext
    customer_query: str
    
    
class GenerateResponse(BaseModel):
    reply: str = Field(..., description="Colloquial WhatsApp response")
    dialect: DialectType
    suggested_actions: List[str] = Field(default_factory=list)
