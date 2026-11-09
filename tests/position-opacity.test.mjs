import test from 'node:test';import assert from 'node:assert/strict';import {createDrawing,normalizeDrawings} from '../src/lib/chartDrawTools.ts';
for(const tool of ['longPosition','shortPosition']){
 test(tool+' starts fully opaque',()=>{const drawing=createDrawing(tool,[{time:10,price:100},{time:20,price:90},{time:20,price:120}]);assert.equal(drawing.style.fillOpacity,1);});
 test(tool+' retains opacity including zero through workspace round trips',()=>{for(const opacity of [0,.25,.5,.75,1]){const drawing=createDrawing(tool,[{time:10,price:100},{time:20,price:90},{time:20,price:120}]);drawing.style.fillOpacity=opacity;const restored=normalizeDrawings(JSON.parse(JSON.stringify([drawing])))[0];assert.equal(restored.style.fillOpacity,opacity);}});
 test(tool+' supplies 100% only when an older drawing has no saved opacity',()=>{const drawing=createDrawing(tool,[{time:10,price:100},{time:20,price:90},{time:20,price:120}]);delete drawing.style.fillOpacity;assert.equal(normalizeDrawings([drawing])[0].style.fillOpacity,1);});
}
test('other shape opacity defaults remain unchanged',()=>{assert.equal(createDrawing('rectangle',[{time:10,price:100},{time:20,price:90}]).style.fillOpacity,.12);});
