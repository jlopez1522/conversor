# AGENTS.md — Transcriptor Web Local

## Mission
Build and maintain a browser-only transcription application for long recordings (3+ hours). Users select local video/audio files, transcribe spoken Spanish, review the result, and export complete timestamped TXT and DOCX documents. The interface and user-facing documentation must be in Spanish.

## Technology policy (mandatory)
- **TypeScript first**: use strict TypeScript for application logic, React components (`.tsx`), Web Workers, utilities, tests, and browser storage. Use JavaScript only when a dependency or build configuration genuinely requires it.
- Frontend: React, Vite, Tailwind CSS.
- Speech recognition: Transformers.js with a browser-compatible Whisper model, executing locally with WebGPU when available and a tested WASM/CPU fallback when practical.
- Media decoding: browser-compatible JavaScript/TypeScript libraries such as Mediabunny and Web Audio APIs. Verify support for each advertised input format; do not promise universal codec support.
- Background work: Web Workers. Persistence: IndexedDB. Document export: `docx` for Word and browser-native Blob for UTF-8 TXT.
- Deployment: static assets on Vercel. No application server, serverless transcription endpoint, Python, Flask, FastAPI, Node.js runtime backend, Electron, native executable, or required desktop installation. Node.js is permitted only as a development/build tool in CI/Vercel, not on the end user's computer.
- Do not introduce paid transcription APIs, hosted inference, or generative summarization.

## Privacy and security
- Never upload user audio, video, transcripts, or audio-derived embeddings to any server.
- Model and static asset downloads are permitted; disclose the model source and approximate download size.
- Do not add telemetry, analytics, logging, crash reporting, or external integrations that transmit file content.
- Keep the selected files and transcript in the browser; only persist transcript segments and metadata needed for recovery in IndexedDB.
- Clearly explain that browser/device policies may restrict model downloads, storage, WebGPU, or WASM.
- Never claim the application is approved for company-confidential recordings; remind users to follow organizational policies.

## Long-recording processing
- Design for 3+ hour files without loading the entire video or decoded audio into RAM.
- Decode/extract audio incrementally, resample to the model's expected sample rate, and process bounded segments (typically 20–30 seconds; overlap only if justified and correctly deduplicated).
- Use a dedicated worker for transcription; keep the UI responsive. Release intermediate buffers promptly.
- Persist each successful segment atomically in IndexedDB with absolute start/end timestamps, text, source fingerprint, model identifier/version, and processing settings.
- Pause at segment boundaries; support cancel, retry, and resume. Never claim processing continues after the tab closes.
- On return, ask the user to reselect the source file if required by browser security, verify it matches the saved job, and resume from the last committed segment.
- Provide meaningful progress, completed/remaining segment counts, and honest performance warnings; do not guarantee processing time or unlimited file size.

## Transcription fidelity
- Default to Spanish, with optional language detection only when supported by the selected model.
- Preserve spoken content; do not summarize, paraphrase, or invent missing words.
- Show absolute timestamps (`[HH:MM:SS]`) based on verified segment offsets; distinguish chunk-level timestamps from word-level timestamps.
- Permit manual correction before export; persist edits without overwriting them on resume.
- Clearly display model loading, unsupported codec, inference, out-of-memory, storage-quota, and permission errors.

## UX requirements
- Spanish interface, accessible labels, keyboard-friendly controls, responsive layout.
- Multi-file queue with file name, size, duration when available, status, progress, pause/resume/cancel/retry.
- Preview and editable transcript with timestamps.
- Download separate `.txt` and `.docx` files per source; include original file name, duration if known, date, and complete timestamped transcription.
- Local job history and delete-data control; do not require accounts or cloud storage.

## Quality gates
- No mock transcripts, fake progress, placeholder transcription logic, or claims of functionality that has not been tested.
- Keep TypeScript strict; avoid `any` except where unavoidable and documented.
- Add automated tests for timestamp offsets, chunk ordering, resume behavior, fingerprint matching, edited segments, and TXT/DOCX exports.
- Run `npm install`, `npm run build`, and available tests after changes. Fix failures or report exact blockers.
- Test real browser inference and media decoding with short audio before claiming the full pipeline works. Document what cannot be tested in the current environment.
- Inspect browser network requests to ensure media/transcripts never leave the device.
- Document realistic CPU/WASM limitations, memory use, model download needs, browser support, and storage limits.

## Work conventions for Codex
1. Inspect the existing repository before editing; reuse working code rather than replacing it unnecessarily.
2. Prefer small, understandable TypeScript modules and a clean separation between UI, decoding, inference, persistence, and export.
3. Implement end-to-end vertical slices: real file -> decoded audio -> real transcript -> saved segment -> TXT/DOCX.
4. Do not silently substitute server processing when local processing is difficult; explain the trade-off instead.
5. After each substantial change, summarize in Spanish: changed files, tested commands, results, known limitations, and next steps.
6. Keep README instructions suitable for deploying through GitHub and Vercel without installing software on the corporate PC.

## Definition of done
A feature is complete only when it works with real browser-side processing, preserves privacy, handles failures, has appropriate tests, and can be built as a static Vite site for Vercel. Clearly label any unverified feature as pending validation.
