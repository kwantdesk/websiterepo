import { open } from 'node:fs/promises';
import { gunzip, inflateRaw, createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';

const unzip = promisify(inflateRaw), ungzip = promisify(gunzip);
export const EOD_LIMITS = Object.freeze({ zipBytes: 128 * 1024 * 1024, directoryBytes: 4 * 1024 * 1024, entryBytes: 32 * 1024 * 1024, jsonBytes: 32 * 1024 * 1024, entries: 8192, rows: 100000 });
const packages = { classic: ['gex_full','gex_zero','gex_one'], state: ['gex_full','gex_zero','gex_one','delta_zero','delta_one','gamma_zero','gamma_one','vanna_zero','vanna_one','charm_zero','charm_one'], orderflow: ['orderflow'] };
const tickers = new Set('AAPL AMD AMZN APP AVGO BABA BOIL COIN CRWD CRWV DDOG DIA GLD GME GOOG GOOGL HOOD HYG IBIT INTC IONQ IWM META MSFT MSTR MU NFLX NVDA NVO ORCL PL PLTR QQQ RDDT ROKU SHOP SLV SMCI SNDK SNOW SOFI SPCX SPY TLT TQQQ TSLA TSM UBER UNG UNH USO UVXY VALE ZS NDX RUT SPX VIX ES_SPX NQ_NDX'.split(' '));
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
export function eodCrc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function check(condition, code = 'EOD_INVALID_ZIP') { if (!condition) fail(code); }
export function eodEntryName(selection) {
  const { ticker, package: pkg, category, date } = selection || {};
  check(tickers.has(ticker) && Object.hasOwn(packages, pkg) && packages[pkg].includes(category), 'EOD_INVALID_SELECTION');
  const epoch = Date.parse(`${date}T00:00:00Z`);
  check(/^\d{4}-\d{2}-\d{2}$/.test(date || '') && Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 10) === date, 'EOD_INVALID_SELECTION');
  return `${ticker}/${pkg}/${category}/${date}_${ticker}_${pkg}_${category}.json.gz`;
}
async function readAt(file, size, position, fileSize) {
  check(Number.isSafeInteger(size) && size >= 0 && Number.isSafeInteger(position) && position >= 0 && position + size <= fileSize);
  const buffer = Buffer.alloc(size); let offset = 0;
  while (offset < size) { const { bytesRead } = await file.read(buffer, offset, size - offset, position + offset); check(bytesRead > 0); offset += bytesRead; }
  return buffer;
}
function extras(bytes) {
  for (let p = 0; p < bytes.length;) { check(p + 4 <= bytes.length); const id = bytes.readUInt16LE(p), size = bytes.readUInt16LE(p + 2); check(id !== 1, 'EOD_ZIP64_UNSUPPORTED'); p += 4 + size; check(p <= bytes.length); }
}
const nyDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
function sessionDate(epoch) { const parts = Object.fromEntries(nyDate.formatToParts(epoch).map(p => [p.type, p.value])); return `${parts.year}-${parts.month}-${parts.day}`; }

/** Reads only the central directory and exact selected member; never extracts files. */
export async function extractEodSession(path, selection, {onRow} = {}) {
  const wanted = eodEntryName(selection), file = await open(path, 'r');
  try {
    const stat = await file.stat(), size = stat.size;
    check(stat.isFile() && size >= 22 && size <= EOD_LIMITS.zipBytes, 'EOD_ZIP_SIZE_LIMIT');
    const tailSize = Math.min(size, 65557), tail = await readAt(file, tailSize, size - tailSize, size);
    let end = -1;
    for (let p = tail.length - 22; p >= 0; p--) if (tail.readUInt32LE(p) === 0x06054b50 && p + 22 + tail.readUInt16LE(p + 20) === tail.length) { end = p; break; }
    check(end >= 0);
    check(tail.readUInt16LE(end + 4) === 0 && tail.readUInt16LE(end + 6) === 0, 'EOD_MULTIDISK_UNSUPPORTED');
    const count = tail.readUInt16LE(end + 10), dirSize = tail.readUInt32LE(end + 12), dirOffset = tail.readUInt32LE(end + 16);
    check(count !== 0xffff && dirSize !== 0xffffffff && dirOffset !== 0xffffffff, 'EOD_ZIP64_UNSUPPORTED');
    check(count === tail.readUInt16LE(end + 8) && count <= EOD_LIMITS.entries && dirSize <= EOD_LIMITS.directoryBytes && dirOffset + dirSize === size - tailSize + end);
    const directory = await readAt(file, dirSize, dirOffset, size), names = new Set(); let cursor = 0, selected = null;
    for (let index = 0; index < count; index++) {
      check(cursor + 46 <= directory.length && directory.readUInt32LE(cursor) === 0x02014b50);
      const flags = directory.readUInt16LE(cursor + 8), method = directory.readUInt16LE(cursor + 10), crc = directory.readUInt32LE(cursor + 16), compressed = directory.readUInt32LE(cursor + 20), uncompressed = directory.readUInt32LE(cursor + 24);
      const nameSize = directory.readUInt16LE(cursor + 28), extraSize = directory.readUInt16LE(cursor + 30), commentSize = directory.readUInt16LE(cursor + 32), localOffset = directory.readUInt32LE(cursor + 42);
      check(!(flags & ~0x0808), 'EOD_UNSUPPORTED_FLAGS');
      check(method === 0 || method === 8, 'EOD_UNSUPPORTED_COMPRESSION');
      check(directory.readUInt16LE(cursor + 34) === 0, 'EOD_MULTIDISK_UNSUPPORTED');
      check(compressed !== 0xffffffff && uncompressed !== 0xffffffff && localOffset !== 0xffffffff, 'EOD_ZIP64_UNSUPPORTED');
      const next = cursor + 46 + nameSize + extraSize + commentSize; check(next <= directory.length);
      const nameBytes = directory.subarray(cursor + 46, cursor + 46 + nameSize), name = nameBytes.toString('utf8');
      check(nameBytes.equals(Buffer.from(name)) && /^[A-Za-z0-9_./-]+$/.test(name) && !name.startsWith('/') && !name.split('/').some(part => part === '..' || part === '.') && !name.includes('//'), 'EOD_UNSAFE_ENTRY');
      check(!names.has(name), 'EOD_DUPLICATE_ENTRY'); names.add(name);
      extras(directory.subarray(cursor + 46 + nameSize, cursor + 46 + nameSize + extraSize));
      if (name === wanted) { check(compressed <= EOD_LIMITS.entryBytes && uncompressed <= EOD_LIMITS.entryBytes, 'EOD_ENTRY_SIZE_LIMIT'); selected = { flags, method, crc, compressed, uncompressed, nameBytes, localOffset }; }
      cursor = next;
    }
    check(cursor === directory.length); check(selected, 'EOD_SESSION_NOT_FOUND');
    const entry = selected, local = await readAt(file, 30, entry.localOffset, dirOffset);
    check(local.readUInt32LE(0) === 0x04034b50 && local.readUInt16LE(6) === entry.flags && local.readUInt16LE(8) === entry.method);
    const localNameSize = local.readUInt16LE(26), localExtraSize = local.readUInt16LE(28);
    const localMeta = await readAt(file, localNameSize + localExtraSize, entry.localOffset + 30, dirOffset);
    check(localMeta.subarray(0, localNameSize).equals(entry.nameBytes)); extras(localMeta.subarray(localNameSize));
    if (!(entry.flags & 8)) check(local.readUInt32LE(14) === entry.crc && local.readUInt32LE(18) === entry.compressed && local.readUInt32LE(22) === entry.uncompressed);
    const payload = await readAt(file, entry.compressed, entry.localOffset + 30 + localMeta.length, dirOffset);
    let gzipBytes, jsonBytes;
    try { gzipBytes = entry.method === 0 ? payload : await unzip(payload, { maxOutputLength: EOD_LIMITS.entryBytes }); } catch { fail('EOD_INVALID_COMPRESSION'); }
    check(gzipBytes.length === entry.uncompressed && eodCrc32(gzipBytes) === entry.crc, 'EOD_CRC_MISMATCH');
    if(onRow){
      let total=0,count=0,previous=-Infinity;
      for await(const row of decodeEodRows(Readable.from([gzipBytes]).pipe(createGunzip()))){
        const epoch=Number(row.timestamp)*1000;
        check(row.ticker===selection.ticker&&typeof row.timestamp==='number'&&Number.isFinite(epoch)&&sessionDate(epoch)===selection.date&&epoch>=previous,'EOD_INVALID_TIMESTAMP');
        previous=epoch;check(++count<=30000,'EOD_INVALID_ROWS');total+=Buffer.byteLength(JSON.stringify(row));await onRow(row);
      }
      check(count>0,'EOD_INVALID_ROWS');return {rowCount:count,jsonBytes:total,entryName:wanted};
    }
    try { jsonBytes = await ungzip(gzipBytes, { maxOutputLength: EOD_LIMITS.jsonBytes }); } catch { fail('EOD_INVALID_GZIP'); }
    let rows; try { rows = JSON.parse(jsonBytes.toString('utf8')); } catch { fail('EOD_INVALID_JSON'); }
    check(Array.isArray(rows) && rows.length > 0 && rows.length <= EOD_LIMITS.rows, 'EOD_INVALID_ROWS');
    let previous = -Infinity;
    for (const row of rows) {
      check(row && typeof row === 'object' && !Array.isArray(row) && row.ticker === selection.ticker, 'EOD_INVALID_ROW');
      const timestamp = Number(row.timestamp), epoch = timestamp < 1e12 ? timestamp * 1000 : timestamp;
      check(typeof row.timestamp === 'number' && Number.isFinite(epoch) && epoch > 0 && sessionDate(epoch) === selection.date && epoch >= previous, 'EOD_INVALID_TIMESTAMP');
      previous = epoch;
    }
    return { rows, entryName: wanted, jsonBytes: jsonBytes.length, source: 'provider-eod-archive', selection: { ...selection } };
  } finally { await file.close(); }
}

// Streaming top-level JSON array parser. Profile sessions can exceed 150MB;
// only one bounded original row is materialized, with nested arrays/strings intact.
export async function* decodeEodRows(stream){
 let state='start',depth=0,quoted=false,escaped=false,parts=[],rowLength=0,bytes=0,count=0;
 const decoder=new TextDecoder('utf-8',{fatal:true});
 for await(const chunk of stream){
  bytes+=chunk.length;check(bytes<=512*1024*1024,'EOD_JSON_SIZE_LIMIT');
  const text=decoder.decode(chunk,{stream:true});let start=depth>0?0:-1;
  for(let index=0;index<text.length;index++){
   const char=text[index];
   if(state==='done'){check(/\s/.test(char),'EOD_INVALID_JSON');continue;}
   if(state==='start'){if(/\s/.test(char))continue;check(char==='[','EOD_INVALID_JSON');state='value';continue;}
   if(depth===0){
    if(/\s/.test(char))continue;
    if(state==='separator'){if(char===']'){state='done';continue;}check(char===',','EOD_INVALID_JSON');state='required';continue;}
    if(char===']'&&state==='value'){state='done';continue;}
    check(char==='{','EOD_INVALID_JSON');start=index;depth=1;quoted=false;escaped=false;continue;
   }
   if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
   if(char==='"'){quoted=true;continue;}
   if(char==='{'||char==='[')depth++;
   else if(char==='}'||char===']')depth--;
   if(depth===0){parts.push(text.slice(start,index+1));rowLength+=index+1-start;check(rowLength<=512*1024,'EOD_ROW_SIZE_LIMIT');let value;try{value=JSON.parse(parts.join(''));}catch{fail('EOD_INVALID_JSON');}check(value&&typeof value==='object'&&!Array.isArray(value),'EOD_INVALID_ROW');check(++count<=30000,'EOD_INVALID_ROWS');yield value;parts=[];rowLength=0;start=-1;state='separator';}
  }
  if(depth>0&&start>=0){parts.push(text.slice(start));rowLength+=text.length-start;check(rowLength<=512*1024,'EOD_ROW_SIZE_LIMIT');}
 }
 check(!decoder.decode()&&state==='done'&&depth===0,'EOD_INVALID_JSON');
}
