import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getRouteActor } from "@/lib/serverAuth";
import {
  isZyonMarketRoot,
  ZYON_CHAT_LIMIT,
  ZYON_CHAT_TAG,
  ZYON_CUSTOM_FOLDER_LIMIT,
  ZYON_DEFAULT_CHAT_ID,
  ZYON_FOLDER_TAG,
  zyonChatIdTag,
  zyonDailyRootFolderId,
  zyonFolderIdTag,
  zyonFolderKindTag,
  zyonId,
  zyonParentFolderTag,
  zyonTagValue,
  type ZyonChat,
  type ZyonFolder,
  type ZyonJournalEntry,
} from "@/lib/zyon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type JournalRow = {
  id: string;
  session_date: string;
  root: string;
  title: string;
  summary: string;
  body: string;
  kind: ZyonJournalEntry["kind"];
  tags: string[] | null;
  attachments: ZyonJournalEntry["attachments"] | null;
  created_at: string;
  updated_at: string;
};

function unavailableTable(code?: string) {
  return code === "42P01" || code === "PGRST205";
}

function fromRow(row: JournalRow): ZyonJournalEntry | null {
  if (!isZyonMarketRoot(row.root)) return null;
  return {
    id: row.id,
    sessionDate: row.session_date,
    root: row.root,
    title: row.title,
    summary: row.summary,
    body: row.body,
    kind: row.kind,
    tags: Array.isArray(row.tags) ? row.tags : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    createdAt: row.created_at,
    cloudSaved: true,
  };
}

function folderFromRow(row: JournalRow): ZyonFolder | null {
  const tags = Array.isArray(row.tags) ? row.tags : [];
  if (!tags.includes(ZYON_FOLDER_TAG)) return null;
  const kind = zyonTagValue(tags, "zyon:folder-kind:");
  if (kind !== "system" && kind !== "daily" && kind !== "custom") return null;
  const parent = zyonTagValue(tags, "zyon:parent:");
  return {
    id: row.id,
    chatId: zyonTagValue(tags, "zyon:chat-id:") ?? ZYON_DEFAULT_CHAT_ID,
    name: row.title,
    parentId: !parent || parent === "root" ? null : parent,
    kind,
    sessionDate: kind === "daily" ? row.session_date : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

function chatFromRow(row: JournalRow): ZyonChat | null {
  const tags = Array.isArray(row.tags) ? row.tags : [];
  if (!tags.includes(ZYON_CHAT_TAG)) return null;
  const chatId = zyonTagValue(tags, "zyon:chat-id:");
  if (!chatId) return null;
  return {
    id: chatId,
    name: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

function cleanFolderName(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 60)
    : "";
}

function unavailableResponse() {
  const now = new Date().toISOString();
  return NextResponse.json(
    {
      entries: [],
      folders: [],
      chats: [{
        id: ZYON_DEFAULT_CHAT_ID,
        name: "Primary chat",
        createdAt: now,
        updatedAt: now,
      }],
      cloud: false,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function GET(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return unavailableResponse();
  }
  const loadedRows: JournalRow[] = [];
  for (let offset = 0; offset < 5_000; offset += 1_000) {
    const { data, error } = await supabase
      .from("zyon_journal_entries")
      .select("id,session_date,root,title,summary,body,kind,tags,attachments,created_at,updated_at")
      .eq("user_id", actor.userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + 999);
    if (error) {
      if (unavailableTable(error.code)) return unavailableResponse();
      console.error("ZYON journal load failed", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json({ error: "ZYON journal could not be loaded." }, { status: 502 });
    }
    const page = (data ?? []) as JournalRow[];
    loadedRows.push(...page);
    if (page.length < 1_000) break;
  }

  let rows = loadedRows;
  const storagePaths = [...new Set(rows.flatMap((row) =>
    (Array.isArray(row.attachments) ? row.attachments : [])
      .map((attachment) => attachment.storagePath)
      .filter((path): path is string => Boolean(path))))];
  if (storagePaths.length) {
    const signedByPath = new Map<string, string>();
    for (let index = 0; index < storagePaths.length; index += 100) {
      const { data: signedFiles } = await supabase.storage
        .from("zyon-attachments")
        .createSignedUrls(storagePaths.slice(index, index + 100), 60 * 60);
      (signedFiles ?? [])
        .filter((file) => file.path && file.signedUrl)
        .forEach((file) => signedByPath.set(file.path as string, file.signedUrl as string));
    }
    rows = rows.map((row) => ({
      ...row,
      attachments: (Array.isArray(row.attachments) ? row.attachments : []).map((attachment) => ({
        ...attachment,
        dataUrl: attachment.dataUrl
          ?? (attachment.storagePath ? signedByPath.get(attachment.storagePath) : undefined),
      })),
    }));
  }
  const chats = rows
    .map(chatFromRow)
    .filter((chat): chat is ZyonChat => Boolean(chat));
  if (!chats.some((chat) => chat.id === ZYON_DEFAULT_CHAT_ID)) {
    const oldest = rows.at(-1);
    chats.push({
      id: ZYON_DEFAULT_CHAT_ID,
      name: "Primary chat",
      createdAt: oldest?.created_at ?? new Date().toISOString(),
      updatedAt: rows[0]?.updated_at ?? rows[0]?.created_at ?? new Date().toISOString(),
    });
  }
  const folders = rows
    .map(folderFromRow)
    .filter((folder): folder is ZyonFolder => Boolean(folder));
  const entries = rows
    .filter((row) => !folderFromRow(row) && !chatFromRow(row))
    .map(fromRow)
    .filter((entry): entry is ZyonJournalEntry => Boolean(entry));
  return NextResponse.json(
    {
      entries,
      folders,
      chats: chats.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      cloud: true,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function POST(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  let payload: {
    action?: unknown;
    name?: unknown;
    parentId?: unknown;
    root?: unknown;
    chatId?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Folder details could not be read." }, { status: 400 });
  }
  const action = payload.action === "create-chat" || payload.action === "rename-chat"
    ? payload.action
    : "create-folder";
  const name = cleanFolderName(payload.name);
  const requestedChatId = typeof payload.chatId === "string"
    ? payload.chatId.trim().slice(0, 160)
    : "";
  const chatId = requestedChatId || ZYON_DEFAULT_CHAT_ID;
  const parentId = typeof payload.parentId === "string" && payload.parentId.trim()
    ? payload.parentId.trim().slice(0, 160)
    : null;
  const root = isZyonMarketRoot(payload.root) ? payload.root : "NQ";
  if (!name) {
    return NextResponse.json(
      { error: action === "create-folder" ? "Give the folder a name." : "Give the chat a name." },
      { status: 400 },
    );
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: "Account storage is unavailable." }, { status: 503 });
  }

  if (action === "create-chat") {
    const { data: chatRows, error: chatLoadError } = await supabase
      .from("zyon_journal_entries")
      .select("id")
      .eq("user_id", actor.userId)
      .contains("tags", [ZYON_CHAT_TAG])
      .limit(ZYON_CHAT_LIMIT + 1);
    if (chatLoadError) {
      return NextResponse.json({ error: "Chats could not be loaded." }, { status: 502 });
    }
    const storedChats = chatRows ?? [];
    const effectiveChatCount = storedChats.some((row) => row.id === ZYON_DEFAULT_CHAT_ID)
      ? storedChats.length
      : storedChats.length + 1;
    if (effectiveChatCount >= ZYON_CHAT_LIMIT) {
      return NextResponse.json(
        { error: `Each account can keep up to ${ZYON_CHAT_LIMIT} ZYON chats.` },
        { status: 409 },
      );
    }
    const now = new Date().toISOString();
    const newChat: ZyonChat = {
      id: zyonId("zyon-chat"),
      name,
      createdAt: now,
      updatedAt: now,
    };
    const rootFolder: ZyonFolder = {
      id: zyonDailyRootFolderId(newChat.id),
      chatId: newChat.id,
      name: "Daily conversations",
      parentId: null,
      kind: "system",
      sessionDate: null,
      createdAt: now,
      updatedAt: now,
    };
    const { error } = await supabase.from("zyon_journal_entries").insert([
      {
        user_id: actor.userId,
        id: newChat.id,
        session_date: now.slice(0, 10),
        root,
        title: newChat.name,
        summary: "",
        body: "",
        kind: "NOTE",
        tags: [ZYON_CHAT_TAG, zyonChatIdTag(newChat.id)],
        attachments: [],
        source: "zyon-chat",
        created_at: now,
        updated_at: now,
      },
      {
        user_id: actor.userId,
        id: rootFolder.id,
        session_date: now.slice(0, 10),
        root,
        title: rootFolder.name,
        summary: "",
        body: "",
        kind: "NOTE",
        tags: [
          ZYON_FOLDER_TAG,
          zyonChatIdTag(newChat.id),
          zyonFolderIdTag(rootFolder.id),
          zyonFolderKindTag("system"),
          zyonParentFolderTag(null),
        ],
        attachments: [],
        source: "zyon-folder",
        created_at: now,
        updated_at: now,
      },
    ]);
    if (error) {
      return NextResponse.json({ error: "The chat could not be created." }, { status: 502 });
    }
    return NextResponse.json({ chat: newChat, folder: rootFolder }, { status: 201 });
  }

  if (action === "rename-chat") {
    if (!requestedChatId) {
      return NextResponse.json({ error: "Choose a chat to rename." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { data: existingChatRow, error: existingChatError } = await supabase
      .from("zyon_journal_entries")
      .select("id,tags,created_at")
      .eq("user_id", actor.userId)
      .eq("id", requestedChatId)
      .maybeSingle();
    if (existingChatError) {
      return NextResponse.json({ error: "The chat could not be loaded." }, { status: 502 });
    }
    if (
      existingChatRow
      && (!Array.isArray(existingChatRow.tags) || !existingChatRow.tags.includes(ZYON_CHAT_TAG))
    ) {
      return NextResponse.json({ error: "That chat name cannot be changed." }, { status: 409 });
    }
    if (!existingChatRow && requestedChatId !== ZYON_DEFAULT_CHAT_ID) {
      return NextResponse.json({ error: "That chat no longer exists." }, { status: 404 });
    }
    const chatRow = {
      user_id: actor.userId,
      id: requestedChatId,
      session_date: now.slice(0, 10),
      root,
      title: name,
      summary: "",
      body: "",
      kind: "NOTE",
      tags: [ZYON_CHAT_TAG, zyonChatIdTag(requestedChatId)],
      attachments: [],
      source: "zyon-chat",
      created_at: existingChatRow?.created_at ?? now,
      updated_at: now,
    };
    const { error } = existingChatRow
      ? await supabase
        .from("zyon_journal_entries")
        .update({
          title: name,
          tags: chatRow.tags,
          updated_at: now,
        })
        .eq("user_id", actor.userId)
        .eq("id", requestedChatId)
      : await supabase.from("zyon_journal_entries").insert(chatRow);
    if (error) {
      return NextResponse.json({ error: "The chat could not be renamed." }, { status: 502 });
    }
    const chat: ZyonChat = {
      id: requestedChatId,
      name,
      createdAt: existingChatRow?.created_at ?? now,
      updatedAt: now,
    };
    return NextResponse.json({ chat });
  }

  const { data: folderRows, error: folderLoadError } = await supabase
    .from("zyon_journal_entries")
    .select("id,tags")
    .eq("user_id", actor.userId)
    .contains("tags", [ZYON_FOLDER_TAG])
    .limit(500);
  if (folderLoadError) {
    return NextResponse.json({ error: "Folders could not be loaded." }, { status: 502 });
  }
  const existingFolders = (folderRows ?? []) as Array<{ id: string; tags: string[] | null }>;
  const expectedRootFolderId = zyonDailyRootFolderId(chatId);
  if (
    parentId === expectedRootFolderId
    && !existingFolders.some((row) => row.id === expectedRootFolderId)
  ) {
    const rootCreatedAt = new Date().toISOString();
    const rootTags = [
      ZYON_FOLDER_TAG,
      zyonChatIdTag(chatId),
      zyonFolderIdTag(expectedRootFolderId),
      zyonFolderKindTag("system"),
      zyonParentFolderTag(null),
    ];
    const { error: rootCreateError } = await supabase.from("zyon_journal_entries").insert({
      user_id: actor.userId,
      id: expectedRootFolderId,
      session_date: rootCreatedAt.slice(0, 10),
      root,
      title: "Daily conversations",
      summary: "",
      body: "",
      kind: "NOTE",
      tags: rootTags,
      attachments: [],
      source: "zyon-folder",
      created_at: rootCreatedAt,
      updated_at: rootCreatedAt,
    });
    if (rootCreateError) {
      return NextResponse.json({ error: "The chat archive could not be prepared." }, { status: 502 });
    }
    existingFolders.push({ id: expectedRootFolderId, tags: rootTags });
  }
  const customCount = existingFolders.filter((row) =>
    Array.isArray(row.tags)
    && row.tags.includes(zyonFolderKindTag("custom"))
    && (zyonTagValue(row.tags, "zyon:chat-id:") ?? ZYON_DEFAULT_CHAT_ID) === chatId).length;
  if (customCount >= ZYON_CUSTOM_FOLDER_LIMIT) {
    return NextResponse.json(
      { error: `Each account can keep up to ${ZYON_CUSTOM_FOLDER_LIMIT} custom folders.` },
      { status: 409 },
    );
  }
  if (parentId && !existingFolders.some((row) =>
    row.id === parentId
    && (zyonTagValue(Array.isArray(row.tags) ? row.tags : [], "zyon:chat-id:")
      ?? ZYON_DEFAULT_CHAT_ID) === chatId)) {
    return NextResponse.json({ error: "The parent folder no longer exists." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const folder: ZyonFolder = {
    id: zyonId("zyon-folder"),
    chatId,
    name,
    parentId,
    kind: "custom",
    sessionDate: null,
    createdAt: now,
    updatedAt: now,
  };
  const { error } = await supabase.from("zyon_journal_entries").insert({
    user_id: actor.userId,
    id: folder.id,
    session_date: now.slice(0, 10),
    root,
    title: folder.name,
    summary: "",
    body: "",
    kind: "NOTE",
    tags: [
      ZYON_FOLDER_TAG,
      zyonChatIdTag(chatId),
      zyonFolderIdTag(folder.id),
      zyonFolderKindTag("custom"),
      zyonParentFolderTag(parentId),
    ],
    attachments: [],
    source: "zyon-folder",
    created_at: now,
    updated_at: now,
  });
  if (error) {
    return NextResponse.json({ error: "The folder could not be created." }, { status: 502 });
  }
  return NextResponse.json({ folder }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  let payload: { folderId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Folder details could not be read." }, { status: 400 });
  }
  const folderId = typeof payload.folderId === "string" ? payload.folderId.trim() : "";
  if (!folderId) {
    return NextResponse.json({ error: "Choose a folder to delete." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const rows: Array<{
    id: string;
    tags: string[] | null;
    attachments: ZyonJournalEntry["attachments"] | null;
  }> = [];
  for (let offset = 0; offset < 5_000; offset += 1_000) {
    const { data, error } = await supabase
      .from("zyon_journal_entries")
      .select("id,tags,attachments")
      .eq("user_id", actor.userId)
      .range(offset, offset + 999);
    if (error) {
      return NextResponse.json({ error: "Folders could not be loaded." }, { status: 502 });
    }
    const page = (data ?? []) as typeof rows;
    rows.push(...page);
    if (page.length < 1_000) break;
  }
  const folderRows = rows.filter((row) =>
    Array.isArray(row.tags) && row.tags.includes(ZYON_FOLDER_TAG));
  const target = folderRows.find((row) => row.id === folderId);
  if (!target) {
    return NextResponse.json({ error: "That folder no longer exists." }, { status: 404 });
  }
  if (Array.isArray(target.tags) && target.tags.includes(zyonFolderKindTag("system"))) {
    return NextResponse.json({ error: "The daily conversation archive cannot be deleted." }, { status: 409 });
  }

  const folderIds = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of folderRows) {
      const parent = zyonTagValue(Array.isArray(row.tags) ? row.tags : [], "zyon:parent:");
      if (parent && folderIds.has(parent) && !folderIds.has(row.id)) {
        folderIds.add(row.id);
        changed = true;
      }
    }
  }
  const idsToDelete = rows
    .filter((row) => {
      if (folderIds.has(row.id)) return true;
      const tags = Array.isArray(row.tags) ? row.tags : [];
      const entryFolder = zyonTagValue(tags, "zyon:folder-id:");
      return Boolean(entryFolder && folderIds.has(entryFolder));
    })
    .map((row) => row.id);
  const deletingIds = new Set(idsToDelete);
  const storagePaths = rows
    .filter((row) => deletingIds.has(row.id))
    .flatMap((row) => Array.isArray(row.attachments) ? row.attachments : [])
    .map((attachment) => attachment.storagePath)
    .filter((path): path is string => Boolean(path));
  if (storagePaths.length) {
    for (let index = 0; index < storagePaths.length; index += 100) {
      await supabase.storage.from("zyon-attachments").remove(storagePaths.slice(index, index + 100));
    }
  }
  if (idsToDelete.length) {
    for (let index = 0; index < idsToDelete.length; index += 200) {
      const { error: deleteError } = await supabase
        .from("zyon_journal_entries")
        .delete()
        .eq("user_id", actor.userId)
        .in("id", idsToDelete.slice(index, index + 200));
      if (deleteError) {
        return NextResponse.json({ error: "The folder could not be deleted." }, { status: 502 });
      }
    }
  }
  return NextResponse.json({ deleted: idsToDelete.length, folderIds: [...folderIds] });
}
