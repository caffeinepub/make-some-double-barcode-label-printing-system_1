# Specification

## Summary
**Goal:** Make Scan & Print reliably print offline by removing backend availability as a requirement for print success, and improve the backend-unavailable error UX.

**Planned changes:**
- Update Scan & Print auto-print flow so CPCL generation and printer sending succeed even when the backend canister is stopped/unavailable; backend submission becomes best-effort and non-blocking.
- Reorder and harden the print sequence: validate scans → generate CPCL → send to printer → attempt backend submission (optional), ensuring backend failures don’t overwrite a successful print result.
- Record print success locally (diagnostics counters + local print history including CPCL payload) regardless of backend call outcomes.
- Replace verbose replica rejection/error blobs in Scan & Print with concise, plain-English messages; for IC0508/canister-stopped, indicate the backend is unavailable while local printing can continue (if printer is connected).

**User-visible outcome:** Users can complete the 2-scan Scan & Print flow and successfully print to the connected printer even when the backend is unavailable, and any backend issues appear only as a small non-blocking notice rather than a blocking error with raw reject details.
