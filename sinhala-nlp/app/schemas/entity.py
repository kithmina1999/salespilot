from typing import Optional
from pydantic import BaseModel, Field


class ProductAttributes(BaseModel):
    color: Optional[str] = Field(None, description="Extracted color (e.g., 'black', 'kalu')")
    size: Optional[str] = Field(None, description="Extracted garment/item size (e.g., 'M', 'XL')")
    variant: Optional[str] = Field(None, description="Variant specification if applicable")

class ExtractedEntities(BaseModel):
    product_name: Optional[str] = Field(None, description="Explicit or inferred product name")
    attributes: ProductAttributes = Field(default_factory=ProductAttributes)
    location: Optional[str] = Field(None, description="Target delivery city/area (e.g., 'Colombo 03')")
    delivery_inquiry: bool = Field(False, description="Whether the user asked about delivery terms/rates")
    quantity: Optional[int] = Field(1, description="Quantity mentioned, defaults to 1")

