package utils

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/kithmina1999/salespilot/config"
	"github.com/kithmina1999/salespilot/httpclient"
)

// SendVerificationEmail sends a 6-digit OTP code to the user via Resend
func SendVerificationEmail(toEmail, otp string) error {
	return SendVerificationEmailContext(context.Background(), toEmail, otp)
}

func SendVerificationEmailContext(ctx context.Context, toEmail, otp string) error {
	cfg := config.Load()

	if cfg.ResendAPIKey == "" {
		log.Println("RESEND_API_KEY is missing; verification email was simulated without logging its recipient or OTP")
		return nil
	}

	url := "https://api.resend.com/emails"

	htmlContent := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 10px; padding: 30px; background-color: #ffffff;">
			<h2 style="color: #111827; margin-bottom: 20px;">Verify your SalesPilot account</h2>
			<p style="color: #4b5563; font-size: 16px; margin-bottom: 30px;">
				Please use the following 6-digit code to verify your email address and activate your account. This code expires in 15 minutes.
			</p>
			
			<div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
				<h1 style="color: #111827; letter-spacing: 5px; font-size: 32px; margin: 0;">%s</h1>
			</div>
			
			<p style="color: #6b7280; font-size: 14px;">
				If you did not request this email, you can safely ignore it.
			</p>
		</div>
	`, otp)

	payload := map[string]interface{}{
		"from":    cfg.ResendFromEmail,
		"to":      []string{toEmail},
		"subject": "Your SalesPilot Verification Code: " + otp,
		"html":    htmlContent,
	}

	jsonPayload, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+cfg.ResendAPIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpclient.DoContext(ctx, httpclient.DependencyResend, "send_verification_email", req, httpclient.NoRetry)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
		return fmt.Errorf("failed to send email via Resend, status code: %d", resp.StatusCode)
	}

	log.Println("Email OTP sent successfully")
	return nil
}

// SendActivationCodeEmail sends the activation code to a tenant after admin approves their payment proof.
func SendActivationCodeEmail(toEmail, businessName, code, plan, cycle string, durationDays int) error {
	return SendActivationCodeEmailContext(context.Background(), toEmail, businessName, code, plan, cycle, durationDays)
}

func SendActivationCodeEmailContext(ctx context.Context, toEmail, businessName, code, plan, cycle string, durationDays int) error {
	cfg := config.Load()

	if cfg.ResendAPIKey == "" {
		log.Println("RESEND_API_KEY is missing; activation email was simulated without logging its recipient or code")
		return nil
	}

	cycleLabel := map[string]string{
		"monthly":   "Monthly (30 days)",
		"quarterly": "Quarterly (90 days)",
		"annual":    "Annual (365 days)",
	}[cycle]
	if cycleLabel == "" {
		cycleLabel = fmt.Sprintf("%d days", durationDays)
	}

	htmlContent := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #0a0a0a; border: 1px solid #1f1f1f; border-radius: 16px; padding: 40px;">
			<div style="text-align: center; margin-bottom: 32px;">
				<div style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 12px; padding: 12px 20px;">
					<span style="color: #000; font-size: 18px; font-weight: 900; letter-spacing: -0.03em;">SalesPilot</span>
				</div>
			</div>
			<h2 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0 0 8px; letter-spacing: -0.02em;">Payment Verified! 🎉</h2>
			<p style="color: #9ca3af; font-size: 15px; margin: 0 0 32px; line-height: 1.6;">
				Hi <strong style="color: #e5e7eb;">%s</strong>, your bank transfer has been verified. Here is your activation code:
			</p>

			<div style="background: #111; border: 2px dashed #f59e0b; border-radius: 12px; padding: 28px; text-align: center; margin-bottom: 32px;">
				<p style="color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 10px;">Your Activation Code</p>
				<h1 style="color: #f59e0b; font-family: monospace; font-size: 36px; letter-spacing: 6px; margin: 0; font-weight: 900;">%s</h1>
				<p style="color: #4b5563; font-size: 13px; margin: 12px 0 0;"><strong style="color: #9ca3af;">Plan:</strong> %s &nbsp;·&nbsp; <strong style="color: #9ca3af;">Duration:</strong> %s</p>
			</div>

			<div style="background: #111827; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
				<p style="color: #e5e7eb; font-size: 14px; font-weight: 700; margin: 0 0 12px;">How to activate:</p>
				<ol style="color: #9ca3af; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
					<li>Login to your <a href="https://app.salespilot.lk/dashboard/usage" style="color: #f59e0b;">SalesPilot dashboard</a></li>
					<li>Go to <strong style="color: #e5e7eb;">Usage &amp; Plan</strong></li>
					<li>Click the <strong style="color: #e5e7eb;">"Activate Code"</strong> tab</li>
					<li>Paste the code above and click Activate</li>
				</ol>
			</div>

			<p style="color: #4b5563; font-size: 13px; text-align: center; margin: 0;">
				Questions? WhatsApp us anytime — we reply fast 😊
			</p>
		</div>
	`, businessName, code, plan, cycleLabel)

	payload := map[string]interface{}{
		"from":    cfg.ResendFromEmail,
		"to":      []string{toEmail},
		"subject": fmt.Sprintf("Your SalesPilot activation code: %s 🎉", code),
		"html":    htmlContent,
	}

	jsonPayload, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.ResendAPIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpclient.DoContext(ctx, httpclient.DependencyResend, "send_activation_email", req, httpclient.NoRetry)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
		return fmt.Errorf("resend activation email failed: status %d", resp.StatusCode)
	}

	log.Println("Activation code email sent successfully")
	return nil
}

// SendLateDeliveryEmail alerts the tenant (admin email) when a shipped order
// has not been delivered within the expected window.
// This is email-based (not WhatsApp) because late deliveries are cold outbound
// — outside the Meta 24-hour session window.
func SendLateDeliveryEmail(toEmail, businessName string, orderNum int64, customerName, customerPhone string, daysLate int, totalPrice float64) error {
	return SendLateDeliveryEmailContext(context.Background(), toEmail, businessName, orderNum, customerName, customerPhone, daysLate, totalPrice)
}

func SendLateDeliveryEmailContext(ctx context.Context, toEmail, businessName string, orderNum int64, customerName, customerPhone string, daysLate int, totalPrice float64) error {
	cfg := config.Load()

	if cfg.ResendAPIKey == "" {
		log.Printf("RESEND_API_KEY is missing; late-delivery email for order %d was simulated", orderNum)
		return nil
	}

	html := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #0a0a0a; border: 1px solid #292524; border-radius: 16px; padding: 40px;">
			<div style="text-align: center; margin-bottom: 28px;">
				<div style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 12px; padding: 10px 18px;">
					<span style="color: #000; font-size: 16px; font-weight: 900; letter-spacing: -0.03em;">SalesPilot</span>
				</div>
			</div>

			<div style="background: #7c2d12; border-radius: 12px; padding: 20px; margin-bottom: 28px; border: 1px solid #c2410c;">
				<p style="color: #fed7aa; font-size: 20px; font-weight: 800; margin: 0 0 4px;">⚠️ Late Delivery Alert</p>
				<p style="color: #fb923c; font-size: 14px; margin: 0;">Order #%d — %s</p>
			</div>

			<p style="color: #9ca3af; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
				Hi <strong style="color: #e5e7eb;">%s</strong>, an order has been in <strong style="color: #fb923c;">Shipped</strong> status
				for <strong style="color: #f87171;">%d days</strong> with no delivery update. Please follow up with your courier.
			</p>

			<div style="background: #111827; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
				<table style="width: 100%%; border-collapse: collapse;">
					<tr>
						<td style="color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 6px 0;">Order</td>
						<td style="color: #e5e7eb; font-size: 14px; font-weight: 700; text-align: right; padding: 6px 0;">#%d</td>
					</tr>
					<tr>
						<td style="color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 6px 0;">Customer</td>
						<td style="color: #e5e7eb; font-size: 14px; font-weight: 700; text-align: right; padding: 6px 0;">%s (%s)</td>
					</tr>
					<tr>
						<td style="color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 6px 0;">Total</td>
						<td style="color: #34d399; font-size: 14px; font-weight: 700; text-align: right; padding: 6px 0;">Rs. %.0f</td>
					</tr>
					<tr>
						<td style="color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 6px 0;">Days in Shipped</td>
						<td style="color: #f87171; font-size: 14px; font-weight: 700; text-align: right; padding: 6px 0;">%d days</td>
					</tr>
				</table>
			</div>

			<p style="color: #4b5563; font-size: 13px; text-align: center; margin: 0;">
				Log in to your <a href="https://app.salespilot.lk/dashboard/orders" style="color: #f59e0b;">SalesPilot dashboard</a>
				to update the order status and notify your customer.
			</p>
		</div>
	`, orderNum, businessName, businessName, daysLate, orderNum, customerName, customerPhone, totalPrice, daysLate)

	payload := map[string]interface{}{
		"from":    cfg.ResendFromEmail,
		"to":      []string{toEmail},
		"subject": fmt.Sprintf("⚠️ Late Delivery: Order #%d is %d days overdue — %s", orderNum, daysLate, businessName),
		"html":    html,
	}

	jsonPayload, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.ResendAPIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpclient.DoContext(ctx, httpclient.DependencyResend, "send_late_delivery_email", req, httpclient.NoRetry)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
		return fmt.Errorf("late delivery email failed: status %d", resp.StatusCode)
	}

	log.Printf("Late-delivery email sent for order %d (%d days late)", orderNum, daysLate)
	return nil
}
