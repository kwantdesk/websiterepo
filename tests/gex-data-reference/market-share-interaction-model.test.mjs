import test from 'node:test';
import assert from 'node:assert/strict';
import {marketShareModel,marketShareTableModel,MARKET_SHARE_COLUMNS,EXCHANGE_GROUP_MEMBERS} from '../../public/gex-data-app/options-models.js';
import {marketShareTooltipModel,marketShareTooltipRows,marketShareFormatValue} from '../../public/gex-data-app/market-share-interaction-model.js';
import {formatTableValue} from '../../public/gex-data-app/table-view.js';
import {optionTapeSessionRange} from '../../public/gex-data-app/option-tape-interaction-model.js';

const row=(premium,volume=10,count=1)=>({equityCallPremium:premium,equityPutPremium:0,indexPremium:0,equityCallVolume:volume,equityPutVolume:0,indexVolume:0,equityCallTradeCount:count,equityPutTradeCount:0,indexTradeCount:0});
test('source member tooltip order is declarative, independent of payload insertion; shares use whole market',()=>{
 const data={EDGX:row(40),BOST:row(100),CBOE:row(30),C2:row(20),BATS:row(10)},original=structuredClone(data),model=marketShareModel(data,{mode:'TOTAL_PREMIUM',view:'EXCHANGE_GROUP'}),entry=model.entries.find(row=>row.group==='CBOE');
 assert.equal(entry.value,100);assert.equal(model.total,200);
 assert.deepEqual(marketShareTooltipRows(entry,model),['BZX: $10 (5.00%)','C2: $20 (10.00%)','CBOE: $30 (15.00%)','EDGX: $40 (20.00%)']);assert.deepEqual(data,original);
});
test('all source venue arrays preserved, including nonalphabetical NASDAQ and blank UNKNOWN',()=>{
 assert.deepEqual(EXCHANGE_GROUP_MEMBERS.NASDAQ,['GEMI','ISEX','PHIL','MRCY','NQBX','NQEX']);assert.deepEqual(EXCHANGE_GROUP_MEMBERS.MIAX,['EMLD','MIAX','PERL','SPHR']);assert.deepEqual(EXCHANGE_GROUP_MEMBERS.MEMX,['MEMX','MX2']);
 const model=marketShareModel({GEMI:row(100),UNKNOWN:row(10)},{view:'EXCHANGE_GROUP',mode:'TOTAL_PREMIUM'}),entry=model.entries.find(row=>row.group==='NASDAQ'),rows=marketShareTooltipModel(entry,model);
 assert.deepEqual(rows.map(row=>row.name),['GEMX','ISE','PHLX','MRX','BX','NOM']);assert.equal(rows[1].value,0,'source includes zero for a venue omitted by licensed aggregate response');assert.equal(rows[1].percentageLabel,'0.00%');assert.deepEqual(marketShareTooltipRows(model.entries.find(row=>row.group==='UNKNOWN'),model),[]);
});
test('exchange tooltip is one actual venue row, never group members or invented heading',()=>{
 const model=marketShareModel({BATS:row(1234567)},{mode:'TOTAL_PREMIUM',view:'EXCHANGE'});
 assert.deepEqual(marketShareTooltipRows(model.entries[0],model),['BZX: $1.23 M (100.00%)']);assert.deepEqual(marketShareTooltipRows(null,model),[]);
});
test('source metric format distinguishes premium, trade count and volume without modifying values',()=>{
 assert.equal(marketShareFormatValue(1234567,'TOTAL_PREMIUM'),'$1.23 M');assert.equal(marketShareFormatValue(1234567,'TOTAL_VOLUME'),'1.23 M');assert.equal(marketShareFormatValue(1234567,'TOTAL_TRADE_COUNT'),'1 M');assert.equal(marketShareFormatValue(0,'TOTAL_PREMIUM'),'$0');
});
test('source group order is first-observed with bars reversed, not hardcoded sample order or value rank',()=>{
 const data={NQEX:row(1),AMEX:row(100),CBOE:row(5),MEMX:row(20)},model=marketShareModel(data,{mode:'TOTAL_PREMIUM',view:'EXCHANGE_GROUP'});
 assert.deepEqual(model.entries.map(row=>row.group),['NASDAQ','NYSE','CBOE','MEMX']);assert.deepEqual(model.barRows.map(row=>row.group),['MEMX','CBOE','NYSE','NASDAQ']);assert.equal(model.xMax,150);
 const reordered=marketShareModel({MEMX:data.MEMX,...data},{mode:'TOTAL_PREMIUM',view:'EXCHANGE_GROUP'});assert.equal(reordered.entries[0].group,'MEMX','public/private dictionary order remains a real parity limitation');
});
test('table field formatting stays full raw quantities/currency; source-sized columns lock active sorts',()=>{
 assert.equal(MARKET_SHARE_COLUMNS.length,17);assert.ok(MARKET_SHARE_COLUMNS.every(column=>column.lockWhenSorted));assert.ok(MARKET_SHARE_COLUMNS.every(column=>column.filterable===false));
 const column=key=>MARKET_SHARE_COLUMNS.find(column=>column.key===key);
 assert.equal(column('equityTotalVolume').width,150);assert.equal(column('equityCallTradeCount').width,150);assert.equal(column('equityPutTradeCount').width,140);assert.equal(column('equityCallPremium').width,130);assert.equal(column('totalPremium').width,180);
 assert.equal(formatTableValue(1234567,column('equityCallVolume')),'1,234,567');assert.equal(formatTableValue(1234567,column('equityCallPremium')),'$1,234,567');assert.equal(formatTableValue('UNKNOWN',column('group')),'UNKNOWN');
 const model=marketShareTableModel({BATS:row(1234567)});assert.equal(model.totalRow.totalPremium,1234567);assert.equal(model.rows[0].totalPremiumPercentage,1);
});
test('date-range public mapping uses native session for same day and explicit zoned bounds across DST',()=>{
 assert.deepEqual(optionTapeSessionRange({startDate:'2026-10-16',endDate:'2026-10-16'}),{sessionDate:'2026-10-16'});
 assert.deepEqual(optionTapeSessionRange({startDate:'2026-10-16',endDate:'2026-10-19'}),{timeRange:{startTime:'2026-10-16T04:00:00.000Z',endTime:'2026-10-20T04:00:00.000Z'}});
 assert.deepEqual(optionTapeSessionRange({startDate:'2026-10-30',endDate:'2026-11-02'}),{timeRange:{startTime:'2026-10-30T04:00:00.000Z',endTime:'2026-11-03T05:00:00.000Z'}});
});

test('table unmapped IEX group is blank while chart UNKNOWN grouping and ALL/TOTAL totals remain intact',()=>{
 const data={IEX:row(1234567,120,3),BATS:row(100,30,2),ALL:row(999999999,999999,999999)},before=structuredClone(data),table=marketShareTableModel(data),iex=table.rows.find(item=>item.exchange==='IEX');
 assert.equal(iex.group,'');assert.equal(formatTableValue(iex.group,MARKET_SHARE_COLUMNS[0]),'');assert.equal(iex.totalPremium,1234567);assert.equal(iex.totalVolume,120);assert.equal(iex.totalTradeCount,3);
 assert.equal(table.totalRow.group,'TOTAL');assert.equal(table.totalRow.exchange,'ALL');assert.equal(table.totalRow.totalPremium,1234667);assert.equal(table.totalRow.totalVolume,150);assert.equal(table.totalRow.totalTradeCount,5);assert.equal(table.rows.length,2);
 const chart=marketShareModel({IEX:data.IEX,BATS:data.BATS},{view:'EXCHANGE_GROUP',mode:'TOTAL_PREMIUM'});assert.equal(chart.entries.find(item=>item.group==='UNKNOWN').value,1234567);assert.deepEqual(data,before);
});
