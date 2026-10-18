import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planInvaderEnding, invaderEnding, victoryLettering, invaderEndingMarkup } from '../.github/scripts/invader-ending.mjs';
import { contributionInvaders, createSceneConfiguration, layoutCalendar } from '../.github/scripts/invaders.mjs';
import { planHorde } from '../.github/scripts/horde.mjs';
import { planGameplay, gameplayStateAt } from '../.github/scripts/gameplay.mjs';
import { invaderMorphTiming, shiftGameplayTimeline } from '../.github/scripts/invader-timing.mjs';
import { canvas } from '../.github/scripts/motion-geometry.mjs';

test('victory waits for every explosion, including a late impact from an earlier shot; never for zero targets',()=>{
  const timeline={completeAt:12,shots:[{fireAt:1,hitAt:11.62,destroyedAt:12},{fireAt:4,hitAt:5,destroyedAt:5.38}]};
  const ending=planInvaderEnding(timeline);
  assert.equal(ending.message,'GITHUB SAVED!');
  assert.equal(ending.allDestroyedAt,12);
  assert.ok(ending.cleanupAt>12 && ending.appearsAt>ending.cleanupAt);
  assert.ok(ending.appearsAt-12<.2);
  assert.equal(planInvaderEnding({shots:[],completeAt:0}),null);
  assert.equal(planInvaderEnding({moves:[]}),null);
  assert.equal(invaderEndingMarkup(null),'');
});

test('real 39: terminal state is 39 destroyed, zero available/locked/exploding/bullets; stable pixel lettering is centred',async()=>{
  const calendar=JSON.parse(await readFile(new URL('../assets/contributions/calendar.json',import.meta.url)));
  const cells=layoutCalendar(calendar),configuration=createSceneConfiguration(calendar,{seed:'0375e116b1f14dcf318f471fb442383a'});
  const plans=planHorde(cells,false,configuration),timing=invaderMorphTiming(cells,configuration);
  const timeline=shiftGameplayTimeline(planGameplay(plans),timing.timeSaved),ending=planInvaderEnding(timeline);
  const during=gameplayStateAt(timeline,ending.allDestroyedAt-.00001);
  assert.ok(during.exploding.length>0);
  for(const time of [ending.appearsAt,ending.appearsAt+100]){
    const state=gameplayStateAt(timeline,time);
    assert.equal(state.destroyed.length,39);
    for(const kind of ['available','locked','exploding','bullets'])assert.equal(state[kind].length,0);
  }
  const {x,y,width,height}=victoryLettering,shadow=invaderEnding.shadowOffset;
  assert.equal(x+(width+shadow)/2,424);assert.equal(y+(height+shadow)/2,64);
  assert.ok(x>=canvas.left && x+width+shadow<=canvas.right);
  assert.ok(y>=canvas.top && y+height+shadow<=canvas.bottom);
  for(const theme of ['dark','light']){
    const rendered=contributionInvaders(calendar,theme,false,false,configuration);
    assert.equal((rendered.match(/class="invader-victory"/g)||[]).length,1);
    assert.match(rendered,/aria-label="GITHUB SAVED!"/);
    assert.match(rendered,/prefers-reduced-motion:reduce\)\{\.invader-victory\{animation-duration:\.001s;animation-timing-function:steps\(1,end\)/);
    assert.doesNotMatch(invaderEndingMarkup(ending),/<text|font-|<filter|<image|<script/);
    assert.doesNotMatch(contributionInvaders(calendar,theme,false,true),/invader-victory|GITHUB SAVED!/);
  }
});
