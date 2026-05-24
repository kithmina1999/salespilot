package handlers

import (
	"testing"

	"github.com/kithmina1999/salespilot/models"
)

func TestEffectiveWAStatus(t *testing.T) {
	tests := []struct {
		name string
		biz  models.Business
		want string
	}{
		{
			name: "connected requires saved credentials",
			biz: models.Business{
				WAStatus:        waStatusConnected,
				WAPhoneNumberID: "123",
				WAAccessToken:   "token",
			},
			want: waStatusConnected,
		},
		{
			name: "raw connected without token is not connected",
			biz: models.Business{
				WAStatus:        waStatusConnected,
				WAPhoneNumberID: "123",
			},
			want: waStatusNotConnected,
		},
		{
			name: "raw connected without phone id is not connected",
			biz: models.Business{
				WAStatus:      waStatusConnected,
				WAAccessToken: "token",
			},
			want: waStatusNotConnected,
		},
		{
			name: "disconnected credentials stay disconnected",
			biz: models.Business{
				WAStatus:        waStatusDisconnected,
				WAPhoneNumberID: "123",
				WAAccessToken:   "token",
			},
			want: waStatusDisconnected,
		},
		{
			name: "not connected credentials stay not connected",
			biz: models.Business{
				WAStatus:        waStatusNotConnected,
				WAPhoneNumberID: "123",
				WAAccessToken:   "token",
			},
			want: waStatusNotConnected,
		},
		{
			name: "unknown status with credentials fails closed",
			biz: models.Business{
				WAStatus:        "mystery",
				WAPhoneNumberID: "123",
				WAAccessToken:   "token",
			},
			want: waStatusDisconnected,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := effectiveWAStatus(tt.biz); got != tt.want {
				t.Fatalf("effectiveWAStatus() = %q, want %q", got, tt.want)
			}
		})
	}
}
