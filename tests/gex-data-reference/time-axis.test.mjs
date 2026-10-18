import test from 'node:test';
import assert from 'node:assert/strict';
import {timeDomain,timeX,timeTicks,nearestTimeIndex,timeAtIndex} from '../../public/gex-data-app/time-axis.js';

test('hover selects nearest real timestamp across sparse rows and zoom bounds',()=>{
  const rows=[0,60000,600000,660000];
  assert.equal(nearestTimeIndex(rows,100000),1);
  assert.equal(nearestTimeIndex(rows,500000),2);
  assert.equal(nearestTimeIndex(rows,0,2,3),2);
  assert.equal(nearestTimeIndex([],0),null);
  assert.equal(nearestTimeIndex(rows,999999,999,999),3);
});

test('fractional pan keeps continuous time domain without inventing market prices',()=>{
  assert.equal(timeAtIndex([0,60000,600000],1.5),330000);
  assert.equal(timeDomain([0,60000,600000],.5,1.5).min,30000);
  assert.equal(timeDomain([0,60000,600000],.5,1.5).max,330000);
});

test('time position preserves missing-session gaps instead of equal row spacing',()=>{
  const rows=[{time:0},{time:60000},{time:600000}],domain=timeDomain(rows,0,2);
  assert.equal(domain.min,0);assert.equal(domain.max,600000);
  assert.equal(timeX(rows[1].time,domain,10,110),20);
  assert.equal(timeX(rows[2].time,domain,10,110),110);
});

test('candle/bar domains pad half average time slot; line domains do not pad',()=>{
  const rows=[0,60000,600000];
  assert.equal(timeDomain(rows).padding,0);
  const domain=timeDomain(rows,0,2,{padBars:true});
  assert.equal(domain.padding,150000);assert.equal(domain.min,-150000);assert.equal(domain.max,750000);
  assert.equal(timeDomain([100000]).min,70000);assert.equal(timeDomain([100000]).max,130000);
  assert.equal(timeDomain([]),null);
});

test('time labels snap to source clock multiples rather than fractional row intervals',()=>{
  const start=Date.parse('2026-10-16T13:30:00Z'),end=Date.parse('2026-10-16T20:15:00Z');
  const ticks=timeTicks(start,end,1000,13);
  assert.deepEqual(ticks.map(time=>new Date(time).toISOString().slice(11,16)),['14:00','15:00','16:00','17:00','18:00','19:00','20:00']);
  assert.ok(ticks.every(time=>time%3600000===0));
});

test('nearest-log tick step and visible bounds follow source formulas',()=>{
  const start=Date.parse('2026-10-16T13:31:00Z');
  // Width1300,font13 =>10targetlabels;30minutes/10 =>3minutes desired,
  // nearest-log source step is2minutes (closer than5minutes).
  const ticks=timeTicks(start,start+30*60000,1300,13);
  assert.equal(ticks[0],Date.parse('2026-10-16T13:32:00Z'));assert.equal(ticks[1]-ticks[0],120000);
  assert.ok(ticks.every(time=>time>=start&&time<=start+30*60000));
  assert.deepEqual(timeTicks(start,start,1000),[]);
});
