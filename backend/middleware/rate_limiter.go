package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

var (
	visitors = make(map[string]int)
	mu       sync.Mutex
)

// init starts a background goroutine to reset the request counts every minute.
func init() {
	go func() {
		for {
			time.Sleep(1 * time.Minute)
			mu.Lock()
			// Clear the map every minute
			visitors = make(map[string]int)
			mu.Unlock()
		}
	}()
}

// RateLimit creates a rate limiter middleware preventing an IP from making more than maxRequests per minute.
// Since SalesPilot calls the API locally, this prevents the bot from making excessive API calls as a whole.
func RateLimit(maxRequests int) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()

		mu.Lock()
		count := visitors[ip]
		if count >= maxRequests {
			mu.Unlock()
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded. Try again in a minute.",
			})
			return
		}
		visitors[ip]++
		mu.Unlock()

		c.Next()
	}
}
