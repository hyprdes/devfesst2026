import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = id => document.getElementById(id);
const SIZE = 50000; // One world unit is one metre; the world is 50 km across in each direction.
const LIMIT = SIZE / 2 - 2;
const CHUNK = 128;
const ROAD_SPACING = 32;
const ROAD_WIDTH = 9;
const RIVER_MIN = -150, RIVER_MAX = -90;
const SAVE_KEY = 'thanh-pho-xanh-save-v1';
const landmarks = [
  { id:'garden', name:'Vườn hoa ven sông', x:16, z:-80, description:'Một khoảng xanh nhỏ giữa thành phố, nơi chuyến hành trình của bạn bắt đầu.' },
  { id:'bridge', name:'Cầu Nắng Mới', x:128, z:-160, description:'Từ cây cầu này, bạn có thể nhìn dòng nước xanh chảy qua hai bờ thành phố.' },
  { id:'plaza', name:'Quảng trường Gió', x:-96, z:64, description:'Những con đường gặp nhau ở đây, mở ra thêm thật nhiều hướng để đi.' },
];
const travelDestinations = { center:{x:12,z:-72}, north:{x:0,z:-10016}, east:{x:20000,z:0}, west:{x:-20000,z:0} };
const freshState = () => ({ version:1, x:12, z:-72, view:'top', discoveries:[] });
let state=freshState(), playing=false, modal='', previousModal='', toastTimer, elapsedSave=0;
const keys=new Set(), touch=new Set();
function readSave(){
  try { const s=JSON.parse(localStorage.getItem(SAVE_KEY)); if(!s || s.version!==1 || !Number.isFinite(s.x) || !Number.isFinite(s.z) || Math.abs(s.x)>LIMIT || Math.abs(s.z)>LIMIT || !['3d','top'].includes(s.view) || !Array.isArray(s.discoveries)) return null; return { version:1,x:s.x,z:s.z,view:s.view,discoveries:[...new Set(s.discoveries.filter(id=>landmarks.some(l=>l.id===id)))] }; } catch { return null; }
}
function save(){if(!playing)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch{showToast('Không thể lưu tiến trình trên trình duyệt này.');}}
function refreshContinue(){ $('continue').classList.toggle('hidden',!readSave()); }
function showToast(message){$('toast').textContent=message;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),3000);}
function showModal(id){keys.clear();touch.clear();modal=id;document.querySelectorAll('.overlay').forEach(el=>el.classList.add('hidden'));if(id){$(id).classList.remove('hidden');const focus=$(id).querySelector('button');if(focus)focus.focus();}}
function start(saved){state=saved||freshState();playing=true;$('welcome').classList.add('hidden');$('hud').classList.remove('hidden');syncWorld();save();showModal(saved?'':'intro');}
function home(){save();playing=false;showModal('');$('hud').classList.add('hidden');$('welcome').classList.remove('hidden');refreshContinue();}
function setTravel(from){previousModal=from;showModal('travel');}
function goTravel(key){const destination=travelDestinations[key];if(!destination)return;state.x=destination.x;state.z=destination.z;syncWorld();save();showModal('');showToast(`✦ Đã đến ${districtName()}`);}
function districtName(){if(state.z < -5000)return 'Phố phương Bắc';if(state.x > 5000)return 'Phố bình minh';if(state.x < -5000)return 'Phố hoàng hôn';if(state.z < RIVER_MIN)return 'Bờ bắc sông xanh';return 'Khu vườn ven sông';}
function toggleView(){if(!playing||modal)return;state.view=state.view==='3d'?'top':'3d';updateView();moveCamera(true);save();showToast(state.view==='3d'?'Góc nhìn 3D':'Góc nhìn từ trên xuống');}
function formatDistance(d){return d>=1000?`${(d/1000).toFixed(1)} km`:`${Math.round(d)} m`;}
function updateUI(){ $('discoveryCount').textContent=`${state.discoveries.length} / 3 địa điểm đã khám phá`; $('targetProgress').style.width=`${state.discoveries.length / 3 * 100}%`; $('districtName').textContent=districtName(); const next=nearestLandmark(); $('nextLandmark').textContent=next ? `${next.name} · ${formatDistance(next.d)}` : '✦ Đã khám phá tất cả địa điểm'; $('coordinates').textContent=`${formatDistance(Math.abs(state.x))} ${state.x<0?'T':'Đ'} · ${formatDistance(Math.abs(state.z))} ${state.z<0?'B':'N'}`; }
function nearestLandmark(){return landmarks.filter(l=>!state.discoveries.includes(l.id)).map(l=>({...l,d:Math.hypot(l.x-state.x,l.z-state.z)})).sort((a,b)=>a.d-b.d)[0];}
function interact(){if(!playing||modal)return;const l=nearestLandmark();if(!l||l.d>7){showToast(l?'Hãy đến gần địa điểm để khám phá.':'Bạn đã khám phá tất cả địa điểm!');return;}state.discoveries.push(l.id);updateUI();updateLandmarkMarkers();save();$('discoveredTitle').textContent=l.name;$('discoveredText').textContent=l.description;showModal('discovered');}

const scene=new THREE.Scene();
const skyCanvas=document.createElement('canvas');skyCanvas.width=2;skyCanvas.height=256;
const skyCtx=skyCanvas.getContext('2d'),skyGradient=skyCtx.createLinearGradient(0,0,0,256);
skyGradient.addColorStop(0,'#75bfe2');skyGradient.addColorStop(.55,'#a4dce6');skyGradient.addColorStop(1,'#e2f3d9');skyCtx.fillStyle=skyGradient;skyCtx.fillRect(0,0,2,256);
const skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.colorSpace=THREE.SRGBColorSpace;scene.background=skyTexture;scene.fog=new THREE.Fog(0xc2e4dd,145,430);
const renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(.5);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
scene.add(new THREE.HemisphereLight(0xe9ffff,0x7eaa67,2.15));
const sun=new THREE.DirectionalLight(0xfff4d3,2.2);sun.position.set(-40,75,35);scene.add(sun);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:180});sun.shadow.bias=-.0004;scene.add(sun.target);
const camera3d=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,700);
const cameraTop=new THREE.OrthographicCamera(-30,30,30,-30,.1,700);let activeCamera=camera3d;
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.9,...extra});
const mats={grass:mat(0x8bcf5d),road:mat(0x535b7a),roadEdge:mat(0xf1c968),roadLine:mat(0xfff6d8),river:mat(0x35bfcf,{roughness:.45,metalness:.04}),sand:mat(0xf4e8bd),roof:mat(0xd98769),trunk:mat(0x866648),leaf:mat(0x3eaa4f),leafLight:mat(0x82cf5d),leafDark:mat(0x318b51),white:mat(0xfff8e5),blue:mat(0x80c8d2),gold:mat(0xf7d06d),dark:mat(0x35565a),flower:mat(0xf9f7d7),flowerBlue:mat(0x74a9ef),glass:mat(0x78c5d3),wood:mat(0xa87d58)};
// Lightweight painted textures and instanced grass make the ground and water feel alive.
function paintedTexture(kind){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
  ctx.fillStyle=kind==='grass'?'#a0d967':'#47cbd4';ctx.fillRect(0,0,256,256);
  let seed=kind==='grass'?771:271;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  if(kind==='grass'){
    for(let i=0;i<4500;i++){ctx.fillStyle=i%3===0?'rgba(245,247,157,.18)':'rgba(47,139,64,.13)';const x=random()*256,y=random()*256;ctx.fillRect(x,y,1+random()*2,2+random()*4);}
  }else{
    for(let i=0;i<550;i++){const x=random()*256,y=random()*256;ctx.strokeStyle=i%3===0?'rgba(233,255,245,.42)':'rgba(18,152,185,.16)';ctx.lineWidth=.5+random()*1.3;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+3,y-1,x+7+random()*11,y);ctx.stroke();}
  }
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(kind==='grass'?8:5,kind==='grass'?8:2);return texture;
}
const grassTexture=paintedTexture('grass'),waterTexture=paintedTexture('water');
mats.grass.map=grassTexture;mats.grass.color.set(0xffffff);mats.grass.needsUpdate=true;
mats.river.map=waterTexture;mats.river.color.set(0xffffff);mats.river.needsUpdate=true;
const grassGeo=new THREE.BufferGeometry();
grassGeo.setAttribute('position',new THREE.Float32BufferAttribute([
 -.12,0,0, -.07,0,0, -.16,.40,0,
 -.025,0,0, .025,0,0, .015,.52,0,
 .07,0,0, .12,0,0, .16,.36,0,
 0,0,-.10, 0,0,-.05, .01,.37,-.16,
 0,0,.05, 0,0,.10, -.01,.44,.15
],3));grassGeo.computeVertexNormals();
const grassMat=mat(0x69b945,{side:THREE.DoubleSide});
const geo={box:new THREE.BoxGeometry(1,1,1),tree:new THREE.IcosahedronGeometry(1,1),trunk:new THREE.CylinderGeometry(.15,.23,1,7),cone:new THREE.ConeGeometry(1,1,7),flower:new THREE.IcosahedronGeometry(1,0)};
function addMesh(geom,material,x,y,z,parent=scene){const m=new THREE.Mesh(geom,material);m.position.set(x,y,z);parent.add(m);return m;}
function box(parent,material,x,y,z,w,h,d,shadow=false){const m=addMesh(geo.box,material,x,y,z,parent);m.scale.set(w,h,d);m.castShadow=shadow;m.receiveShadow=true;return m;}
function hash(a,b,c=0){let n=Math.imul(a,374761393)+Math.imul(b,668265263)+Math.imul(c,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
function instances(group,geometry,material,list,cast=false){if(!list.length)return;const obj=new THREE.InstancedMesh(geometry,material,list.length);const dummy=new THREE.Object3D();list.forEach((v,i)=>{dummy.position.set(v.x,v.y,v.z);dummy.scale.set(v.sx,v.sy,v.sz);dummy.rotation.set(v.rx||0,v.ry||0,v.rz||0);dummy.updateMatrix();obj.setMatrixAt(i,dummy.matrix);});obj.instanceMatrix.needsUpdate=true;obj.castShadow=cast;obj.receiveShadow=true;group.add(obj);}
function inRiver(z){return z>RIVER_MIN&&z<RIVER_MAX;}
function nearLandmark(x,z){return landmarks.some(l=>Math.hypot(l.x-x,l.z-z)<16);}
// Each lot has deterministic contents so unloaded areas reconstruct identically.
function lot(gx,gz){const x=gx*ROAD_SPACING+16,z=gz*ROAD_SPACING+16;const park=hash(gx,gz,1)<.34||inRiver(z)||nearLandmark(x,z);const width=11+hash(gx,gz,2)*5,depth=11+hash(gx,gz,3)*5,height=6+hash(gx,gz,4)*14;return{x,z,park,width,depth,height,color:Math.floor(hash(gx,gz,5)*4)};}
// An instanced meadow around the player gives foreground depth without
// filling the entire 50 km world with geometry. It is rebuilt per 16 m cell.
const meadow=new THREE.InstancedMesh(grassGeo,mat(0x80c749,{side:THREE.DoubleSide}),8000);
meadow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);meadow.frustumCulled=false;scene.add(meadow);
const meadowDummy=new THREE.Object3D(),meadowColor=new THREE.Color();let meadowCell='';
function updateMeadow(force=false){
  const cellX=Math.floor(state.x/16),cellZ=Math.floor(state.z/16),cell=`${cellX},${cellZ}`;if(!force&&cell===meadowCell)return;meadowCell=cell;
  let n=0;const x0=cellX*16-24,z0=cellZ*16-24;
  for(let ix=0;ix<72;ix++)for(let iz=0;iz<72;iz++){
    const wx=x0+ix*.95+hash(ix+cellX*71,iz+cellZ*71,91)*.7,wz=z0+iz*.95+hash(ix+cellX*71,iz+cellZ*71,92)*.7;
    if(inRiver(wz)||Math.abs(wz-RIVER_MIN)<5||Math.abs(wz-RIVER_MAX)<5||Math.abs(wx-Math.round(wx/ROAD_SPACING)*ROAD_SPACING)<6||Math.abs(wz-Math.round(wz/ROAD_SPACING)*ROAD_SPACING)<6)continue;
    if(landmarks.some(l=>Math.hypot(wx-l.x,wz-l.z)<3))continue;
    const l=lot(Math.floor(wx/ROAD_SPACING),Math.floor(wz/ROAD_SPACING));if(!l.park&&Math.abs(wx-l.x)<l.width/2+1&&Math.abs(wz-l.z)<l.depth/2+1)continue;
    const r=hash(ix+cellX*71,iz+cellZ*71,93),scale=.42+r*.48;
    meadowDummy.position.set(wx,.025,wz);meadowDummy.rotation.set(0,r*Math.PI*2,0);meadowDummy.scale.set(scale,scale,scale);meadowDummy.updateMatrix();meadow.setMatrixAt(n,meadowDummy.matrix);
    meadowColor.setHSL(.25+r*.035,.51,.35+r*.14);meadow.setColorAt(n,meadowColor);n++;
  }
  meadow.count=n;meadow.instanceMatrix.needsUpdate=true;if(meadow.instanceColor)meadow.instanceColor.needsUpdate=true;
}
const rockMat=mat(0xb7c4b0),matCar=mat(0xe83f50),matCarWindow=mat(0x26344f);
const chunkGroups=new Map();
const cityModels = [];
const natureModels = [];
let explorerMixer = null, explorerActions = {}, explorerAction = '', isWalking = false, isRunning = false;
const buildingMats=[mat(0xffe9be),mat(0xf2c8a9),mat(0xc5e5d8),mat(0xe4dcbf)];
function createChunk(cx,cz){
  const group=new THREE.Group();const x0=cx*CHUNK,z0=cz*CHUNK;const cx0=x0+CHUNK/2,cz0=z0+CHUNK/2;
  box(group,mats.grass,cx0,-.35,cz0,CHUNK,.7,CHUNK);
  // Continuous streets with pale sidewalks and broken white center lines.
  const roadEdges=[], roads=[], lines=[], crossings=[], cars=[], carWindows=[];
  for(let i=0;i<4;i++){const x=x0+i*ROAD_SPACING,z=z0+i*ROAD_SPACING;
    roadEdges.push({x,y:.015,z:cz0,sx:ROAD_WIDTH+2,sy:.04,sz:CHUNK},{x:cx0,y:.015,z,sx:CHUNK,sy:.04,sz:ROAD_WIDTH+2});
    roads.push({x,y:.04,z:cz0,sx:ROAD_WIDTH,sy:.04,sz:CHUNK},{x:cx0,y:.045,z,sx:CHUNK,sy:.04,sz:ROAD_WIDTH});
    for(let k=0;k<8;k++)lines.push({x,y:.07,z:z0+k*16+8,sx:.15,sy:.012,sz:3},{x:x0+k*16+8,y:.073,z,sx:3,sy:.012,sz:.15});
    for(let j=0;j<4;j++){const ix=x0+j*ROAD_SPACING,iz=z0+i*ROAD_SPACING;for(let stripe=-3;stripe<=3;stripe++)crossings.push({x:ix+stripe*.85,y:.085,z:iz+6.5,sx:.52,sy:.015,sz:2.4});}
    if(!inRiver(z+2)&&hash(cx,cz,i+91)>.5){cars.push({x:x0+12,y:.55,z:z+2,sx:3.8,sy:1.05,sz:1.7});carWindows.push({x:x0+12,y:1.1,z:z+2,sx:1.8,sy:.1,sz:1.5});}
  }
  instances(group,geo.box,mats.roadEdge,roadEdges);instances(group,geo.box,mats.road,roads);instances(group,geo.box,mats.roadLine,lines);instances(group,geo.box,mats.roadLine,crossings);instances(group,geo.box,matCar,cars,true);instances(group,geo.box,matCarWindow,carWindows);
  const byColor=[[],[],[],[]],roofs=[],windows=[],trunks=[],leaves=[],lightLeaves=[],bushes=[],flowers=[],blueFlowers=[],conifers=[],grassTufts=[],modelLots=[[],[],[]],lampPosts=[],lampHeads=[],benchSeats=[],benchBacks=[],naturalTrees=[[],[],[]];
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
    const gx=cx*4+i,gz=cz*4+j,l=lot(gx,gz);
    const lampX=gx*ROAD_SPACING+6,lampZ=gz*ROAD_SPACING+6;if(!inRiver(lampZ)){lampPosts.push({x:lampX,y:2.2,z:lampZ,sx:.12,sy:4.4,sz:.12});lampHeads.push({x:lampX,y:4.45,z:lampZ,sx:.36,sy:.35,sz:.36});}
    if(l.park){
      if(!inRiver(l.z)&&!nearLandmark(l.x,l.z)){benchSeats.push({x:l.x-9,y:.55,z:l.z+8,sx:2.2,sy:.15,sz:.65});benchBacks.push({x:l.x-9,y:.95,z:l.z+8.3,sx:2.2,sy:.75,sz:.13});}
      if(!inRiver(l.z))for(let k=0;k<8;k++){const x=l.x+(hash(gx,gz,10+k)-.5)*20,z=l.z+(hash(gx,gz,30+k)-.5)*20;if(nearLandmark(x,z))continue;const scale=1+hash(gx,gz,50+k)*1.1;naturalTrees[Math.floor(hash(gx,gz,k+715)*3)].push({x,y:0,z,sx:scale*3.6,sy:scale*5.6,sz:scale*3.6,ry:hash(gx,gz,k+716)*Math.PI*2});trunks.push({x,y:scale*1.4,z,sx:scale,sy:scale*2.8,sz:scale});if(k%3===0){conifers.push({x,y:scale*3.6,z,sx:scale*1.6,sy:scale*4.8,sz:scale*1.6},{x,y:scale*5,z,sx:scale*1.25,sy:scale*3.3,sz:scale*1.25});}else{leaves.push({x,y:scale*3.3,z,sx:scale*2.4,sy:scale*2.1,sz:scale*2.4});lightLeaves.push({x:x+.8*scale,y:scale*4.2,z,sx:scale*1.6,sy:scale*1.4,sz:scale*1.6});lightLeaves.push({x:x-.9*scale,y:scale*3.7,z:z+.4*scale,sx:scale*1.5,sy:scale*1.3,sz:scale*1.5});}}
    }else{
      byColor[l.color].push({x:l.x,y:l.height/2,z:l.z,sx:l.width,sy:l.height,sz:l.depth});
      modelLots[l.color % 3].push({x:l.x,y:0,z:l.z,sx:l.width,sy:l.height,sz:l.depth});
      roofs.push({x:l.x,y:l.height+.2,z:l.z,sx:l.width+1,sy:.6,sz:l.depth+1});
      for(let floor=2;floor<l.height-1;floor+=3.2)for(let side=-1;side<=1;side+=2){windows.push({x:l.x+side*l.width*.25,y:floor,z:l.z+l.depth/2+.03,sx:1.3,sy:1.4,sz:.09});windows.push({x:l.x+l.width/2+.03,y:floor,z:l.z+side*l.depth*.25,sx:.09,sy:1.4,sz:1.3});}
      for(let k=0;k<4;k++){const angle=k*Math.PI/2;const x=l.x+Math.cos(angle)*11.5,z=l.z+Math.sin(angle)*11.5;if(inRiver(z))continue;naturalTrees[Math.floor(hash(gx,gz,k+775)*3)].push({x,y:0,z,sx:3.6,sy:5.4,sz:3.6,ry:hash(gx,gz,k+777)*Math.PI*2});trunks.push({x,y:1,z,sx:.65,sy:2,sz:.65});leaves.push({x,y:3,z,sx:1.8,sy:1.8,sz:1.8});}
    }
    if(!inRiver(l.z))for(let k=0;k<140;k++){const x=l.x+(hash(gx,gz,180+k)-.5)*24,z=l.z+(hash(gx,gz,310+k)-.5)*24;if(inRiver(z)||Math.abs(z-RIVER_MIN)<5||Math.abs(z-RIVER_MAX)<5||(!l.park&&Math.abs(x-l.x)<l.width/2+1&&Math.abs(z-l.z)<l.depth/2+1))continue;const scale=.35+hash(gx,gz,k+510)*.5;grassTufts.push({x,y:.02,z,sx:scale,sy:scale,sz:scale,ry:hash(gx,gz,k+610)*Math.PI});if(k%5===0){const f={x,y:.18,z,sx:.18,sy:.12,sz:.18};(k%3?flowers:blueFlowers).push(f);}if(k%23===0&&!nearLandmark(x,z)&&Math.hypot(x-12,z+72)>5)bushes.push({x,y:.35,z,sx:.8,sy:.5,sz:.8});}
  }
  if(cityModels.length === 3){cityModels.forEach((model,i)=>instances(group,model.geometry,model.material,modelLots[i],true));}else{byColor.forEach((list,i)=>instances(group,geo.box,buildingMats[i],list,true));instances(group,geo.box,mats.roof,roofs,true);instances(group,geo.box,mats.glass,windows);}
  instances(group,geo.box,mats.dark,lampPosts);instances(group,geo.tree,mats.gold,lampHeads);instances(group,geo.box,mats.wood,benchSeats);instances(group,geo.box,mats.wood,benchBacks);if(natureModels.length===4){for(let i=0;i<3;i++)natureModels[i].forEach(part=>instances(group,part.geometry,part.material,naturalTrees[i],true));}else{instances(group,geo.trunk,mats.trunk,trunks,true);instances(group,geo.cone,mats.leaf,conifers,true);instances(group,geo.tree,mats.leaf,leaves,true);instances(group,geo.tree,mats.leafLight,lightLeaves);} instances(group,geo.tree,mats.leafDark,bushes);instances(group,geo.flower,mats.flower,flowers);instances(group,geo.flower,mats.flowerBlue,blueFlowers);instances(group,grassGeo,grassMat,grassTufts);
  const start=Math.max(z0,RIVER_MIN),end=Math.min(z0+CHUNK,RIVER_MAX);
  if(end>start){box(group,mats.sand,cx0,.10,(start+end)/2,CHUNK,.04,end-start);if(z0<=RIVER_MIN&&z0+CHUNK>RIVER_MIN)box(group,mats.sand,cx0,.08,RIVER_MIN-2.5,CHUNK,.06,5);if(z0<=RIVER_MAX&&z0+CHUNK>RIVER_MAX)box(group,mats.sand,cx0,.08,RIVER_MAX+2.5,CHUNK,.06,5);box(group,mats.river,cx0,.15,(start+end)/2,CHUNK,.05,end-start-2);
    // Bridges at 128 m intervals cross the river; other road crossings end at the bank.
    const bridgeX=x0;box(group,mats.roadEdge,bridgeX,.27,(start+end)/2,14,.22,end-start);box(group,mats.road,bridgeX,.4,(start+end)/2,10,.08,end-start);for(const side of [-1,1])box(group,mats.white,bridgeX+side*6.2,.8,(start+end)/2,.35,.9,end-start);
    const shoreRocks=[];for(let i=0;i<18;i++){const x=x0+i*7+3;if(Math.abs(x-Math.round(x/ROAD_SPACING)*ROAD_SPACING)<6)continue;for(const bank of [RIVER_MIN-2,RIVER_MAX+2])if(bank>=z0&&bank<z0+CHUNK){const r=.3+hash(cx,cz,600+i)*.75;shoreRocks.push({x,y:r*.35,z:bank+(hash(cx,cz,700+i)-.5)*2,sx:r,sy:r*.65,sz:r});}}if(natureModels.length===4){const rocks=shoreRocks.map(r=>({...r,y:.11,sy:r.sy*1.8}));natureModels[3].forEach(part=>instances(group,part.geometry,part.material,rocks,true));}else instances(group,geo.tree,rockMat,shoreRocks);
    for(let i=0;i<14;i++){const wx=x0+hash(cx,cz,200+i)*CHUNK,wz=start+hash(cx,cz,220+i)*(end-start);box(group,mats.white,wx,.19,wz,1.5+hash(cx,cz,240+i)*3,.01,.08);}
  }
  scene.add(group);return group;
}
function updateChunks(){const cx=Math.floor(state.x/CHUNK),cz=Math.floor(state.z/CHUNK),needed=new Set();for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++){const key=`${x},${z}`;needed.add(key);if(!chunkGroups.has(key))chunkGroups.set(key,createChunk(x,z));}for(const [key,g] of chunkGroups)if(!needed.has(key)){scene.remove(g);g.traverse(o=>{if(o.isInstancedMesh)o.dispose();});chunkGroups.delete(key);}}
// A soft distant skyline keeps the bright, open-world adventure composition.
const scenery=new THREE.Group();scene.add(scenery);
const hillMats=[mat(0x80ad9c),mat(0x76a9aa),mat(0xa6c9b4)];
for(let i=0;i<9;i++){
  const hill=addMesh(new THREE.IcosahedronGeometry(1,1),hillMats[i%3],(i-4)*85,4+(i%3)*3,-315-(i%2)*50,scenery);
  hill.scale.set(80,28+(i%3)*8,55);
}
const cloudMat=mat(0xfffef1);
for(let i=0;i<9;i++){
  const cloud=new THREE.Group();cloud.position.set((i-4)*65,72+(i%3)*10,-225-(i%2)*55);scenery.add(cloud);
  for(let j=0;j<4;j++){const puff=addMesh(new THREE.SphereGeometry(1,8,6),cloudMat,j*5,Math.sin(j)*1.5,0,cloud);puff.scale.set(6,2.5+(j%2),3);}
}
// A little sailboat adds a focal point on the river without blocking navigation.
const boat=new THREE.Group();boat.position.set(35,.35,-119);boat.rotation.y=-.3;scene.add(boat);
const hull=addMesh(new THREE.SphereGeometry(1,12,8),mat(0x9c6b48),0,.3,0,boat);hull.scale.set(2.8,.55,1.05);hull.castShadow=true;
box(boat,mats.wood,0,.62,0,4.4,.14,1.25,true);box(boat,mats.wood,0,2.15,0,.13,3.2,.13);
const sailGeo=new THREE.BufferGeometry();sailGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,3.65,0, 0,1,0, 2,1.1,0],3));sailGeo.computeVertexNormals();
addMesh(sailGeo,mat(0xfff6de,{side:THREE.DoubleSide}),0,0,0,boat);
// A friendly, original explorer in a red cap and yellow backpack.
const player=new THREE.Group();scene.add(player);
const skin=mat(0xeeb689),hair=mat(0x413c36),cap=mat(0xe3574c),jacket=mat(0x435a72),pants=mat(0x75a8bc),shoes=mat(0x384e58),pack=mat(0xe6bf63);
box(player,pants,-.22,.47,0,.34,.85,.36,true);box(player,pants,.22,.47,0,.34,.85,.36,true);
box(player,shoes,-.22,.1,-.07,.38,.2,.5,true);box(player,shoes,.22,.1,-.07,.38,.2,.5,true);
box(player,jacket,0,1.22,0,.78,.83,.45,true);box(player,skin,-.49,1.2,0,.22,.7,.25);box(player,skin,.49,1.2,0,.22,.7,.25);
const head=addMesh(new THREE.SphereGeometry(.38,12,8),skin,0,1.91,0,player);head.castShadow=true;
const hairMesh=addMesh(new THREE.SphereGeometry(.39,12,8,0,Math.PI*2,0,Math.PI*.6),hair,0,2.04,0,player);hairMesh.castShadow=true;
const capTop=addMesh(new THREE.SphereGeometry(.43,12,8,0,Math.PI*2,0,Math.PI*.48),cap,0,2.16,0,player);capTop.castShadow=true;box(player,cap,0,2.14,-.36,.62,.09,.38);
box(player,pack,0,1.25,.32,.69,.69,.25,true);box(player,mats.dark,0,1.45,.46,.7,.08,.04);
// Landmark beacons use stable positions and animate independently of streamed chunks.
const landmarkObjects=landmarks.map(l=>{
  const group=new THREE.Group();group.position.set(l.x,0,l.z);scene.add(group);
  const base=addMesh(new THREE.CylinderGeometry(2.5,2.5,.13,32),mats.sand,0,.12,0,group);base.receiveShadow=true;
  const ring=addMesh(new THREE.RingGeometry(2.12,2.23,32),mat(0xe3c483,{side:THREE.DoubleSide}),0,.195,0,group);ring.rotation.x=-Math.PI/2;
  const post=box(group,mats.wood,0,1.1,0,.22,2.2,.22);const sign=box(group,mat(0x418c7d),0,2.35,0,1.65,.8,.18);
  const insignia=addMesh(new THREE.OctahedronGeometry(.16),mats.gold,0,2.36,.12,group);insignia.scale.set(1,.8,.3);
  for(let i=0;i<10;i++){const a=i*Math.PI*2/10;const bud=addMesh(geo.flower,i%2?mats.flower:mats.flowerBlue,Math.cos(a)*2.5,.28,Math.sin(a)*2.5,group);bud.scale.setScalar(.19);}
  const mark=addMesh(new THREE.OctahedronGeometry(.32),mat(0xffdb76,{emissive:0xa57820,emissiveIntensity:.4}),0,3.75,0,group);return{...l,group,mark,sign,post};
});
function updateLandmarkMarkers(){landmarkObjects.forEach(l=>{l.mark.visible=!state.discoveries.includes(l.id);});}
function updateView(){activeCamera=state.view==='3d'?camera3d:cameraTop;$('viewLabel').textContent=state.view==='3d'?'Góc nhìn 3D':'Nhìn từ trên';$('viewButton').setAttribute('aria-label',`Đổi góc nhìn, hiện tại: ${$('viewLabel').textContent}`);}
function resize(){renderer.setSize(innerWidth,innerHeight);camera3d.aspect=innerWidth/innerHeight;camera3d.updateProjectionMatrix();const aspect=innerWidth/innerHeight;cameraTop.left=-23*aspect;cameraTop.right=23*aspect;cameraTop.top=23;cameraTop.bottom=-23;cameraTop.updateProjectionMatrix();}addEventListener('resize',resize);resize();
const cameraGoal=new THREE.Vector3();
function moveCamera(snap=false,dt=.016){const p=player.position;if(state.view==='3d')cameraGoal.set(p.x+1.2,p.y+5,p.z+9.5);else cameraGoal.set(p.x,p.y+65,p.z+.01);if(snap)activeCamera.position.copy(cameraGoal);else activeCamera.position.lerp(cameraGoal,1-Math.exp(-5*dt));activeCamera.lookAt(p.x,p.y+1.9,p.z-7);}
function syncWorld(){player.position.set(state.x,0,state.z);updateChunks();updateMeadow(true);updateView();moveCamera(true);updateLandmarkMarkers();updateUI();}
function blocked(x,z){if(Math.abs(x)>LIMIT||Math.abs(z)>LIMIT)return true;if(inRiver(z)){const bridge=Math.round(x/CHUNK)*CHUNK;if(Math.abs(x-bridge)>5)return true;return false;}const gx=Math.floor(x/ROAD_SPACING),gz=Math.floor(z/ROAD_SPACING),l=lot(gx,gz);return !l.park&&Math.abs(x-l.x)<l.width/2+.45&&Math.abs(z-l.z)<l.depth/2+.45;}
// Real, CC0-licensed models replace procedural stand-ins after loading. The
// stand-ins remain usable if a model cannot be fetched or decoded.
async function loadArtAssets(){
  const loader=new GLTFLoader();
  loader.loadAsync('/assets/models/explorer.glb').then(gltf=>{
    const model=gltf.scene;model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model), size=bounds.getSize(new THREE.Vector3());
    if(!Number.isFinite(size.y)||size.y<.001)throw new Error('Invalid explorer model bounds');
    const factor=2.15/size.y;model.scale.setScalar(factor);model.position.y=-bounds.min.y*factor;model.rotation.y=Math.PI;
    model.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>{if(material.name==='Shirt')material.color.set(0x3b9ca8);if(material.name==='Pants')material.color.set(0x638cac);});}});
    player.children.forEach(child=>child.visible=false);player.add(model);
    // Small original backpack and cap keep the explorer's silhouette readable from behind.
    const gear=new THREE.Group();player.add(gear);
    box(gear,pack,0,1.25,.28,.6,.57,.28,true);box(gear,mats.dark,0,1.42,.43,.58,.055,.05);
    const capTop=addMesh(new THREE.SphereGeometry(.33,12,8,0,Math.PI*2,0,Math.PI*.48),mat(0x318d99),0,2.17,0,gear);capTop.castShadow=true;
    box(gear,mat(0x318d99),0,2.16,-.27,.5,.07,.3);

    explorerMixer=new THREE.AnimationMixer(model);gltf.animations.forEach(clip=>{explorerActions[clip.name]=explorerMixer.clipAction(clip);});
    if(explorerActions.Idle){explorerActions.Idle.play();explorerAction='Idle';}
  }).catch(error=>console.warn('Using the procedural explorer:',error));
  Promise.all(['building-type-a','building-type-c','building-type-g'].map(name=>loader.loadAsync(`/assets/models/${name}.glb`))).then(results=>{
    const models=results.map(gltf=>{
      gltf.scene.updateMatrixWorld(true);let source;gltf.scene.traverse(o=>{if(!source&&o.isMesh)source=o;});if(!source)throw new Error('Building model has no mesh');
      const geometry=source.geometry.clone();geometry.applyMatrix4(source.matrixWorld);geometry.computeBoundingBox();const bounds=geometry.boundingBox,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      if(size.x<.001||size.y<.001||size.z<.001)throw new Error('Invalid building dimensions');
      geometry.translate(-center.x,-bounds.min.y,-center.z);geometry.scale(1/size.x,1/size.y,1/size.z);geometry.computeBoundingSphere();
      const material=source.material.clone(),index=results.indexOf(gltf);
      if(index>0&&material.map?.image){const image=material.map.image,c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height);
        for(let p=0;p<pixels.data.length;p+=4){const r=pixels.data[p],g=pixels.data[p+1],b=pixels.data[p+2];if(g>r*1.15&&g>b*1.04&&g>50){if(index===1){pixels.data[p]=Math.min(255,g*1.05);pixels.data[p+1]=g*.59;pixels.data[p+2]=g*.45;}else{pixels.data[p]=g*.48;pixels.data[p+1]=g*.83;pixels.data[p+2]=Math.min(255,g*1.06);}}}ctx.putImageData(pixels,0,0);
        const tex=new THREE.CanvasTexture(c);tex.flipY=material.map.flipY;tex.wrapS=material.map.wrapS;tex.wrapT=material.map.wrapT;tex.colorSpace=material.map.colorSpace;material.map=tex;material.needsUpdate=true;
      }return {geometry,material};
    });
    cityModels.push(...models);
    refreshChunks();
  }).catch(error=>console.warn('Using procedural buildings:',error));
  Promise.all(['tree_oak','tree_detailed','tree_pineRoundA','rock_largeA'].map(name=>loader.loadAsync(`/assets/models/nature/${name}.glb`))).then(results=>{
    const models=results.map(gltf=>{
      gltf.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),parts=[];
      if(size.x<.001||size.y<.001||size.z<.001)throw new Error('Invalid nature asset');
      gltf.scene.traverse(source=>{if(!source.isMesh)return;const geometry=source.geometry.clone();geometry.applyMatrix4(source.matrixWorld);geometry.translate(-center.x,-bounds.min.y,-center.z);geometry.scale(1/size.x,1/size.y,1/size.z);geometry.computeBoundingSphere();const material=source.material.clone();material.metalness=0;material.roughness=1;
        if(material.name.toLowerCase().includes('leaf')) material.color.set(material.name.toLowerCase().includes('dark')?0x348f51:0x67bb4d);
        else if(material.name.toLowerCase().includes('wood')) material.color.set(0x98734e);
        else if(material.name.toLowerCase().includes('dirt')) material.color.set(0xb1beb2);
        else if(material.name.toLowerCase()==='grass') material.color.set(0xc0cbb8);
        parts.push({geometry,material});});
      if(!parts.length)throw new Error('Nature asset has no meshes');return parts;
    });natureModels.push(...models);refreshChunks();
  }).catch(error=>console.warn('Using procedural trees:',error));
}
function refreshChunks(){for(const group of chunkGroups.values()){scene.remove(group);group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}chunkGroups.clear();updateChunks();}
// Labels are projected over the destination, not fixed cards covering the scene.
const labelPosition=new THREE.Vector3();
function updateTargetLabel(){
  const target=nearestLandmark(), label=$('worldTarget'), edge=$('edgeTarget');
  if(!playing||modal||!target){label.classList.add('hidden');edge.classList.add('hidden');return;}
  activeCamera.updateMatrixWorld();labelPosition.set(target.x,4.7,target.z).project(activeCamera);
  const onScreen=labelPosition.z>-1&&labelPosition.z<1&&Math.abs(labelPosition.x)<.91&&Math.abs(labelPosition.y)<.90;
  if(onScreen&&target.d<100){
    label.style.left=`${(labelPosition.x*.5+.5)*100}%`;label.style.top=`${(-labelPosition.y*.5+.5)*100}%`;
    label.classList.remove('hidden');edge.classList.add('hidden');
  }else{
    label.classList.add('hidden');edge.classList.remove('hidden');
    $('edgeDistance').textContent=formatDistance(target.d);
    const angle=Math.atan2(target.x-state.x, state.z-target.z)*180/Math.PI;
    $('edgeArrow').style.transform=`rotate(${angle}deg)`;
  }
}
const map=$('map').getContext('2d');
function drawMap(){const w=180,c=map,scale=1.2;const sx=x=>w/2+(x-state.x)*scale,sz=z=>w/2+(z-state.z)*scale;c.fillStyle='#b0d998';c.fillRect(0,0,w,w);c.fillStyle='#93cc87';for(let gx=Math.floor((state.x-80)/ROAD_SPACING);gx<=Math.ceil((state.x+80)/ROAD_SPACING);gx++)for(let gz=Math.floor((state.z-80)/ROAD_SPACING);gz<=Math.ceil((state.z+80)/ROAD_SPACING);gz++){let l=lot(gx,gz);if(!l.park){c.fillStyle=['#e9d9b8','#e9c8af','#cee5cd','#e9dfc5'][l.color];c.fillRect(sx(l.x-l.width/2),sz(l.z-l.depth/2),l.width*scale,l.depth*scale);}}
  c.fillStyle='#efebce';for(let x=Math.floor((state.x-80)/ROAD_SPACING)*ROAD_SPACING;x<state.x+80;x+=ROAD_SPACING)c.fillRect(sx(x-ROAD_WIDTH/2),0,ROAD_WIDTH*scale,w);for(let z=Math.floor((state.z-80)/ROAD_SPACING)*ROAD_SPACING;z<state.z+80;z+=ROAD_SPACING)c.fillRect(0,sz(z-ROAD_WIDTH/2),w,ROAD_WIDTH*scale);
  c.fillStyle='#75ced5';c.fillRect(0,sz(RIVER_MIN),w,(RIVER_MAX-RIVER_MIN)*scale);c.fillStyle='#fff3d1';for(let x=Math.floor((state.x-80)/CHUNK)*CHUNK;x<state.x+80;x+=CHUNK)c.fillRect(sx(x-7),sz(RIVER_MIN),14*scale,(RIVER_MAX-RIVER_MIN)*scale);
  landmarks.forEach(l=>{if(state.discoveries.includes(l.id))return;const x=sx(l.x),z=sz(l.z);if(x<0||x>w||z<0||z>w)return;c.fillStyle='#f2bd50';c.beginPath();c.arc(x,z,4,0,Math.PI*2);c.fill();});c.fillStyle='#fff';c.beginPath();c.arc(w/2,w/2,7,0,Math.PI*2);c.fill();c.fillStyle='#e66b56';c.beginPath();c.moveTo(w/2,w/2-5);c.lineTo(w/2-4,w/2+4);c.lineTo(w/2+4,w/2+4);c.closePath();c.fill();}
const clock=new THREE.Clock();let lastChunk='',walk=0,waterNotice=0;
function tick(){requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
  isWalking=false;isRunning=false;
  if(playing&&!modal){const dx=(keys.has('d')||keys.has('arrowright')||touch.has('right')?1:0)-(keys.has('a')||keys.has('arrowleft')||touch.has('left')?1:0),dz=(keys.has('s')||keys.has('arrowdown')||touch.has('down')?1:0)-(keys.has('w')||keys.has('arrowup')||touch.has('up')?1:0);if(dx||dz){const len=Math.hypot(dx,dz),speed=(keys.has('shift')||touch.has('run'))?12:5.5;const mx=dx/len*speed*dt,mz=dz/len*speed*dt;const nx=state.x+mx,nz=state.z+mz;const oldX=state.x,oldZ=state.z;if(!blocked(nx,state.z))state.x=nx;if(!blocked(state.x,nz))state.z=nz;isWalking=Math.hypot(state.x-oldX,state.z-oldZ)>.0001;isRunning=isWalking&&speed>6;if(inRiver(nz)&&!inRiver(state.z)&&Math.abs(state.x-Math.round(state.x/CHUNK)*CHUNK)>5&&t-waterNotice>4){showToast('Hãy tìm cây cầu để băng qua sông nhé!');waterNotice=t;}player.rotation.y=Math.atan2(dx,dz)+Math.PI;walk+=dt*12;player.position.set(state.x,explorerMixer?0:Math.abs(Math.sin(walk))*.07,state.z);updateUI();}else player.position.y=0;
    updateMeadow();const chunk=`${Math.floor(state.x/CHUNK)},${Math.floor(state.z/CHUNK)}`;if(chunk!==lastChunk){updateChunks();lastChunk=chunk;}
    const l=nearestLandmark();$('landmarkPrompt').classList.toggle('hidden',!l||l.d>7);if(l&&l.d<=7)$('promptName').textContent=l.name;elapsedSave+=dt;if(elapsedSave>5){save();elapsedSave=0;}
  }
  if(explorerMixer){const desired=isRunning?'Run':isWalking?'Walk':'Idle';if(desired!==explorerAction&&explorerActions[desired]){const old=explorerActions[explorerAction];const next=explorerActions[desired];next.reset().fadeIn(.18).play();if(old)old.fadeOut(.18);explorerAction=desired;}explorerMixer.update(dt);}
  waterTexture.offset.x=(t*.008)%1;boat.position.y=.35+Math.sin(t*1.2)*.08;boat.rotation.z=Math.sin(t*.9)*.025;scenery.position.set(state.x,0,state.z);
  landmarkObjects.forEach((l,i)=>{l.mark.rotation.y+=dt;l.mark.position.y=3.75+Math.sin(t*2+i)*.18;});sun.position.set(state.x-40,75,state.z+35);sun.target.position.set(state.x,0,state.z);sun.target.updateMatrixWorld();moveCamera(!playing,dt);updateTargetLabel();drawMap();renderer.render(scene,activeCamera);
}
$('start').onclick=()=>{if(readSave()&&!confirm('Bắt đầu lại sẽ ghi đè chuyến đi đã lưu. Tiếp tục?'))return;start(null);};$('continue').onclick=()=>{const s=readSave();if(s)start(s);else refreshContinue();};$('introClose').onclick=()=>showModal('');$('resume').onclick=()=>showModal('');$('backHome').onclick=home;$('viewButton').onclick=toggleView;$('leftViewButton').onclick=toggleView;$('travelButton').onclick=()=>setTravel('');$('leftTravelButton').onclick=()=>setTravel('');$('leftPauseButton').onclick=()=>{if(playing&&!modal){save();showModal('pause');}};$('interactButton').onclick=interact;$('openTravel').onclick=()=>setTravel('pause');$('closeTravel').onclick=()=>showModal(previousModal);document.querySelectorAll('[data-location]').forEach(b=>b.onclick=()=>goTravel(b.dataset.location));$('touchInteract').onclick=interact;$('discoveredClose').onclick=()=>showModal(state.discoveries.length===3?'complete':'');$('completeClose').onclick=()=>showModal('');
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(k==='escape'){if(modal==='travel')showModal(previousModal);else if(modal==='pause')showModal('');else if(modal==='intro')showModal('');else if(!modal&&playing){save();showModal('pause');}return;}if(modal||!playing)return;if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(e.repeat)return;if(k==='q')toggleView();else if(k==='e')interact();else if(k==='m')setTravel('');keys.add(k);});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>{keys.clear();touch.clear();if(playing&&!modal){save();showModal('pause');}});addEventListener('beforeunload',save);
document.querySelectorAll('[data-dir]').forEach(button=>{button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touch.add(button.dataset.dir);});['pointerup','pointercancel','lostpointercapture'].forEach(event=>button.addEventListener(event,()=>touch.delete(button.dataset.dir)));});
const run=$('touchRun');run.addEventListener('pointerdown',e=>{e.preventDefault();run.setPointerCapture(e.pointerId);touch.add('run');});['pointerup','pointercancel','lostpointercapture'].forEach(event=>run.addEventListener(event,()=>touch.delete('run')));
refreshContinue();syncWorld();loadArtAssets();tick();
