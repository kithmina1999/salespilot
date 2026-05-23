package utils

import (
	"log"
	"sync"
)

// WebhookJob is a unit of work passed to the worker pool.
type WebhookJob func()

var (
	jobQueue chan WebhookJob
	wg       sync.WaitGroup
)

// InitWorkerPool starts a fixed pool of `workers` goroutines consuming jobQueue.
// Buffer size of 5000 absorbs Meta retry storms without blocking the HTTP handler.
func InitWorkerPool(workers int) {
	jobQueue = make(chan WebhookJob, 5000)
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for job := range jobQueue {
				job()
			}
			log.Printf("🔌 Worker %d shut down cleanly", id)
		}(i)
	}
}

// EnqueueWebhook submits a job. Non-blocking; returns false if the channel is full.
// Callers that are still holding an external delivery ACK should return a retryable
// error when this fails instead of silently losing the payload.
func EnqueueWebhook(job WebhookJob) bool {
	select {
	case jobQueue <- job:
		return true
	default:
		log.Println("⚠️ Worker pool queue full — dropping webhook payload")
		go AlertWorkerPoolFull() // alert team without blocking the HTTP handler
		return false
	}
}

// DrainAndWait closes the job queue and blocks until all workers finish.
// Call this from main.go on SIGTERM/SIGINT.
func DrainAndWait() {
	close(jobQueue)
	wg.Wait()
}
