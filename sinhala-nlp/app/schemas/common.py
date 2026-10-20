from enum import Enum

class DialectType(str, Enum):
    SINGLISH = "singlish"              # Phonetic Sinhala in English script 
    SINHALA_UNICODE = "sinhala_unicode"# Spoken Sinhala in Sinhala script 
    ENGLISH = "english"                # Standard English 
    MIXED = "mixed"                    # Code-switching 

class IntentType(str, Enum):
    CHECK_STOCK = "check_stock"
    CHECK_PRICE = "check_price"
    CHECK_STOCK_AND_DELIVERY = "check_stock_and_delivery"
    DELIVERY_INQUIRY = "delivery_inquiry"
    CONFIRM_ORDER = "confirm_order"
    CANCEL_ORDER = "cancel_order"
    ASK_DETAILS = "ask_details"
    GREETING = "greeting"
    COMPLAINT = "complaint"
    HUMAN_AGENT = "human_agent"
    UNKNOWN = "unknown"

class TonePolicy(str, Enum):
    FRIENDLY_COLLOQUIAL = "friendly_colloquial"
    RESPECTFUL_FORMAL = "respectful_formal"