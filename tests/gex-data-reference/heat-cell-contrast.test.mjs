import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceForeground} from '../../public/gex-data-app/site-theme.js';
test('opaque MVC and heat cells retain readable text on monochrome light/dark themes',()=>{
 assert.equal(surfaceForeground('#FFFFFF','#000000'),'#000000');
 assert.equal(surfaceForeground('#000000','#FFFFFF'),'#FFFFFF');
 assert.equal(surfaceForeground('#FFFFFF33','#000000'),'#FFFFFF');
 assert.equal(surfaceForeground('#00000033','#FFFFFF'),'#000000');
 assert.equal(surfaceForeground('rgba(255,255,255,0.9)','#000000'),'#000000');
});
