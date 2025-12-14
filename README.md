# LGC App v2 - Lazy Gains Club

A fitness tracking app that calculates your LGC Score (strength-to-leanness ratio).

## LGC Score Formula
```
LGC Score = (Squat e1RM + Bench e1RM + Deadlift e1RM) / Waist (inches) × 10
```

## Features
- 📊 Dashboard with LGC Score
- 🏋️ Workout logging (Squat/Bench/Deadlift days)
- 📝 Daily check-ins (weight, waist, sleep)
- 📤 CSV import from Strong app
- 📜 History tracking

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Create a `.env.local` file:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run development server
```bash
npm run dev
```

### 4. Deploy to Vercel
Connect this repo to Vercel and add environment variables in the Vercel dashboard.

## Tech Stack
- Next.js 14
- TypeScript
- Tailwind CSS
- Supabase (Auth + Database)
