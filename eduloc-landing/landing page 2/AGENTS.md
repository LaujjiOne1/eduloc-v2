# AGENTS.md
- The edUloc Android app is the system of record; this site never duplicates tutor/booking logic. Why: brief forbids a second management system.
- All contact channels, APK URL and future agent-console endpoint live in src/config/eduloc.ts; UI hides channels whose value is empty. Why: no fake contact info may be shown.
- Help requests are stored in the support_requests table (anon insert-only, status column for a future agent console). Why: requests must really be recorded, never simulated.
- Floating customer support uses local guided answers and embeds the existing request assistant; it never claims a live human connection. Why: no agent messaging service is connected.
- MotionThreads is a lightweight canvas interpretation of the uploaded reference, with reduced-motion support. Why: the upload contains usage props, not the WebThreads implementation.
- Use ScrollReveal for one-time viewport-triggered section and item entrances, respecting reduced-motion preferences. Why: scroll animation stays consistent without hiding content from motion-sensitive users.
