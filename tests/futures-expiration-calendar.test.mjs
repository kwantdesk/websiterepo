import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as calendarHelpers from "../src/lib/optionsExpirationCalendar.ts";
import * as futuresHelpers from "../src/lib/futuresExpirationCalendar.ts";
import { FUTURES_EVENTS, FUTURES_CALENDAR_YEARS, FUTURES_PRODUCTS, futuresCalendarEvents } from "../src/lib/futuresExpirationCalendar.ts";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("published coverage is explicit and event identities/dates are valid",() => {
  assert.deepEqual(FUTURES_CALENDAR_YEARS,[2026,2027,2028]);
  assert.equal(FUTURES_EVENTS.length,48);
  const ids = FUTURES_EVENTS.map(event => `${event.date}:${event.family}:${event.kind}`);
  assert.equal(new Set(ids).size,ids.length);
  for (const event of FUTURES_EVENTS) assert.equal(new Date(`${event.date}T12:00:00Z`).toISOString().slice(0,10),event.date);
  assert.equal(futuresCalendarEvents(2029,"NQ").length,0);
});
test("June 2026 exception and roll are different, without generic Friday generation",() => {
  const nq = futuresCalendarEvents(2026,"NQ");
  assert.ok(nq.some(event => event.date === "2026-06-18" && event.kind === "expiration" && event.contract === "M26"));
  assert.ok(nq.some(event => event.date === "2026-06-15" && event.kind === "roll"));
  assert.ok(!nq.some(event => event.date === "2026-06-19"));
  for (const product of FUTURES_PRODUCTS.slice(1,9)) assert.deepEqual(futuresCalendarEvents(2026,product),nq);
  assert.ok(futuresCalendarEvents(2026,"Nikkei / TOPIX","expiration").some(event => event.date === "2026-06-12"));
  assert.ok(futuresCalendarEvents(2028,"ES","expiration").some(event => event.date === "2028-12-15"));
});
test("News tabs have exact adjacency, preserve account scope and do not force grid panel tabs",() => {
  const news=read("src/components/news/NewsWorkspace.tsx");
  assert.match(news,/id: "developments"[^\n]+\n\s*\{ id: "options-expirations"[^\n]+\n\s*\{ id: "futures-expirations"/);
  assert.match(news,/pathname === "\/news" \? search.get\("view"\) : null/);
  assert.match(news,/window.location.pathname === "\/news"/);
  assert.match(news,/OptionsExpirationCalendar key=\{accountKey\} accountKey=\{accountKey\} active=\{active\}/);
  const shell=read("src/components/KwantifyWorkspace.tsx");
  assert.equal((shell.match(/<NewsWorkspace accountKey=/g) ?? []).length,2);
  assert.doesNotMatch(read("src/components/kwanty/KwantyWorkspace.tsx"),/KWANTY pages|OptionsExpirationCalendar/);
  assert.match(read("src/components/kwanty/KwantyWorkspace.tsx"),/legacyCalendar=pathname==='\/kwanty'&&search.get\('view'\)==='calendar'/);
});
test("futures UI supports month/year/agenda and honest scope without additional backend traffic",() => {
  const ui=read("src/components/news/FuturesExpirationCalendar.tsx");
  for (const token of ['"year"','"month"','"agenda"','data-past={state.past}','aria-current={state.today','KwantSelect','No matching upcoming events','not energy, metals, rates','Customary roll']) {
    assert.ok(ui.includes(token),token);
  }
  assert.match(ui,/clearInterval\(timer\)/);
  assert.doesNotMatch(ui,/fetch\(|EventSource|WebSocket/);
});
test("rendered calendar distinguishes today's expiry from the past roll date",() => {
  const require=createRequire(import.meta.url),select={exports:{},require};
  const transpile=path=>ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(transpile("src/components/ui/KwantSelect.tsx"),select);
  const context={exports:{},require:name=>name.includes("ui/KwantSelect")?select.exports:name.includes("futuresExpirationCalendar")?futuresHelpers:name.includes("optionsExpirationCalendar")?{...calendarHelpers,exchangeDate:()=>"2026-06-18"}:require(name)};
  vm.runInNewContext(transpile("src/components/news/FuturesExpirationCalendar.tsx"),context);
  const html=renderToStaticMarkup(createElement(context.exports.default));
  assert.match(html,/Thursday, June 18, 2026/);
  assert.match(html,/U.S. equity indexes · M26 · Expiration/);
  const current=html.match(/<button[^>]*aria-label="Thursday, June 18, 2026\.[^>]*>/)?.[0];
  assert.ok(current);assert.match(current,/aria-current="date"/);assert.doesNotMatch(current,/opacity-45/);
  const roll=html.match(/<button[^>]*aria-label="Monday, June 15, 2026\.[^>]*>/)?.[0];
  assert.ok(roll);assert.match(roll,/Customary roll/);assert.match(roll,/opacity-45/);assert.doesNotMatch(roll,/disabled/);
  assert.match(html,/not generated or a live exchange feed/);
});
