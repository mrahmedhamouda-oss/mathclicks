# Turning on the shared online leaderboard

Right now the Mental Math Arena works fully, but each student's top-3 board is
saved **on their own device**. To make the whole class compete on one board you
need a tiny free database. Supabase is the easiest — free forever at this size,
no credit card.

It's about 5 minutes, all clicking. Do it once.

---

## 1. Make the project

1. Go to **https://supabase.com** and click **Start your project**.
2. Sign in (GitHub or email).
3. Click **New project**.
   - **Name:** `mathclicks`
   - **Database password:** click Generate, then **save it somewhere** (you won't
     need it for this, but don't lose it).
   - **Region:** pick the one closest to your students.
4. Click **Create new project** and wait ~2 minutes while it sets up.

## 2. Create the scores table

1. In the left sidebar click **SQL Editor**, then **New query**.
2. Paste this in exactly as-is and click **Run**:

```sql
create table if not exists public.mm_scores (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  week       text not null,
  mode       text not null check (mode in ('sprint', 'survival')),
  initials   text not null check (initials ~ '^[A-Z]{2,3}$'),
  score      int  not null check (score >= 0 and score <= 100000)
);

create index if not exists mm_scores_board_idx
  on public.mm_scores (week, mode, score desc);

alter table public.mm_scores enable row level security;

create policy "read scores"
  on public.mm_scores for select to anon using (true);

create policy "add a score"
  on public.mm_scores for insert to anon with check (true);
```

You should see **Success. No rows returned.** That's correct.

## 3. Copy your two values

1. Sidebar → **Project Settings** → **Data API** (older layout: **API**).
2. Copy the **Project URL** — looks like `https://abcdefghijkl.supabase.co`
3. Copy the **anon** / **public** key — a long string starting `eyJ...`
   (This one is *meant* to be public. It is safe in the website's code.)

## 4. Paste them into the site

Open `js/game-config.js` and edit the three marked lines:

```js
mode: "supabase",
supabaseUrl: "https://abcdefghijkl.supabase.co",
supabaseKey: "eyJhbGciOi...the long key...",
```

Save, reload the site. Done — every student now sees the same board.

---

## Good to know

- **The weekly reset is automatic.** Scores are filed under the week they were
  set (Monday–Sunday), so a new week always starts with an empty board. Nothing
  to clear, and last week's winners still show under "Last week".
- **Old rows just sit there** harmlessly. If you ever want to tidy up, run this
  in the SQL Editor:
  ```sql
  delete from public.mm_scores where created_at < now() - interval '90 days';
  ```
- **To remove a rude or fake entry:** sidebar → **Table Editor** → `mm_scores` →
  click the row → delete.
- **This is a class game, not a bank.** Because the site is static, the key that
  lets students post scores lives in the page, so a determined student who knows
  developer tools could post a made-up score. There's no way around that without
  a real login system. In practice, deleting the odd bogus row from the Table
  Editor is all anyone ever needs.
- **If Supabase is unreachable** (no internet, project paused), the game quietly
  falls back to the on-device board so nobody loses their score, and shows a
  small note.
- Free Supabase projects pause after ~1 week of *zero* activity. Any student
  loading the game counts as activity, so during term it stays awake; if it does
  pause, open the dashboard and click Restore.
