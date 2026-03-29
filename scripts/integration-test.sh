#!/bin/bash
# Basketball Intelligence — Integration Test Script
# Run: bash scripts/integration-test.sh
# Cron: runs every 10 min for 1 hour when launched with --cron

cd "$(dirname "$0")/.." || exit 1

LOG_FILE="data/test-results.log"

run_test() {
  local timestamp
  timestamp=$(date "+%Y-%m-%d %H:%M:%S")

  echo "============================================" >> "$LOG_FILE"
  echo "  TEST RUN — $timestamp" >> "$LOG_FILE"
  echo "============================================" >> "$LOG_FILE"

  # Build check
  BUILD=$(npx next build 2>&1 | grep -c "Compiled successfully")
  if [ "$BUILD" -gt 0 ]; then
    echo "BUILD: PASS" >> "$LOG_FILE"
  else
    echo "BUILD: FAIL" >> "$LOG_FILE"
    echo "  TEST ABORTED — build failed" >> "$LOG_FILE"
    return 1
  fi

  # Ensure dev server is running
  if ! curl -s -o /dev/null --max-time 5 "http://localhost:3000/"; then
    npx kill-port 3000 2>/dev/null
    npx next dev -p 3000 > /dev/null 2>&1 &
    sleep 14
  fi

  # ── Page tests (25) ──────────────────────────────────────────────
  PPASS=0; PFAIL=0
  for page in \
    "/" \
    "/explore" \
    "/compare" \
    "/shot-lab" \
    "/play" \
    "/lineup" \
    "/ask" \
    "/matchup" \
    "/film" \
    "/film/upload" \
    "/zones" \
    "/stories" \
    "/player/LeBron%20James" \
    "/player/Stephen%20Curry" \
    "/team/LAL" \
    "/team/GSW" \
    "/zones/LeBron%20James" \
    "/matchup/lebron-james-vs-kevin-durant" \
    "/player/LeBron%20James/timeline" \
    "/player/Kevin%20Durant" \
    "/team/BOS" \
    "/team/MIL" \
    "/zones/Stephen%20Curry" \
    "/player/Kevin%20Durant/timeline" \
    "/matchup/stephen-curry-vs-kevin-durant"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "http://localhost:3000${page}")
    if [ "$code" = "200" ]; then PPASS=$((PPASS+1)); else PFAIL=$((PFAIL+1)); echo "  PAGE FAIL($code) $page" >> "$LOG_FILE"; fi
  done
  echo "PAGES: $PPASS/25 passed" >> "$LOG_FILE"

  # ── API tests (24) ──────────────────────────────────────────────
  APASS=0; AFAIL=0
  for api in \
    "/api/v2/explore" \
    "/api/players/search?q=lebron&limit=3" \
    "/api/v2/players/LeBron%20James" \
    "/api/v2/teams/LAL" \
    "/api/zones/player/LeBron%20James" \
    "/api/timeline/LeBron%20James" \
    "/api/film/clips" \
    "/api/film/clips/1" \
    "/api/v2/compare?p1=LeBron+James&p2=Stephen+Curry" \
    "/api/v2/standings" \
    "/api/v2/teams/GSW" \
    "/api/v2/teams/BOS" \
    "/api/players/search?q=curry&limit=5" \
    "/api/players/search?q=durant&limit=3" \
    "/api/film/clips?q=transition&limit=10" \
    "/api/film/clips?play_type=isolation&limit=5" \
    "/api/film/tags" \
    "/api/film/videos" \
    "/api/film/videos/1" \
    "/api/v2/compare?p1=Kevin+Durant&p2=Giannis+Antetokounmpo" \
    "/api/zones/player/Stephen%20Curry" \
    "/api/timeline/Stephen%20Curry" \
    "/api/v2/players/Stephen%20Curry" \
    "/api/v2/players/Kevin%20Durant"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "http://localhost:3000${api}")
    if [ "$code" = "200" ]; then APASS=$((APASS+1)); else AFAIL=$((AFAIL+1)); echo "  API FAIL($code) $api" >> "$LOG_FILE"; fi
  done
  echo "APIS: $APASS/24 passed" >> "$LOG_FILE"

  # ── Video tests (3) ─────────────────────────────────────────────
  VPASS=0; VFAIL=0
  for f in lakers_vs_warriors_jan_15_2025.mp4 celtics_vs_bucks_dec_28_2024.mp4 demo_game.mp4; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Range: bytes=0-1023" "http://localhost:3000/api/film/video/$f")
    if [ "$code" = "206" ]; then VPASS=$((VPASS+1)); else VFAIL=$((VFAIL+1)); fi
  done
  echo "VIDEOS: $VPASS/3 passed" >> "$LOG_FILE"

  # ── Thumbnail test ──────────────────────────────────────────────
  TCODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://localhost:3000/api/film/thumb/thumb_1_1.jpg")
  echo "THUMBNAILS: $TCODE" >> "$LOG_FILE"

  # ── Response validation tests (3) ───────────────────────────────
  RPASS=0; RFAIL=0

  # Check /api/film/clips returns valid JSON with "total" field
  CLIPS_VALID=$(curl -s --max-time 20 "http://localhost:3000/api/film/clips" 2>/dev/null | node -e "const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{try{const j=JSON.parse(Buffer.concat(c));console.log(j.total!==undefined?'ok':'missing')}catch{console.log('err')}})" 2>/dev/null)
  if [ "$CLIPS_VALID" = "ok" ]; then RPASS=$((RPASS+1)); else RFAIL=$((RFAIL+1)); echo "  VALIDATE FAIL /api/film/clips missing 'total' field" >> "$LOG_FILE"; fi

  # Check /api/v2/explore returns JSON with "topScorers" field
  EXPLORE_VALID=$(curl -s --max-time 20 "http://localhost:3000/api/v2/explore" 2>/dev/null | node -e "const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{try{const j=JSON.parse(Buffer.concat(c));console.log(j.topScorers!==undefined?'ok':'missing')}catch{console.log('err')}})" 2>/dev/null)
  if [ "$EXPLORE_VALID" = "ok" ]; then RPASS=$((RPASS+1)); else RFAIL=$((RFAIL+1)); echo "  VALIDATE FAIL /api/v2/explore missing 'topScorers' field" >> "$LOG_FILE"; fi

  # Check /api/v2/standings returns JSON array
  STANDINGS_VALID=$(curl -s --max-time 20 "http://localhost:3000/api/v2/standings" 2>/dev/null | node -e "const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{try{const j=JSON.parse(Buffer.concat(c));console.log(Array.isArray(j)?'ok':'notarray')}catch{console.log('err')}})" 2>/dev/null)
  if [ "$STANDINGS_VALID" = "ok" ]; then RPASS=$((RPASS+1)); else RFAIL=$((RFAIL+1)); echo "  VALIDATE FAIL /api/v2/standings not a JSON array" >> "$LOG_FILE"; fi

  echo "VALIDATE: $RPASS/3 passed" >> "$LOG_FILE"

  # ── Smart search ────────────────────────────────────────────────
  SCOUNT=$(curl -s "http://localhost:3000/api/film/clips?q=lebron&limit=50" 2>/dev/null | node -e "const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{try{console.log(JSON.parse(Buffer.concat(c)).total||0)}catch{console.log('err')}})" 2>/dev/null)
  echo "SEARCH 'lebron': $SCOUNT results" >> "$LOG_FILE"

  # ── Headshots ───────────────────────────────────────────────────
  HCHECK=$(curl -s "http://localhost:3000/api/v2/explore" 2>/dev/null | node -e "const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{try{const d=JSON.parse(Buffer.concat(c));const s=d.topScorers?.data||[];console.log(s.filter(x=>x.personId).length+'/'+s.length)}catch{console.log('err')}})" 2>/dev/null)
  echo "HEADSHOTS: $HCHECK have personId" >> "$LOG_FILE"

  TOTAL=$((PPASS + APASS + VPASS + RPASS))
  MAX=$((25 + 24 + 3 + 3))
  echo "TOTAL: $TOTAL/$MAX passed" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"

  echo "[$timestamp] $TOTAL/$MAX passed (pages=$PPASS apis=$APASS videos=$VPASS validate=$RPASS)"
}

if [ "$1" = "--cron" ]; then
  echo "Starting 1-hour cron loop (every 10 min, 6 runs)"
  echo "Log: $LOG_FILE"
  for i in $(seq 1 6); do
    run_test
    if [ "$i" -lt 6 ]; then
      echo "  Sleeping 10 min until next run..."
      sleep 600
    fi
  done
  echo "Cron loop complete. Results in $LOG_FILE"
else
  run_test
fi
