package models

import "time"

// PipelineLog represents a single inbound message processed by the system.
// It stores exactly how the intent router categorized the message and the resulting action.
type PipelineLog struct {
	ID                    uint      `gorm:"primaryKey" json:"id"`
	BusinessID            uint      `gorm:"index" json:"business_id"`
	Phone                 string    `gorm:"index" json:"phone"`
	RawMessage            string    `gorm:"type:text" json:"raw_message"`
	CleanMessage          string    `gorm:"type:text" json:"clean_message"`
	ReducedMessage        string    `gorm:"type:text" json:"reduced_message"`
	RouteTaken            string    `gorm:"index" json:"route_taken"`  // faq_high, faq_medium, semantic_direct, semantic_hint, gemini_raw, drop, context_bridge, gibberish, etc.
	ActionTaken           string    `gorm:"index" json:"action_taken"` // e.g. "replied", "escalated", "dropped"
	SelectedRuleID        *uint     `gorm:"index" json:"selected_rule_id"`
	SelectedMatchType     string    `json:"selected_match_type"`
	SelectedConfidence    float64   `json:"selected_confidence"`
	SelectedRawConfidence float64   `json:"selected_raw_confidence"`
	AIUsed                bool      `gorm:"index" json:"ai_used"`
	FAQHintUsed           bool      `json:"faq_hint_used"`
	
	// New Telemetry Fields
	BotReplyText          string    `gorm:"type:text" json:"bot_reply_text"`
	BotReplyPayload       string    `gorm:"type:text" json:"bot_reply_payload"`
	ErrorMessage          string    `gorm:"type:text" json:"error_message"`
	StateBefore           string    `gorm:"index" json:"state_before"`
	StateAfter            string    `gorm:"index" json:"state_after"`
	ExecutionTimeMs       int64     `json:"execution_time_ms"`
	IntentClassified      string    `gorm:"index" json:"intent_classified"`
	ModelUsed             string    `gorm:"index" json:"model_used"`
	
	IsSandbox             bool      `gorm:"index" json:"is_sandbox"`
	DebugMode             bool      `gorm:"index" json:"debug_mode"`
	CreatedAt             time.Time `gorm:"index" json:"created_at"`

	// Relationships
	SignalLogs []PipelineSignalLog `gorm:"foreignKey:PipelineLogID;constraint:OnDelete:CASCADE" json:"signal_logs"`
}

// PipelineSignalLog stores the granular matching confidence signals evaluated for a given message.
type PipelineSignalLog struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	PipelineLogID   uint      `gorm:"index;not null" json:"pipeline_log_id"`
	RuleID          uint      `gorm:"index" json:"rule_id"`
	MatchType       string    `json:"match_type"` // exact, partial, semantic
	MatchedEntry    string    `json:"matched_entry"`
	KeywordStrength string    `json:"keyword_strength"` // strong, domain_generic, stop_generic
	RawConfidence   float64   `json:"raw_confidence"`
	FinalConfidence float64   `json:"final_confidence"`
	MatchedTokens   int       `json:"matched_tokens"`
	MsgWordCount    int       `json:"msg_word_count"`
	Density         float64   `json:"density"`
	AfterWeight     float64   `json:"after_weight"`
	AfterModifiers  float64   `json:"after_modifiers"`
	AfterCaps       float64   `json:"after_caps"`
	RejectedReason  string    `json:"rejected_reason"`
	Rank            int       `json:"rank"`
	CreatedAt       time.Time `json:"created_at"`
}
