/* ===================================================================
   THREE.JS 封面：真實照片海報（清晰調色 + 模糊沉浸背景 + 漂浮 3D 骰子）
   三人坐沙發合照存成 cover.jpg；底部原字幕/警語已用裁切去除
   =================================================================== */
const Cover = (() => {
  const canvas = document.getElementById('cover');
  let renderer, scene, camera, fg, bg, dice = [], active = true, raf = null;
  const pointer = { x:0, y:0, tx:0, ty:0 };
  const CROP_MIN = new THREE.Vector2(0.06, 0.24), CROP_MAX = new THREE.Vector2(0.96, 0.985);
  const FG_ASPECT = ((CROP_MAX.x-CROP_MIN.x)*1674) / ((CROP_MAX.y-CROP_MIN.y)*945); // ≈2.1

  const vert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

  const fgFrag = `
    precision highp float;
    uniform sampler2D map; uniform vec2 cropMin, cropMax; uniform float feather;
    varying vec2 vUv;
    void main(){
      vec2 uv = mix(cropMin, cropMax, vUv);
      vec3 c = texture2D(map, uv).rgb;
      float l = dot(c, vec3(0.299,0.587,0.114));
      c = mix(vec3(l), c, 1.30);                 // 飽和
      c = clamp((c-0.5)*1.16+0.5, 0.0, 1.0);     // 對比
      c *= 1.07;                                 // 提亮
      c *= vec3(1.05, 1.0, 0.95);                // 微暖
      float d = distance(vUv, vec2(0.5,0.5));
      c *= clamp(1.10 - 0.42*d, 0.0, 1.0);       // 暈影
      float a = smoothstep(0.0, feather, vUv.y) * smoothstep(0.0, feather, 1.0-vUv.y)
              * smoothstep(0.0, 0.04, vUv.x) * smoothstep(0.0, 0.04, 1.0-vUv.x);
      gl_FragColor = vec4(c, a);
    }`;

  const bgFrag = `
    precision highp float;
    uniform sampler2D map; uniform vec2 texel;
    varying vec2 vUv;
    void main(){
      vec3 c = vec3(0.0);
      for(int i=-2;i<=2;i++) for(int j=-2;j<=2;j++) c += texture2D(map, vUv + vec2(float(i),float(j))*texel*2.5).rgb;
      c /= 25.0;
      float l = dot(c, vec3(0.299,0.587,0.114));
      c = mix(vec3(l), c, 0.55);                 // 去飽和
      c = mix(c, vec3(0.05,0.035,0.06), 0.30);   // 偏暗紫
      c *= 0.42;                                 // 壓暗
      float d = distance(vUv, vec2(0.5,0.5));
      c *= clamp(1.15 - 0.75*d, 0.25, 1.0);      // 暈影
      gl_FragColor = vec4(c, 1.0);
    }`;

  function makeDieTexture(value){
    const s=128, c=document.createElement('canvas'); c.width=c.height=s; const x=c.getContext('2d');
    x.fillStyle='#f7f2e6'; roundRect(x,4,4,s-8,s-8,18); x.fill();
    x.fillStyle = (value===1||value===4) ? '#d8263a' : '#1a1620';
    const r=11, pos={ 1:[[.5,.5]], 2:[[.27,.27],[.73,.73]], 3:[[.27,.27],[.5,.5],[.73,.73]],
      4:[[.27,.27],[.73,.27],[.27,.73],[.73,.73]], 5:[[.27,.27],[.73,.27],[.5,.5],[.27,.73],[.73,.73]],
      6:[[.27,.25],[.27,.5],[.27,.75],[.73,.25],[.73,.5],[.73,.75]] }[value];
    pos.forEach(p=>{ x.beginPath(); x.arc(p[0]*s,p[1]*s,r,0,7); x.fill(); });
    const t=new THREE.CanvasTexture(c); t.anisotropy=4; return t;
  }
  function roundRect(x,a,b,w,h,r){ x.beginPath(); x.moveTo(a+r,b); x.arcTo(a+w,b,a+w,b+h,r); x.arcTo(a+w,b+h,a,b+h,r); x.arcTo(a,b+h,a,b,r); x.arcTo(a,b,a+w,b,r); x.closePath(); }

  function init(){
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
    renderer.setPixelRatio(Math.min(devicePixelRatio||1, 2));
    if(THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x140d16);
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 5);

    bg = new THREE.Mesh(new THREE.PlaneGeometry(1674/945, 1, 1, 1),
      new THREE.ShaderMaterial({ uniforms:{ map:{value:null}, texel:{value:new THREE.Vector2(1/1674,1/945)} }, vertexShader:vert, fragmentShader:bgFrag, depthWrite:false }));
    bg.position.z = -3; bg.visible = false; scene.add(bg);

    fg = new THREE.Mesh(new THREE.PlaneGeometry(FG_ASPECT, 1, 1, 1),
      new THREE.ShaderMaterial({ uniforms:{ map:{value:null}, cropMin:{value:CROP_MIN}, cropMax:{value:CROP_MAX}, feather:{value:0.14} }, vertexShader:vert, fragmentShader:fgFrag, transparent:true, depthWrite:false }));
    fg.position.z = 0; fg.visible = false; scene.add(fg);

    // 漂浮 3D 骰子（遊戲主題）
    for(let i=0;i<5;i++){
      const mats=[2,5,1,6,3,4].map(v=>new THREE.MeshBasicMaterial({ map:makeDieTexture(((v+i)%6)+1) }));
      const d=new THREE.Mesh(new THREE.BoxGeometry(1,1,1), mats);
      d.scale.setScalar(0.26+Math.random()*0.12);
      d.position.set((Math.random()*2-1)*2.2, -1.15 - Math.random()*0.9, 0.8+Math.random()*0.8);
      d.userData={ sx:(Math.random()*2-1)*0.012, sy:(Math.random()*2-1)*0.012, bob:Math.random()*6.28, bs:0.5+Math.random() };
      dice.push(d); scene.add(d);
    }

    new THREE.TextureLoader().load('cover.jpg', (tex) => {
      if(THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
      tex.minFilter = THREE.LinearFilter;
      const iw=tex.image.width||1674, ih=tex.image.height||945;
      bg.material.uniforms.map.value = tex; bg.material.uniforms.texel.value.set(1/iw,1/ih); bg.visible = true;
      fg.material.uniforms.map.value = tex; fg.visible = true;
      resize();
    }, undefined, () => { console.info('找不到 cover.jpg：把三人合照存成同資料夾 cover.jpg。'); });

    addEventListener('pointermove', e=>{ pointer.tx=(e.clientX/innerWidth*2-1); pointer.ty=(e.clientY/innerHeight*2-1); });
    addEventListener('deviceorientation', e=>{ if(e.gamma!=null){ pointer.tx=Math.max(-1,Math.min(1,e.gamma/35)); pointer.ty=Math.max(-1,Math.min(1,(e.beta-45)/35)); } });
    addEventListener('resize', resize); resize();
    loop();
  }

  function resize(){
    const w=innerWidth, h=innerHeight; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix();
    const t = Math.tan(camera.fov*Math.PI/360);
    // 前景照片帶：滿版寬度，置於上中
    const vH = 2*t*camera.position.z, vW = vH*camera.aspect;
    const fgW = vW * 1.0, fgScale = fgW / FG_ASPECT;
    fg.scale.set(fgScale, fgScale, 1);
    fg.position.y = vH * (camera.aspect < 1 ? 0.12 : 0.02);   // 直向稍微上移留標題空間
    // 背景：覆蓋整個畫面
    const vHbg = 2*t*(camera.position.z+3), vWbg = vHbg*camera.aspect;
    bg.scale.setScalar(Math.max(vWbg/(1674/945), vHbg) * 1.04);
  }

  function loop(){
    raf = requestAnimationFrame(loop);
    if(!active) return;
    pointer.x += (pointer.tx-pointer.x)*0.05; pointer.y += (pointer.ty-pointer.y)*0.05;
    camera.position.x = pointer.x*0.35; camera.position.y = -pointer.y*0.22;
    camera.lookAt(0, fg.position.y*0.6, 0);
    const tm = performance.now()/1000;
    dice.forEach(d=>{ d.rotation.x+=d.userData.sx; d.rotation.y+=d.userData.sy; d.position.y += Math.sin(tm*d.userData.bs+d.userData.bob)*0.0016; });
    renderer.render(scene, camera);
  }

  return {
    init(){ try{ init(); }catch(e){ console.warn('Cover init failed', e); } },
    setActive(on){ active = on; canvas.style.opacity = on ? '1' : '0.12'; },
  };
})();
