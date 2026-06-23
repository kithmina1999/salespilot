package providersecrets

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
)

const (
	ProviderTokenEnvVar = "PROVIDER_TOKEN_ENCRYPTION_KEYS"
	envelopePrefix      = "spenc:v1:"
)

type envelope struct {
	Version         int    `json:"v"`
	Algorithm       string `json:"alg"`
	KeyID           string `json:"kid"`
	WrappedKey      string `json:"wk"`
	WrappedKeyNonce string `json:"wkn"`
	Ciphertext      string `json:"ct"`
	Nonce           string `json:"n"`
}

type Keyring struct {
	primaryID string
	keys      map[string][]byte
}

func IsEncryptedProviderToken(value string) bool {
	return strings.HasPrefix(strings.TrimSpace(value), envelopePrefix)
}

func HasProviderToken(value string) bool {
	return strings.TrimSpace(value) != ""
}

func ParseKeyring(raw string) (*Keyring, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, fmt.Errorf("%s is required", ProviderTokenEnvVar)
	}

	keyring := &Keyring{keys: make(map[string][]byte)}
	for _, entry := range strings.Split(raw, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		parts := strings.SplitN(entry, ":", 2)
		if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
			return nil, fmt.Errorf("%s entry must be key-id:base64-32-byte-key", ProviderTokenEnvVar)
		}

		keyID := strings.TrimSpace(parts[0])
		key, err := decodeKey(strings.TrimSpace(parts[1]))
		if err != nil {
			return nil, fmt.Errorf("%s key %q: %w", ProviderTokenEnvVar, keyID, err)
		}
		if _, exists := keyring.keys[keyID]; exists {
			return nil, fmt.Errorf("%s has duplicate key id %q", ProviderTokenEnvVar, keyID)
		}
		if keyring.primaryID == "" {
			keyring.primaryID = keyID
		}
		keyring.keys[keyID] = key
	}
	if len(keyring.keys) == 0 {
		return nil, fmt.Errorf("%s does not contain any keys", ProviderTokenEnvVar)
	}
	return keyring, nil
}

func EncryptProviderToken(plaintext string) (string, error) {
	plaintext = strings.TrimSpace(plaintext)
	if plaintext == "" {
		return "", nil
	}
	if IsEncryptedProviderToken(plaintext) {
		return plaintext, nil
	}

	keyring, err := configuredKeyring()
	if err != nil {
		return "", err
	}
	return encryptWithKeyring(keyring, []byte(plaintext))
}

func DecryptProviderToken(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", nil
	}
	if !IsEncryptedProviderToken(value) {
		// Rolling migration compatibility: legacy plaintext tokens can still be
		// used while startup backfill converts them to encrypted envelopes.
		return value, nil
	}

	keyring, err := configuredKeyring()
	if err != nil {
		return "", err
	}
	plaintext, err := decryptWithKeyring(keyring, value)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

func BackfillBusinessWAAccessTokens(db *gorm.DB) (int, error) {
	var businesses []models.Business
	if err := db.Select("id", "wa_access_token").
		Where("wa_access_token <> ''").
		Find(&businesses).Error; err != nil {
		return 0, err
	}

	encryptedCount := 0
	for _, business := range businesses {
		if IsEncryptedProviderToken(business.WAAccessToken) {
			continue
		}
		encryptedToken, err := EncryptProviderToken(business.WAAccessToken)
		if err != nil {
			return encryptedCount, fmt.Errorf("encrypt business %d WhatsApp access token: %w", business.ID, err)
		}
		result := db.Model(&models.Business{}).
			Where("id = ? AND wa_access_token = ?", business.ID, business.WAAccessToken).
			Update("wa_access_token", encryptedToken)
		if result.Error != nil {
			return encryptedCount, result.Error
		}
		if result.RowsAffected > 0 {
			encryptedCount++
		}
	}
	return encryptedCount, nil
}

func configuredKeyring() (*Keyring, error) {
	return ParseKeyring(os.Getenv(ProviderTokenEnvVar))
}

func encryptWithKeyring(keyring *Keyring, plaintext []byte) (string, error) {
	keyID := keyring.primaryID
	kek := keyring.keys[keyID]

	dek := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, dek); err != nil {
		return "", err
	}

	wrappedKey, wrappedKeyNonce, err := seal(kek, dek, wrapAssociatedData(keyID))
	if err != nil {
		return "", err
	}
	ciphertext, nonce, err := seal(dek, plaintext, tokenAssociatedData(keyID))
	if err != nil {
		return "", err
	}

	env := envelope{
		Version:         1,
		Algorithm:       "AES-256-GCM+Envelope",
		KeyID:           keyID,
		WrappedKey:      encode(wrappedKey),
		WrappedKeyNonce: encode(wrappedKeyNonce),
		Ciphertext:      encode(ciphertext),
		Nonce:           encode(nonce),
	}
	payload, err := json.Marshal(env)
	if err != nil {
		return "", err
	}
	return envelopePrefix + encode(payload), nil
}

func decryptWithKeyring(keyring *Keyring, value string) ([]byte, error) {
	payload, err := decode(strings.TrimPrefix(value, envelopePrefix))
	if err != nil {
		return nil, fmt.Errorf("decode encrypted provider token: %w", err)
	}

	var env envelope
	if err := json.Unmarshal(payload, &env); err != nil {
		return nil, fmt.Errorf("parse encrypted provider token: %w", err)
	}
	if env.Version != 1 || env.Algorithm != "AES-256-GCM+Envelope" {
		return nil, errors.New("unsupported encrypted provider token envelope")
	}

	kek, exists := keyring.keys[env.KeyID]
	if !exists {
		return nil, fmt.Errorf("provider token encryption key %q is not configured", env.KeyID)
	}

	wrappedKey, err := decode(env.WrappedKey)
	if err != nil {
		return nil, fmt.Errorf("decode wrapped data key: %w", err)
	}
	wrappedKeyNonce, err := decode(env.WrappedKeyNonce)
	if err != nil {
		return nil, fmt.Errorf("decode wrapped data key nonce: %w", err)
	}
	dek, err := open(kek, wrappedKeyNonce, wrappedKey, wrapAssociatedData(env.KeyID))
	if err != nil {
		return nil, fmt.Errorf("unwrap provider token data key: %w", err)
	}

	ciphertext, err := decode(env.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("decode provider token ciphertext: %w", err)
	}
	nonce, err := decode(env.Nonce)
	if err != nil {
		return nil, fmt.Errorf("decode provider token nonce: %w", err)
	}
	plaintext, err := open(dek, nonce, ciphertext, tokenAssociatedData(env.KeyID))
	if err != nil {
		return nil, fmt.Errorf("decrypt provider token: %w", err)
	}
	return plaintext, nil
}

func seal(key, plaintext, associatedData []byte) ([]byte, []byte, error) {
	gcm, err := gcmForKey(key)
	if err != nil {
		return nil, nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, err
	}
	return gcm.Seal(nil, nonce, plaintext, associatedData), nonce, nil
}

func open(key, nonce, ciphertext, associatedData []byte) ([]byte, error) {
	gcm, err := gcmForKey(key)
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, nonce, ciphertext, associatedData)
}

func gcmForKey(key []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

func decodeKey(value string) ([]byte, error) {
	key, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		key, err = base64.RawStdEncoding.DecodeString(value)
	}
	if err != nil {
		return nil, fmt.Errorf("must be base64 encoded: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("must decode to 32 bytes, got %d", len(key))
	}
	return key, nil
}

func encode(data []byte) string {
	return base64.RawURLEncoding.EncodeToString(data)
}

func decode(value string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(value)
}

func wrapAssociatedData(keyID string) []byte {
	return []byte("salespilot/provider-token/wrap/v1/" + keyID)
}

func tokenAssociatedData(keyID string) []byte {
	return []byte("salespilot/provider-token/token/v1/" + keyID)
}
