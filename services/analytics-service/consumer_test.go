package main

import (
	"testing"
	"time"
)

func TestParseEvent(t *testing.T) {
	e := parseEvent(map[string]any{"orgId": `"abc"`, "type": "feature", "projectId": "null", "n": "5"})
	want := map[string]string{"orgId": "abc", "type": "feature", "projectId": "", "n": "5"}
	for k, v := range want {
		if e[k] != v {
			t.Errorf("%s = %q, want %q", k, e[k], v)
		}
	}
}

func TestIsoWeek(t *testing.T) {
	cases := map[string]string{"2026-01-01": "2026-W01", "2027-01-01": "2026-W53", "2026-11-09": "2026-W46"}
	for in, want := range cases {
		d, _ := time.Parse("2006-01-02", in)
		if got := isoWeek(d); got != want {
			t.Errorf("isoWeek(%s) = %s, want %s", in, got, want)
		}
	}
}

func TestScopes(t *testing.T) {
	if got := scopes(""); len(got) != 1 {
		t.Errorf("scopes(\"\") = %v", got)
	}
	if got := scopes("p1"); len(got) != 2 || got[1] != "p1" {
		t.Errorf("scopes(p1) = %v", got)
	}
}
