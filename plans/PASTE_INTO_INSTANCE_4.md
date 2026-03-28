# PASTE THIS INTO INSTANCE 4 (Video ML + Film Browser)

**URGENT**: Your Python pipeline is solid but you have ZERO frontend. No film page, no components, no API routes. The entire Next.js Film Browser is missing. Build it ALL now.

## ROUND 2: Build the Entire Film Browser UI (CRITICAL — start here)

### API Routes First

1. **`src/app/api/film/clips/route.ts`** — GET: list/search clips from film.db
   - Query params: `?q=search&player=name&tag=action&limit=20&offset=0`
   - Returns: `{ clips: Clip[], total: number }`
   - If film.db doesn't exist yet, return `{ clips: [], total: 0, message: "Film database initializing..." }`

2. **`src/app/api/film/clips/[id]/route.ts`** — GET: single clip details + analysis + tags

3. **`src/app/api/film/upload/route.ts`** — POST: handle file upload metadata (store in film.db)
   - Accept multipart form data or just JSON metadata for now
   - Create video record in film.db, return the ID

4. **`src/app/api/film/tags/route.ts`** — GET: list all tags with counts

5. **`src/app/api/film/process/route.ts`** — POST: trigger processing (just update status in DB for now)

### Film Page

6. **`src/app/film/page.tsx`** — The Film Library browser. This is the main page:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   🎬 FILM ROOM                                          │
│   Basketball intelligence meets video                    │
│                                                          │
│   [Search clips, players, actions...              🔍]   │
│                                                          │
│   Tags: [All] [Dunks] [3-Pointers] [Blocks] [Assists]  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│   │ [Thumbnail] │  │ [Thumbnail] │  │ [Thumbnail] │    │
│   │             │  │             │  │             │    │
│   │ Clip Title  │  │ Clip Title  │  │ Clip Title  │    │
│   │ Player • Tag│  │ Player • Tag│  │ Player • Tag│    │
│   │ 0:12 • Q3   │  │ 0:08 • Q1   │  │ 0:15 • Q4   │    │
│   └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                          │
│   [Load More]                                           │
│                                                          │
│   ─── OR if no clips yet ───                            │
│                                                          │
│   ┌──────────────────────────────────┐                  │
│   │  🎥 No clips yet                │                  │
│   │                                  │                  │
│   │  Upload your first clip to get   │                  │
│   │  started with film analysis      │                  │
│   │                                  │                  │
│   │  [Upload Clip →]                │                  │
│   └──────────────────────────────────┘                  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   How It Works                                           │
│                                                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│   │ 1. Upload│  │ 2. AI    │  │ 3. Browse│             │
│   │ a clip   │  │ analyzes │  │ insights │             │
│   └──────────┘  └──────────┘  └──────────┘             │
│                                                          │
│   Pipeline Status                                        │
│   Python ML: [Ready ✓]  Models: [Basic ✓]               │
│   Clips Processed: 0  Tags Generated: 0                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Use GlassCard for all cards. SectionHeader for section titles. SkeletonLoader for loading states. EmptyState component for the empty state. SearchBar for search. This page should look premium even with zero clips.

### Components

7. **`src/components/film/ClipCard.tsx`** — Thumbnail card for a clip:
   - 16:9 aspect ratio thumbnail area (dark placeholder with film icon if no thumbnail)
   - Title, player name, tag badges, duration
   - Glass card styling, hover lift animation
   - Click navigates to `/film/[id]`

8. **`src/components/film/TagBadge.tsx`** — Small colored pill for tags:
   - Color by category: action=orange, player=blue, team=green, context=violet, quality=gold
   - Compact: just text. Full: icon + text.

9. **`src/components/film/UploadZone.tsx`** — Drag-and-drop upload area:
   - Dashed border box with film icon
   - "Drag a clip here or click to browse"
   - Accept video formats: mp4, mov, webm
   - On drop: show file name + size, enable "Upload" button
   - Progress bar during upload (fake it with animation for now)
   - Glass morphism styling

10. **`src/components/film/FilmSearch.tsx`** — Search with filter pills:
    - Text search input (reuse SearchBar pattern)
    - Below: horizontal scrollable tag filter pills
    - Active filters highlighted in accent orange

11. **`src/components/film/ClipPlayer.tsx`** — Video player with annotations:
    - HTML5 video element with custom glass-morphism controls
    - Play/pause, scrubber, time display, fullscreen
    - Below the scrubber: event markers (colored dots at timestamps where events were detected)
    - Overlay: tag badges that appear at relevant timestamps

12. **`src/components/film/ClipTimeline.tsx`** — Scrubber bar with event markers:
    - Horizontal bar representing clip duration
    - Colored markers at event timestamps
    - Hover a marker: tooltip with event type
    - Current playback position indicator

### Upload Page

13. **`src/app/film/upload/page.tsx`** — Upload interface:
    - UploadZone component front and center
    - Form fields: Title, Player (search autocomplete), Game (optional), Tags (multi-select)
    - "Start Analysis" button that triggers the processing pipeline
    - Processing status display: "Uploading... → Analyzing... → Tagging... → Ready"

### Clip Detail Page

14. **`src/app/film/[id]/page.tsx`** — Single clip viewer:
    - Large ClipPlayer at top
    - ClipTimeline below the video
    - Sidebar (desktop) or below (mobile): Analysis results
      - Detected events list
      - Player attributions
      - Tags with confidence scores
      - Linked stats (if aligned to game log)
    - "Related Clips" section at bottom

## ROUND 3: Make Film Room Feel Alive (Even Without Real Clips)

15. **Demo/Sample Data** — Pre-populate film.db with 10-15 fake clip records so the page isn't empty:
    - Use the export.py script to generate sample data
    - Clips like: "LeBron James dunk vs Warriors", "Curry logo three vs Celtics", etc.
    - No actual video files needed — just metadata in the DB
    - Use placeholder thumbnails (dark gradient with play icon overlay)

16. **Pipeline Status Dashboard** — On the film page, show a "System Status" section:
    - Python pipeline: installed/not installed
    - Models: loaded/not loaded
    - Clips in queue: N
    - Last processed: timestamp
    - This data comes from a simple status check in the API

17. **"Coming Soon" Features Section** — Below the main content:
    - "Play-by-Play Alignment" — match clips to official game events
    - "Player Tracking" — detect and follow individual players
    - "Shot Classification" — automatic make/miss detection
    - "Defensive Breakdowns" — analyze defensive schemes
    - Each as a glass card with icon, title, description, "Coming Soon" badge

## ROUND 4: Polish + Quality

18. **All components must follow the design system**:
    - `'use client'` on any component with hooks/state
    - Import from `@/lib/design-tokens` for colors
    - Use GlassCard, not custom div styling
    - Use motionPresets for animations
    - Framer Motion for page transitions
    - clsx for class merging
    - readonly on all interface props
    - No `any` types

19. **Mobile responsive** at 375px:
    - Clip grid: 1 column on mobile, 2 on tablet, 3 on desktop
    - Video player: full width
    - Upload zone: full width, larger touch target

20. **Loading states everywhere**:
    - Film page: skeleton grid of clip cards
    - Clip detail: skeleton video player + sidebar
    - Upload: progress animation

21. **Error states**:
    - Film DB not initialized: show setup instructions
    - Upload failed: clear error message with retry
    - Clip not found: 404 with link back to film library

Run `npm run build` after EVERY major component. Fix errors immediately. You are BEHIND the other instances — the UI is what users see, and right now they see nothing. Prioritize getting the film page rendering with the empty/demo state FIRST, then layer in the upload and detail pages.
