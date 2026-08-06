-- Real orderflow archive: the 60s GEX Bot flow poller persists each raw
-- provider frame here, and the terminal serves orderflow history from these
-- rows. Replaces the disabled provider archive (and with it, any reason for
-- simulated history to exist on a trading surface).

create table if not exists public.gexbot_orderflow_frames (
  id bigint generated always as identity primary key,
  ticker text not null,
  session_key text not null,
  frame_timestamp bigint not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (ticker, frame_timestamp)
);

create index if not exists gexbot_orderflow_frames_session_idx
  on public.gexbot_orderflow_frames (ticker, session_key, frame_timestamp);

alter table public.gexbot_orderflow_frames enable row level security;

-- Frames are written and read only by the server (service role) through the
-- terminal API route; browsers never touch this table directly.
revoke all on table public.gexbot_orderflow_frames from anon;
revoke all on table public.gexbot_orderflow_frames from authenticated;
grant all on table public.gexbot_orderflow_frames to service_role;
