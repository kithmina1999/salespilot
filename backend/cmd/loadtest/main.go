package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

type headerFlags []string

func (h *headerFlags) String() string {
	return strings.Join(*h, ",")
}

func (h *headerFlags) Set(value string) error {
	if !strings.Contains(value, ":") {
		return fmt.Errorf("header must be in 'Name: value' form")
	}
	*h = append(*h, value)
	return nil
}

type config struct {
	URL          string
	Method       string
	Body         []byte
	Headers      headerFlags
	VUs          int
	Duration     time.Duration
	Timeout      time.Duration
	ExpectStatus int
	MaxErrorRate float64
	MaxP95       time.Duration
	InsecureTLS  bool
}

type result struct {
	status  int
	latency time.Duration
	err     error
}

type summary struct {
	Total       int
	Success     int
	Failed      int
	ErrorRate   float64
	RPS         float64
	Min         time.Duration
	P50         time.Duration
	P95         time.Duration
	P99         time.Duration
	Max         time.Duration
	Elapsed     time.Duration
	StatusCodes map[int]int
	Errors      map[string]int
}

func main() {
	cfg, err := parseConfig(os.Args[1:])
	if err != nil {
		fmt.Fprintln(os.Stderr, "loadtest:", err)
		os.Exit(2)
	}

	ctx := context.Background()
	result := runLoadTest(ctx, cfg)
	printSummary(result)

	if err := evaluate(result, cfg); err != nil {
		fmt.Fprintln(os.Stderr, "loadtest failed:", err)
		os.Exit(1)
	}
}

func parseConfig(args []string) (config, error) {
	var cfg config
	var body string
	var bodyFile string

	fs := flag.NewFlagSet("loadtest", flag.ContinueOnError)
	fs.StringVar(&cfg.URL, "url", "http://127.0.0.1:8080/health", "target URL")
	fs.StringVar(&cfg.Method, "method", http.MethodGet, "HTTP method")
	fs.StringVar(&body, "body", "", "request body")
	fs.StringVar(&bodyFile, "body-file", "", "request body file")
	fs.Var(&cfg.Headers, "header", "request header, repeatable, e.g. 'Authorization: Bearer token'")
	fs.IntVar(&cfg.VUs, "vus", 100, "concurrent virtual users")
	fs.DurationVar(&cfg.Duration, "duration", 1*time.Minute, "test duration")
	fs.DurationVar(&cfg.Timeout, "timeout", 30*time.Second, "per-request timeout")
	fs.IntVar(&cfg.ExpectStatus, "expect-status", http.StatusOK, "expected HTTP status; set 0 for any 2xx")
	fs.Float64Var(&cfg.MaxErrorRate, "max-error-rate", 0.01, "maximum allowed failed request rate")
	fs.DurationVar(&cfg.MaxP95, "max-p95", 1*time.Second, "maximum allowed p95 latency")
	fs.BoolVar(&cfg.InsecureTLS, "insecure-tls", false, "skip TLS verification")
	fs.SetOutput(io.Discard)

	if err := fs.Parse(args); err != nil {
		return cfg, err
	}
	if cfg.URL == "" {
		return cfg, fmt.Errorf("--url is required")
	}
	if cfg.VUs <= 0 {
		return cfg, fmt.Errorf("--vus must be greater than 0")
	}
	if cfg.Duration <= 0 {
		return cfg, fmt.Errorf("--duration must be greater than 0")
	}
	if cfg.Timeout <= 0 {
		return cfg, fmt.Errorf("--timeout must be greater than 0")
	}
	if cfg.MaxErrorRate < 0 || cfg.MaxErrorRate > 1 {
		return cfg, fmt.Errorf("--max-error-rate must be between 0 and 1")
	}

	if bodyFile != "" {
		data, err := os.ReadFile(bodyFile)
		if err != nil {
			return cfg, fmt.Errorf("read body file: %w", err)
		}
		cfg.Body = data
	} else {
		cfg.Body = []byte(body)
	}

	cfg.Method = strings.ToUpper(cfg.Method)
	return cfg, nil
}

func runLoadTest(parent context.Context, cfg config) summary {
	stopCtx, cancel := context.WithTimeout(parent, cfg.Duration)
	defer cancel()

	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   10 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          cfg.VUs * 2,
		MaxIdleConnsPerHost:   cfg.VUs * 2,
		MaxConnsPerHost:       cfg.VUs * 2,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: cfg.Timeout,
	}
	if cfg.InsecureTLS {
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true} //nolint:gosec
	}

	client := &http.Client{
		Timeout:   cfg.Timeout,
		Transport: transport,
	}

	results := make(chan result, cfg.VUs*2)
	var wg sync.WaitGroup
	started := time.Now()

	for i := 0; i < cfg.VUs; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-stopCtx.Done():
					return
				default:
					results <- doRequest(parent, client, cfg)
				}
			}
		}()
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	collected := collectResults(results, cfg.ExpectStatus)
	collected.Elapsed = time.Since(started)
	if collected.Elapsed > 0 {
		collected.RPS = float64(collected.Total) / collected.Elapsed.Seconds()
	}
	if collected.Total > 0 {
		collected.ErrorRate = float64(collected.Failed) / float64(collected.Total)
	}
	return collected
}

func doRequest(ctx context.Context, client *http.Client, cfg config) result {
	var body io.Reader
	if len(cfg.Body) > 0 {
		body = bytes.NewReader(cfg.Body)
	}

	req, err := http.NewRequestWithContext(ctx, cfg.Method, cfg.URL, body)
	if err != nil {
		return result{err: err}
	}
	for _, raw := range cfg.Headers {
		name, value, _ := strings.Cut(raw, ":")
		req.Header.Add(strings.TrimSpace(name), strings.TrimSpace(value))
	}
	if len(cfg.Body) > 0 && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	start := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		return result{latency: time.Since(start), err: err}
	}
	defer resp.Body.Close()

	_, readErr := io.Copy(io.Discard, resp.Body)
	latency := time.Since(start)
	if readErr != nil {
		return result{status: resp.StatusCode, latency: latency, err: readErr}
	}
	return result{status: resp.StatusCode, latency: latency}
}

func collectResults(results <-chan result, expectStatus int) summary {
	s := summary{
		StatusCodes: make(map[int]int),
		Errors:      make(map[string]int),
	}
	latencies := make([]time.Duration, 0)

	for res := range results {
		s.Total++
		if res.latency > 0 {
			latencies = append(latencies, res.latency)
		}
		if res.status != 0 {
			s.StatusCodes[res.status]++
		}
		if res.err != nil {
			s.Failed++
			s.Errors[res.err.Error()]++
			continue
		}
		if statusOK(res.status, expectStatus) {
			s.Success++
		} else {
			s.Failed++
		}
	}

	sort.Slice(latencies, func(i, j int) bool { return latencies[i] < latencies[j] })
	if len(latencies) > 0 {
		s.Min = latencies[0]
		s.P50 = percentile(latencies, 50)
		s.P95 = percentile(latencies, 95)
		s.P99 = percentile(latencies, 99)
		s.Max = latencies[len(latencies)-1]
	}
	return s
}

func statusOK(status, expectStatus int) bool {
	if expectStatus == 0 {
		return status >= 200 && status < 300
	}
	return status == expectStatus
}

func percentile(sorted []time.Duration, p int) time.Duration {
	if len(sorted) == 0 {
		return 0
	}
	if p <= 0 {
		return sorted[0]
	}
	if p >= 100 {
		return sorted[len(sorted)-1]
	}
	index := (p*len(sorted) + 99) / 100
	if index < 1 {
		index = 1
	}
	return sorted[index-1]
}

func evaluate(s summary, cfg config) error {
	if s.Total == 0 {
		return fmt.Errorf("no requests completed")
	}
	if s.ErrorRate > cfg.MaxErrorRate {
		return fmt.Errorf("error rate %.2f%% exceeded %.2f%%", s.ErrorRate*100, cfg.MaxErrorRate*100)
	}
	if cfg.MaxP95 > 0 && s.P95 > cfg.MaxP95 {
		return fmt.Errorf("p95 %s exceeded %s", s.P95, cfg.MaxP95)
	}
	return nil
}

func printSummary(s summary) {
	fmt.Println("Load test summary")
	fmt.Printf("  requests: %d total, %d success, %d failed\n", s.Total, s.Success, s.Failed)
	fmt.Printf("  elapsed:  %s\n", s.Elapsed.Round(time.Millisecond))
	fmt.Printf("  rps:      %.2f\n", s.RPS)
	fmt.Printf("  errors:   %.2f%%\n", s.ErrorRate*100)
	fmt.Printf("  latency:  min=%s p50=%s p95=%s p99=%s max=%s\n", s.Min, s.P50, s.P95, s.P99, s.Max)

	if len(s.StatusCodes) > 0 {
		fmt.Println("  status codes:")
		codes := make([]int, 0, len(s.StatusCodes))
		for code := range s.StatusCodes {
			codes = append(codes, code)
		}
		sort.Ints(codes)
		for _, code := range codes {
			fmt.Printf("    %d: %d\n", code, s.StatusCodes[code])
		}
	}

	if len(s.Errors) > 0 {
		fmt.Println("  top errors:")
		type pair struct {
			message string
			count   int
		}
		pairs := make([]pair, 0, len(s.Errors))
		for message, count := range s.Errors {
			pairs = append(pairs, pair{message: message, count: count})
		}
		sort.Slice(pairs, func(i, j int) bool { return pairs[i].count > pairs[j].count })
		for i, item := range pairs {
			if i >= 5 {
				break
			}
			fmt.Printf("    %d: %s\n", item.count, item.message)
		}
	}
}
