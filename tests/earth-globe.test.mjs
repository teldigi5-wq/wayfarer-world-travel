import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const script=read('earth-globe.js');
function fixture({webgl=false}={}){
  let frames=0,draws=0;
  const queue=[];
  const images=[];
  class Node{
    constructor(tag='div'){
      this.tagName=tag.toUpperCase();this.children=[];this.listeners={};
      this.dataset={};this.attributes={};this.hidden=false;this.disabled=false;
      this.textContent='';this.src='';this.width=0;this.height=0;
    }
    addEventListener(key,fn){this.listeners[key]=fn;}
    click(){this.listeners.click?.();}
    focus(){this.focused=true;}
    getAttribute(key){return this.attributes[key]||this[key]||null;}
    setAttribute(key,value){this.attributes[key]=value;}
    getBoundingClientRect(){return {width:440,height:440};}
    querySelectorAll(){return [];}
  }
  const ids=Object.fromEntries(['wf-earth','wf-earth-open','wf-earth-close',
    'wf-earth-stage','wf-earth-canvas','wf-earth-fallback','wf-earth-status',
    'wf-earth-caption'].map(id=>[id,new Node(id==='wf-earth-canvas'?'canvas':'div')]));
  const buttons=['east','west','north','south'].map(direction=>{
    const node=new Node('button');node.dataset.earthDirection=direction;return node;
  });
  ids['wf-earth'].querySelectorAll=()=>buttons;
  ids['wf-earth-stage'].hidden=true;ids['wf-earth-close'].hidden=true;
  ids['wf-earth-canvas'].hidden=true;ids['wf-earth-fallback'].hidden=true;
  const gl=new Proxy({
    VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,ARRAY_BUFFER:5,
    STATIC_DRAW:6,TEXTURE_2D:7,UNPACK_FLIP_Y_WEBGL:8,TEXTURE_WRAP_S:9,
    TEXTURE_WRAP_T:10,TEXTURE_MIN_FILTER:11,TEXTURE_MAG_FILTER:12,REPEAT:13,
    CLAMP_TO_EDGE:14,LINEAR:15,RGBA:16,UNSIGNED_BYTE:17,NO_ERROR:0,
    COLOR_BUFFER_BIT:18,FLOAT:19,TEXTURE0:20,TRIANGLE_STRIP:21,
    getShaderParameter(){return true;},
    getProgramParameter(){return true;},
    getError(){return 0;},
    drawArrays(){draws++;}
  },{get(target,key){return key in target?target[key]:()=>({});}});
  ids['wf-earth-canvas'].getContext=()=>webgl?gl:null;
  const context={
    window:{addEventListener(){}},
    document:{getElementById:id=>ids[id]||null},
    Image:class{constructor(){images.push(this);this.complete=false;this.naturalWidth=0;}},
    requestAnimationFrame(fn){frames++;queue.push(fn);return frames;},
    cancelAnimationFrame(){queue.length=0;},
    devicePixelRatio:3,Math,Number,String,
    ResizeObserver:class{observe(){}}
  };
  vm.runInNewContext(script,context,{timeout:1000});
  function load(){
    assert.equal(images.length,1,'Only one satellite image should be requested');
    images[0].complete=true;images[0].naturalWidth=1024;images[0].onload();
  }
  function frame(){
    const work=queue.splice(0);for(const fn of work)fn();
  }
  return {ids,buttons,images,context,globe:context.window.WayfarerGlobe,load,frame,
    get draws(){return draws},get scheduled(){return frames}};
}
test('NASA photograph is strictly opt-in; choosing a destination makes no imagery or map requests',()=>{
  const f=fixture();
  assert.equal(f.images.length,0);
  assert.equal(f.ids['wf-earth-stage'].hidden,true);
  assert.equal(f.globe.isOpen(),false);
  assert.equal(f.globe.centerOn({name:'Sigiriya',latitude:7.957,longitude:80.76}),true);
  assert.match(f.ids['wf-earth-caption'].textContent,/Sigiriya.*7\.96.*80\.76/);
  assert.equal(f.globe.centerOn({name:'Bad map',latitude:91,longitude:80}),false);
  assert.equal(f.images.length,0);
  assert.equal(f.scheduled,0);
});
test('explicit action requests NASA SVS imagery and low-end devices fall back to a labeled flat reference',()=>{
  const f=fixture();
  f.ids['wf-earth-open'].click();
  assert.equal(f.globe.isOpen(),true);
  assert.equal(f.ids['wf-earth-stage'].hidden,false);
  assert.equal(f.images.length,1);
  assert.equal(f.images[0].crossOrigin,'anonymous');
  assert.match(f.images[0].src,/^https:\/\/svs\.gsfc\.nasa\.gov\//);
  f.load();
  assert.equal(f.ids['wf-earth-canvas'].hidden,true);
  assert.equal(f.ids['wf-earth-fallback'].hidden,false);
  assert.match(f.ids['wf-earth-status'].textContent,/flat NASA satellite mosaic/);
  assert.match(f.ids['wf-earth-fallback'].src,/svs\.gsfc\.nasa\.gov/);
  assert.ok(f.buttons.every(b=>b.disabled),'No inactive rotate controls over a flat fallback image');
  assert.equal(f.draws,0);
  f.ids['wf-earth-close'].click();
  assert.equal(f.globe.isOpen(),false);
  assert.equal(f.ids['wf-earth-stage'].hidden,true);
  assert.equal(f.ids['wf-earth-open'].focused,true);
});
test('real WebGL path draws only on activation and interactions with resolution cap',()=>{
  const f=fixture({webgl:true});
  f.ids['wf-earth-open'].click();
  f.load();
  assert.equal(f.ids['wf-earth-canvas'].hidden,false);
  assert.equal(f.ids['wf-earth-fallback'].hidden,true);
  assert.equal(f.draws,1,'Activation renders once, not forever');
  assert.equal(f.ids['wf-earth-canvas'].width,560,'Max canvas size caps mobile GPU load');
  assert.equal(f.ids['wf-earth-canvas'].height,560);
  f.buttons.find(b=>b.dataset.earthDirection==='east').click();
  assert.equal(f.scheduled,1);
  f.frame();assert.equal(f.draws,2);
  f.frame();assert.equal(f.draws,2,'No idle animation/rendering loop');
  f.globe.centerOn({name:'Fiji',latitude:-17.7134,longitude:179.9});
  f.buttons.find(b=>b.dataset.earthDirection==='east').click();
  f.frame();
  assert.match(f.ids['wf-earth-caption'].textContent,/Earth orientation.* W/,
    'Longitude wraps correctly across the Date Line');
  f.ids['wf-earth-canvas'].listeners.keydown({
    key:'ArrowUp',preventDefault(){this.prevented=true;}
  });
  f.frame();assert.ok(f.draws>=4);
  f.ids['wf-earth-close'].click();
  assert.equal(f.globe.isOpen(),false);
});
test('closing during imagery load cannot leave a blank Earth when it is reopened',()=>{
  const f=fixture();
  f.ids['wf-earth-open'].click();
  f.ids['wf-earth-close'].click();
  f.load();
  assert.equal(f.ids['wf-earth-stage'].hidden,true);
  f.ids['wf-earth-open'].click();
  assert.equal(f.ids['wf-earth-stage'].hidden,false);
  assert.equal(f.ids['wf-earth-fallback'].hidden,false);
  assert.equal(f.images.length,1,'Reopen reuses already downloaded NASA imagery');
});
test('CORS/load failures retain the existing World Explorer and do not trigger a paid map SDK',()=>{
  const f=fixture();
  f.ids['wf-earth-open'].click();
  f.images[0].onerror();
  assert.equal(f.ids['wf-earth-fallback'].hidden,false);
  assert.match(f.ids['wf-earth-status'].textContent,/browser blocked projected Earth/);
  assert.equal(f.images.length,1,'Fallback image belongs to the local DOM, not another Image-loader');
  const cfg=JSON.parse(read('vercel.json'));
  const policy=cfg.headers[0].headers.find(x=>x.key==='Content-Security-Policy').value;
  assert.match(policy,/img-src[^;]+https:\/\/svs\.gsfc\.nasa\.gov/);
  assert.doesNotMatch(policy,/connect-src[^;]+svs\.gsfc\.nasa\.gov/);
  assert.doesNotMatch(script,/fetch\(|google\.maps\.Map|mapboxgl|setInterval\(/);
});
test('earth scene is wired into existing worldwide UI without loading imagery automatically',()=>{
  const html=read('index.html'),css=read('premium-refinement.css'),
    map=read('map-studio.js'),pkg=JSON.parse(read('package.json'));
  assert.match(html,/id="wf-earth-open"/);
  assert.match(html,/id="wf-earth-canvas" role="img" tabindex="0"/);
  assert.ok(html.indexOf('src="earth-globe.js"')<html.indexOf('src="map-studio.js"'));
  assert.match(map,/WayfarerGlobe\?\.centerOn\(item\)/);
  assert.match(css,/#studio #wf-earth/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(pkg.scripts.check,/node --check earth-globe\.js/);
});
