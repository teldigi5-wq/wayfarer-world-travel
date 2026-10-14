/* Optional Wayfarer Earth: source imagery from NASA Blue Marble (2004).
   A geometrically projected, on-demand WebGL globe; no SDK or background loop.
   The authoritative location interface remains the free OpenStreetMap embed. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const root=$('wf-earth'),open=$('wf-earth-open'),close=$('wf-earth-close');
  const stage=$('wf-earth-stage'),canvas=$('wf-earth-canvas');
  const fallback=$('wf-earth-fallback'),status=$('wf-earth-status'),caption=$('wf-earth-caption');
  if(!root||!open||!close||!stage||!canvas||!fallback||!status)return;
  const IMAGE='https://svs.gsfc.nasa.gov/vis/a000000/a002900/a002915/bluemarble-1024.png';
  // Public GitHub-hosted resize of NASA Blue Marble used only when the NASA
  // image endpoint cannot be used as a cross-origin WebGL texture.
  const MIRROR='https://raw.githubusercontent.com/MaxwellLee/physics-lab/main/assets/textures/earth_2048.jpg';
  const DEG=Math.PI/180;
  const valid=(lat,lon)=>typeof lat==='number'&&Number.isFinite(lat)&&Math.abs(lat)<=90&&
    typeof lon==='number'&&Number.isFinite(lon)&&Math.abs(lon)<=180;
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const normLon=x=>((x+180)%360+360)%360-180;
  let lat=35.0116,lon=135.7681,placeName='Kyoto';
  let image=null,gl=null,program=null,texture=null,buffer=null,pending=false,active=false,raf=0,drag=null;
  const vertex='attribute vec2 position;\nvarying vec2 v_uv;\nvoid main(){v_uv=(position+1.0)*0.5;gl_Position=vec4(position,0.0,1.0);}';
  const fragment=[
    'precision highp float;',
    'varying vec2 v_uv;',
    'uniform sampler2D u_map;',
    'uniform vec2 u_center;',
    'const float PI=3.141592653589793;',
    'void main(){',
    '  vec2 p=v_uv*2.0-1.0;',
    '  float radius=dot(p,p);',
    '  if(radius>1.0)discard;',
    '  float front=sqrt(max(0.0,1.0-radius));',
    '  float sl=sin(u_center.x),cl=cos(u_center.x);',
    '  float sp=sin(u_center.y),cp=cos(u_center.y);',
    '  vec3 east=vec3(-sl,cl,0.0);',
    '  vec3 north=vec3(-sp*cl,-sp*sl,cp);',
    '  vec3 face=vec3(cp*cl,cp*sl,sp);',
    '  vec3 earth=normalize(p.x*east+p.y*north+front*face);',
    '  float longitude=atan(earth.y,earth.x);',
    '  float latitude=asin(clamp(earth.z,-1.0,1.0));',
    '  vec2 uv=vec2(fract(0.5+longitude/(2.0*PI)),0.5+latitude/PI);',
    '  vec3 satellite=texture2D(u_map,uv).rgb;',
    '  float diffuse=max(0.0,dot(normalize(vec3(-0.35,0.55,0.77)),vec3(p,front)));',
    '  float brightness=0.34+0.66*diffuse;',
    '  float haze=pow(1.0-front,3.5)*0.18;',
    '  vec3 pixel=satellite*brightness+vec3(0.10,0.36,0.56)*haze;',
    '  gl_FragColor=vec4(pixel,1.0);',
    '}'
  ].join('\n');
  function compile(type,source){
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('Shader unavailable');
    return shader;
  }
  function initialize(textureImage){
    gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,
      powerPreference:'low-power',preserveDrawingBuffer:false});
    if(!gl)throw Error('WebGL unavailable');
    const v=compile(gl.VERTEX_SHADER,vertex),f=compile(gl.FRAGMENT_SHADER,fragment);
    program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Program unavailable');
    gl.deleteShader(v);gl.deleteShader(f);
    buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,textureImage);
    if(gl.getError()!==gl.NO_ERROR)throw Error('Texture unavailable');
    canvas.hidden=false;fallback.hidden=true;
    root.querySelectorAll('[data-earth-direction]').forEach(button=>{button.disabled=false;});
    render();
    status.textContent='NASA photographic Earth centered near '+placeName+
      '. Drag or use arrow keys and direction controls. Not live weather or a booking map.';
  }
  function render(){
    if(!active||!gl||!program||!texture)return;
    const rect=canvas.getBoundingClientRect();
    const dpr=typeof devicePixelRatio==='number'?devicePixelRatio:1;
    const size=Math.max(180,Math.min(560,
      Math.round(Math.min(rect.width||360,rect.height||360)*Math.min(dpr,1.5))));
    if(canvas.width!==size||canvas.height!==size){canvas.width=size;canvas.height=size;}
    gl.viewport(0,0,size,size);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    const location=gl.getAttribLocation(program,'position');
    gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.uniform1i(gl.getUniformLocation(program,'u_map'),0);
    gl.uniform2f(gl.getUniformLocation(program,'u_center'),lon*DEG,lat*DEG);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  function schedule(){
    if(!active||!gl||raf)return;
    raf=requestAnimationFrame(()=>{raf=0;render();});
  }
  function describe(){
    if(caption)caption.textContent=placeName+' · '+Math.abs(lat).toFixed(2)+'°'+
      (lat>=0?' N':' S')+' · '+Math.abs(lon).toFixed(2)+'°'+(lon>=0?' E':' W');
  }
  function centerOn(point){
    if(!valid(point?.latitude,point?.longitude))return false;
    lat=point.latitude;lon=normLon(point.longitude);
    placeName=String(point.name||'Mapped destination').slice(0,110);
    describe();schedule();
    return true;
  }
  function rotate(deltaLat,deltaLon){
    lat=clamp(lat+deltaLat,-85,85);lon=normLon(lon+deltaLon);
    placeName='Earth orientation';describe();schedule();
  }
  function showStatic(message){
    gl=null;program=null;texture=null;
    canvas.hidden=true;fallback.hidden=false;
    root.querySelectorAll('[data-earth-direction]').forEach(button=>{button.disabled=true;});
    fallback.alt='NASA Blue Marble satellite world mosaic in flat equirectangular projection';
    if(!fallback.getAttribute('src'))fallback.src=image?.src===MIRROR?MIRROR:IMAGE;
    status.textContent=message+' Use the interactive OpenStreetMap for mapped destination coordinates.';
  }
  function show(){
    active=true;root.dataset.open='true';stage.hidden=false;open.hidden=true;close.hidden=false;describe();
    if(gl&&program&&texture){canvas.hidden=false;fallback.hidden=true;render();return;}
    if(pending)return;
    // Opening again after an image finished loading while the stage was
    // closed must reinitialize it rather than leave an empty globe.
    if(image&&image.complete&&image.naturalWidth>0){
      try{initialize(image);}catch{showStatic('The projected globe is unavailable; showing the flat NASA mosaic.');}
      return;
    }
    if(image){
      if(image.complete&&image.naturalWidth===0)
        showStatic('The photographic source was unavailable; the world search remains available.');
      return;
    }
    pending=true;
    status.textContent='Loading one public NASA Blue Marble image on request. No map SDK or paid search.';
    image=new Image();image.crossOrigin='anonymous';image.decoding='async';
    image.onload=()=>{
      pending=false;if(!active)return;
      try{initialize(image);}catch{
        showStatic('The projected globe is unavailable here; showing the flat NASA satellite mosaic.');
      }
    };
    image.onerror=()=>{
      if(image.src===IMAGE){
        status.textContent='Primary NASA image access unavailable. Trying a source-attributed Blue Marble mirror.';
        image.src=MIRROR;return;
      }
      pending=false;
      if(active)showStatic('The browser blocked both projected Earth images; attempting a static NASA reference.');
    };
    image.src=IMAGE;
  }
  function dismiss(){
    active=false;stage.hidden=true;root.dataset.open='false';close.hidden=true;open.hidden=false;
    if(raf){cancelAnimationFrame(raf);raf=0;}open.focus();
  }
  fallback.addEventListener('error',()=>{
    fallback.hidden=true;
    status.textContent='NASA and mirror satellite imagery could not be displayed. World Explorer and the source-backed map remain available.';
  });
  open.addEventListener('click',show);close.addEventListener('click',dismiss);
  for(const button of root.querySelectorAll('[data-earth-direction]')){
    button.addEventListener('click',()=>{
      if(!gl)return;
      const d=button.dataset.earthDirection;
      if(d==='west')rotate(0,-15);
      if(d==='east')rotate(0,15);
      if(d==='north')rotate(12,0);
      if(d==='south')rotate(-12,0);
    });
  }
  canvas.addEventListener('pointerdown',e=>{
    if(!active||!gl)return;
    drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!drag||!active||!gl)return;
    const width=Math.max(180,canvas.getBoundingClientRect().width||360);
    rotate((e.clientY-drag.y)*90/width,(drag.x-e.clientX)*180/width);
    drag={x:e.clientX,y:e.clientY};
  });
  canvas.addEventListener('pointerup',()=>{drag=null;});
  canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('keydown',e=>{
    if(!active||!gl)return;
    const keys={ArrowLeft:[0,-10],ArrowRight:[0,10],ArrowUp:[10,0],ArrowDown:[-10,0]};
    if(keys[e.key]){e.preventDefault();rotate(...keys[e.key]);}
  });
  canvas.addEventListener('webglcontextlost',e=>{
    e.preventDefault();gl=null;program=null;texture=null;
    if(active)showStatic('The graphics context was lost. Showing the NASA satellite mosaic.');
  });
  if(typeof ResizeObserver!=='undefined'){
    new ResizeObserver(()=>{if(active)schedule();}).observe(canvas);
  }else window.addEventListener('resize',()=>{if(active)schedule();},{passive:true});
  window.WayfarerGlobe=Object.freeze({centerOn,isOpen:()=>active});
  describe();
})();
