import test from 'node:test';
import assert from 'node:assert/strict';
import {numericControlChoices} from '../public/gex-data-app/numeric-control-options.js';
import {validateAdditionalToolRequest} from '../public/gex-data-app/additional-tool-requests.js';
test('every selectable IV day window meets the actual request policy',()=>{
  for(const id of ['lookback','maturity']){
    const choices=numericControlChoices(id);assert.equal(choices.length,365);assert.equal(new Set(choices.map(([value])=>value)).size,365);
    for(const[value]of choices){const body={filter:{ticker:'QQQ'},lookBackPeriod:365,maturity:30};body[id==='lookback'?'lookBackPeriod':'maturity']=Number(value);assert.doesNotThrow(()=>validateAdditionalToolRequest('iv-rank',body));}
  }
});
test('delta and strike-padding menus use exact bounded numeric increments',()=>{
  for(const id of ['deltaMin','deltaMax']){const choices=numericControlChoices(id);assert.equal(choices.length,101);assert.equal(choices[0][0],'0');assert.equal(choices.at(-1)[0],'1');choices.forEach(([value],i)=>assert.equal(Number(value),i/100));}
  assert.equal(numericControlChoices('strikePadding').length,101);
  assert.equal(numericControlChoices('ticker'),null);
  // Observed contract strikes and the data-sized Top N slider keep their own domains.
  assert.equal(numericControlChoices('strike'),null);assert.equal(numericControlChoices('topLevels'),null);
});
