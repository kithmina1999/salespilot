package utils

import (
	"errors"
	"log"
	"os"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// jwtSecret is loaded lazily on first use via sync.Once.
// This ensures godotenv.Load() in config.Load() has already run before we
// read JWT_SECRET — avoiding the init() ordering problem.
var (
	jwtSecret     []byte
	jwtSecretOnce sync.Once
)

func getJWTSecret() []byte {
	jwtSecretOnce.Do(func() {
		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			log.Fatal("❌ FATAL: JWT_SECRET environment variable is not set. Cannot sign tokens securely.")
		}
		if len(secret) < 32 {
			log.Fatal("❌ FATAL: JWT_SECRET is too short (minimum 32 characters required for security).")
		}
		jwtSecret = []byte(secret)
	})
	return jwtSecret
}

type Claims struct {
	UserID     uint   `json:"user_id"`
	BusinessID uint   `json:"business_id"`
	Role       string `json:"role"`
	SessionID  string `json:"session_id"` // links to user_sessions.session_token
	jwt.RegisteredClaims
}

func GenerateToken(userID, businessID uint, role string, sessionID string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour * 7) // 1 week
	claims := &Claims{
		UserID:     userID,
		BusinessID: businessID,
		Role:       role,
		SessionID:  sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(getJWTSecret())
}

func ValidateToken(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		return getJWTSecret(), nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
