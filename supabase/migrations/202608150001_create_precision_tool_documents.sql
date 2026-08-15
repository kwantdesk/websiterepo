create table if not exists public.precision_tool_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id text not null,
  chart_id text not null,
  schema_version integer not null default 1,
  objects jsonb not null default '[]'::jsonb,
  configs jsonb not null default '[]'::jsonb,
  toolbar jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id, chart_id),
  constraint precision_workspace_id_length check (char_length(workspace_id) between 1 and 120),
  constraint precision_chart_id_length check (char_length(chart_id) between 1 and 160),
  constraint precision_objects_array check (jsonb_typeof(objects) = 'array'),
  constraint precision_configs_array check (jsonb_typeof(configs) = 'array'),
  constraint precision_toolbar_object check (jsonb_typeof(toolbar) = 'object')
);

alter table public.precision_tool_documents enable row level security;

drop policy if exists "Users read own precision tool documents" on public.precision_tool_documents;
create policy "Users read own precision tool documents"
on public.precision_tool_documents for select
using (auth.uid() = user_id);

drop policy if exists "Users insert own precision tool documents" on public.precision_tool_documents;
create policy "Users insert own precision tool documents"
on public.precision_tool_documents for insert
with check (auth.uid() = user_id);

drop policy if exists "Users update own precision tool documents" on public.precision_tool_documents;
create policy "Users update own precision tool documents"
on public.precision_tool_documents for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users delete own precision tool documents" on public.precision_tool_documents;
create policy "Users delete own precision tool documents"
on public.precision_tool_documents for delete
using (auth.uid() = user_id);

create index if not exists precision_tool_documents_updated_idx
on public.precision_tool_documents (user_id, updated_at desc);
