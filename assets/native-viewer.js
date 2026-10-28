/* PM3 v13: native per-body FE surface skins with paired nodal temperature. */
(()=>{'use strict';
const B=window.PM3Bridge,C=window.PM3_NATIVE_CATALOG;
if(!B||!C)return;
const $=s=>document.querySelector(s),root=new B.Group();B.scene.add(root);
const partLayer={1:'bt',2:'bumps',3:'uf',4:'si',5:'si',6:'tim1',7:'tim1',8:'tim1',9:'seal',10:'lid',11:'sink',12:'cavity'};
const base={1:'#407d73',2:'#a0bdca',3:'#9bc3b4',4:'#657da2',5:'#416583',6:'#eed5a1',7:'#cd975d',8:'#84cbdc',9:'#6da7a2',10:'#bf885e',11:'#ba8155',12:'#b4dce9'};
// Lighter fills and darker outlines retain each material's color family.
const geometryFill=Object.fromEntries(Object.entries(base).map(([id,c])=>[id,new B.Color(c).lerp(new B.Color('#ffffff'),.16)]));
const geometryOutline=Object.fromEntries(Object.entries(base).map(([id,c])=>[id,new B.Color(c).multiplyScalar(.45)]));
const stops=[[74.75,'#183f9a'],[77,'#147fce'],[79,'#1bc6bc'],[80,'#ffe548'],[85,'#ffb122'],[92,'#fa651b'],[100,'#db221e'],[104.8,'#970e32']];
function color(t){let i=0;while(i<stops.length-2&&t>stops[i+1][0])i++;let [a,x]=stops[i],[b,y]=stops[i+1];return new B.Color(x).lerp(new B.Color(y),Math.max(0,Math.min(1,(t-a)/(b-a))));}
const status=document.createElement('div');status.className='native-status';$('#scene-container').append(status);
const grid=document.createElement('section');grid.className='native-grid-panel';grid.hidden=true;grid.innerHTML='<header><strong>Native FE · 3 × 3 sensitivity comparison</strong><div><label>Structure <select id="native-grid-part"><option value="tim1">TIM1 + defect</option><option value="si">Silicon</option><option value="all">Full package · exploded</option><option value="bumps">Metal bumps</option><option value="uf">Underfill</option><option value="lid">Copper lid</option><option value="sink">Heatsink</option><option value="bt">Substrate</option><option value="seal">Seal</option></select></label><button id="native-grid-refresh">Refresh previews</button><button id="native-grid-exit">Return to package</button></div><small>Rows: M0 / 10% F-M2 / 10% F-M3 · columns: coarse / medium / fine. Click a model to rotate and inspect it.</small></header><div class="native-nine"></div>';$('#scene-container').append(grid);
const controls=document.createElement('div');controls.className='native-controls';controls.innerHTML='<button id="native-grid-back" hidden>← Nine comparisons</button><label><input id="native-pore" type="checkbox"> Show pore air</label><label><input id="native-cavity" type="checkbox"> Show cavity air</label><button id="native-retry" hidden>Retry data</button>';$('#scene-container').append(controls);
// Opaque screen-door fades preserve fin occlusion throughout isolation transitions.
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
function presentationMaterial(material,shade=false){
 const fade={value:1};material.userData.fade=fade;
 material.onBeforeCompile=shader=>{
  shader.uniforms.pm3Fade=fade;
  shader.fragmentShader='uniform float pm3Fade;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
   float threshold = (mod(floor(gl_FragCoord.x),4.0)+4.0*mod(floor(gl_FragCoord.y),4.0)+0.5)/16.0;
   if(pm3Fade < threshold) discard;`);
  if(shade)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   #ifndef USE_COLOR
    vec3 faceNormal=normalize(cross(dFdx(vViewPosition),dFdy(vViewPosition)));
    float key=max(0.0,dot(faceNormal,normalize(vec3(-0.45,0.75,0.65))));
    outgoingLight *= 0.52+0.48*key;
   #endif
   #include <opaque_fragment>`);
  if(shade){
   shader.vertexShader='varying vec3 vViewPosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvViewPosition = -mvPosition.xyz;');
   shader.fragmentShader='varying vec3 vViewPosition;\n'+shader.fragmentShader;
  }
 };
 material.customProgramCacheKey=()=>shade?'pm3-face-shading-v1':'pm3-fade-v1';return material;
}
const chunkCache=new Map(),pending=new Map();
window.PM3_NATIVE_CHUNK=(name,data)=>{chunkCache.set(name,data);if(pending.has(name))pending.get(name).resolve(data);};
async function record(id){let name=C.index[id];if(!name)throw Error('Missing native record: '+id);if(chunkCache.has(name))return chunkCache.get(name)[id];if(!pending.has(name)){let resolve,reject,promise=new Promise((a,b)=>{resolve=a;reject=b});pending.set(name,{promise,resolve,reject});let script=document.createElement('script');script.src='assets/native/'+name;script.onload=()=>{script.remove();if(!chunkCache.has(name))reject(Error('Empty dataset '+name));};script.onerror=()=>{script.remove();pending.delete(name);reject(Error('Could not load assets/native/'+name));};document.head.append(script);}let data=await pending.get(name).promise;return data[id];}
async function inflate(rec){let bytes=Uint8Array.from(atob(rec.data),c=>c.charCodeAt(0));return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();}
async function snapshot(id){let v=JSON.parse(new TextDecoder().decode(await inflate(await record(id))));if(v.case_id!==id)throw Error('Native case mismatch');return v;}
function mesh(raw){let d=new DataView(raw);if(new TextDecoder().decode(new Uint8Array(raw,0,8))!=='EPTCMSH1')throw Error('Invalid mesh');let n=d.getUint32(8,true),f=d.getUint32(12,true),e=d.getUint32(16,true),p=20;const read=(type,len)=>{let a=new type(len);for(let i=0;i<len;i++,p+=4)a[i]=type===Int32Array?d.getInt32(p,true):d.getUint32(p,true);return a;};let q=read(Int32Array,n*3),offsets=read(Uint32Array,f+1),indices=read(Uint32Array,e);if(p!==raw.byteLength||offsets[f]!==e)throw Error('Mesh length mismatch');return{n,f,q,offsets,indices};}
function temperature(raw){let d=new DataView(raw);if(new TextDecoder().decode(new Uint8Array(raw,0,8))!=='EPTCTMP2')throw Error('Invalid temperature');let n=d.getUint32(8,true),a=new Float32Array(n),t=0;for(let i=0;i<n;i++){t+=d.getInt32(12+i*4,true);a[i]=t/1000;}if(raw.byteLength!==12+n*4)throw Error('Temperature length mismatch');return a;}
const patterns={3:[0,1,2],4:[0,1,2,0,2,3],6:[0,1,5,1,2,3,5,3,4,1,3,5],8:[0,1,7,1,2,3,3,4,5,5,6,7,1,3,7,3,5,7]};
function addFeatureFace(edges,indices,keys,pos,start,end,offset,contacts=null,range=null){
 let contactFace=null,normal=new B.Vector(),vertices=[];
 for(let j=start;j<end;j++)vertices.push(indices[j]);
 for(let j=0;j<vertices.length;j++){
  let a=vertices[j]*3,b=vertices[(j+1)%vertices.length]*3;
  normal.x+=(pos[a+1]-pos[b+1])*(pos[a+2]+pos[b+2]);
  normal.y+=(pos[a+2]-pos[b+2])*(pos[a]+pos[b]);
  normal.z+=(pos[a]-pos[b])*(pos[a+1]+pos[b+1]);
 }
 if(normal.lengthSq()<1e-20)return;
 normal.normalize();
 if(contacts&&range){
  let axis=[normal.x,normal.y,normal.z].findIndex(v=>Math.abs(v)>.999999);
  if(axis>=0){let value=pos[vertices[0]*3+axis],side=Math.abs(value-range.min[axis])<1e-6?-1:Math.abs(value-range.max[axis])<1e-6?1:0;
   if(side&&vertices.every(v=>Math.abs(pos[v*3+axis]-value)<1e-6)){
    let key=axis+':'+Math.round(value*1e5),entry=contacts.get(key)||{negative:[],positive:[]},uv=[0,1,2].filter(i=>i!==axis);
    let polygon=vertices.map(v=>[pos[v*3+uv[0]],pos[v*3+uv[1]]]);entry[side<0?'negative':'positive'].push(polygon);contacts.set(key,entry);contactFace={key,side,polygon};
   }
  }
 }
 for(let j=0;j<vertices.length;j++){
  let a=vertices[j],b=vertices[(j+1)%vertices.length],ka=keys[a],kb=keys[b];
  if(ka===kb)continue;
  let key=ka<kb?ka+'|'+kb:kb+'|'+ka,edge=edges.get(key);
  if(edge){edge.count++;edge.sharp ||= Math.abs(edge.normal.dot(normal))<Math.cos(Math.PI/5);}
  else edges.set(key,{a:offset+a,b:offset+b,normal:normal.clone(),count:1,sharp:false});
 }
 return contactFace;
}
function onPolygon(point,polygon){
 let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  let a=polygon[j],b=polygon[i],dx=b[0]-a[0],dy=b[1]-a[1],px=point[0]-a[0],py=point[1]-a[1],length=Math.hypot(dx,dy);
  if(length>0&&Math.abs(px*dy-py*dx)<=1e-6*length&&px*dx+py*dy>=-1e-6*length&&px*dx+py*dy<=length*length+1e-6*length)return true;
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;
}
function contactContains(entry,side,point){
 if(!entry.grid){
  let all=[...entry.negative,...entry.positive],min=[Infinity,Infinity],max=[-Infinity,-Infinity];
  for(let polygon of all)for(let v of polygon)for(let a=0;a<2;a++){min[a]=Math.min(min[a],v[a]);max[a]=Math.max(max[a],v[a]);}
  let n=Math.min(64,Math.max(1,Math.ceil(Math.sqrt(all.length)))),bins={negative:new Map(),positive:new Map()};
  const cell=(v,a)=>Math.max(0,Math.min(n-1,Math.floor((v-min[a])/Math.max(max[a]-min[a],1e-9)*n)));
  for(let key of ['negative','positive'])for(let polygon of entry[key]){
   let lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];for(let v of polygon)for(let a=0;a<2;a++){lo[a]=Math.min(lo[a],v[a]);hi[a]=Math.max(hi[a],v[a]);}
   for(let x=cell(lo[0]-1e-6,0);x<=cell(hi[0]+1e-6,0);x++)for(let y=cell(lo[1]-1e-6,1);y<=cell(hi[1]+1e-6,1);y++){let k=x*n+y,list=bins[key].get(k);if(list)list.push(polygon);else bins[key].set(k,[polygon]);}
  }
  entry.grid={min,max,n,bins,cell};
 }
 let {min,max,n,bins,cell}=entry.grid;if(point.some((v,a)=>v<min[a]-1e-6||v>max[a]+1e-6))return false;
 return (bins[side].get(cell(point[0],0)*n+cell(point[1],1))||[]).some(p=>onPolygon(point,p));
}
function coveredContact(face,contacts){
 let entry=contacts.get(face.key),other=entry[face.side<0?'positive':'negative'];if(!other.length)return false;
 let polygon=face.polygon,center=[0,0],samples=[...polygon];
 for(let i=0;i<polygon.length;i++){let a=polygon[i],b=polygon[(i+1)%polygon.length];center[0]+=a[0]/polygon.length;center[1]+=a[1]/polygon.length;samples.push([(a[0]+b[0])/2,(a[1]+b[1])/2]);}
 samples.push(center);return samples.every(point=>contactContains(entry,face.side<0?'positive':'negative',point));
}
function featureIndices(edges,contacts=null,positions=null){
 let indices=[];
 for(let e of edges.values())if(e.count===2&&e.sharp){
  let internal=false;
  if(contacts&&positions)for(let axis=0;axis<3;axis++){
   let a=positions[e.a*3+axis],b=positions[e.b*3+axis];if(Math.abs(a-b)>1e-6)continue;
   let faces=contacts.get(axis+':'+Math.round((a+b)/2*1e5));if(!faces?.negative.length||!faces.positive.length)continue;
   let uv=[0,1,2].filter(i=>i!==axis),point=uv.map(i=>(positions[e.a*3+i]+positions[e.b*3+i])/2);
   if(contactContains(faces,'negative',point)&&contactContains(faces,'positive',point)){internal=true;break;}
  }
  if(!internal)indices.push(e.a,e.b);
 }
 return new Uint32Array(indices);
}
function concat(arr,type,size){let out=new type(size),o=0;for(let a of arr){out.set(a,o);o+=a.length;}return out;}
async function build(rec,scope='all',patch=null){
 const geometries=new Map(),temps=new Map(),parts=new Map();
 for(let body of rec.bodies){
  let layer=partLayer[body.part];if(scope!=='all'&&scope!==layer)continue;
  if(!geometries.has(body.mesh))geometries.set(body.mesh,mesh(await inflate(await record(body.mesh))));
  let g=geometries.get(body.mesh);
  let range={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]},keys=new Array(g.n),pos=new Float32Array(g.n*3),xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
  for(let i=0;i<g.n;i++){keys[i]=[g.q[i*3]+body.origin_q[0],g.q[i*3+1]+body.origin_q[1],g.q[i*3+2]+body.origin_q[2]].join(',');let x=(g.q[i*3]+body.origin_q[0])/1e6,y=(g.q[i*3+1]+body.origin_q[1])/1e6,z=(g.q[i*3+2]+body.origin_q[2])/1e6;pos[i*3]=x/5;pos[i*3+1]=z/5;pos[i*3+2]=-y/5;for(let a=0;a<3;a++){range.min[a]=Math.min(range.min[a],pos[i*3+a]);range.max[a]=Math.max(range.max[a],pos[i*3+a]);}xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);}
  if(patch&&(xmax<patch[0]+1e-5||xmin>patch[1]-1e-5||ymax<patch[2]+1e-5||ymin>patch[3]-1e-5))continue;
  if(!temps.has(body.temperatures))temps.set(body.temperatures,temperature(await inflate(await record(body.temperatures))));let t=temps.get(body.temperatures);if(t.length!==g.n||g.n!==body.surface_vertices)throw Error('Native mesh/temperature pairing mismatch');
  if(!parts.has(body.part))parts.set(body.part,{pos:[],col:[],tri:[],line:[],features:new Map(),contacts:new Map(),contactFaces:[],n:0,nt:0,nl:0});let p=parts.get(body.part),col=new Float32Array(g.n*3);
  for(let i=0;i<g.n;i++){let c=color(t[i]);col.set([c.r,c.g,c.b],i*3);}
  let triangles=[],lines=[],seen=new Set();for(let f=0;f<g.f;f++){let start=g.offsets[f],end=g.offsets[f+1],len=end-start,pat=patterns[len];if(!pat)throw Error('Unsupported native face width '+len);let contact=addFeatureFace(p.features,g.indices,keys,pos,start,end,p.n,p.contacts,range);if(contact)p.contactFaces.push({...contact,start:p.nt+triangles.length,count:pat.length});for(let v of pat)triangles.push(p.n+g.indices[start+v]);for(let i=start;i<end;i++){let a=g.indices[i],b=g.indices[i+1<end?i+1:start],key=Math.min(a,b)*g.n+Math.max(a,b);if(!seen.has(key)){seen.add(key);lines.push(p.n+a,p.n+b);}}}
  p.pos.push(pos);p.col.push(col);p.tri.push(new Uint32Array(triangles));p.line.push(new Uint32Array(lines));p.n+=g.n;p.nt+=triangles.length;p.nl+=lines.length;
 }
 let group=new B.Group();group.userData.caseId=rec.case_id;group.userData.snapshot=rec;
 for(let [id,p]of parts){let part=new B.Group(),geometry=new B.Geometry(),position=new B.Attribute(concat(p.pos,Float32Array,p.n*3),3);geometry.setAttribute('position',position);geometry.setAttribute('color',new B.Attribute(concat(p.col,Float32Array,p.n*3),3));geometry.setIndex(new B.Attribute(concat(p.tri,Uint32Array,p.nt),1));let mat=new B.Basic({color:base[id],side:B.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,toneMapped:false});presentationMaterial(mat,true);let surface=new B.Mesh(geometry,mat);surface.userData.nativePart=id;part.add(surface);let lg=new B.Geometry();lg.setAttribute('position',position);lg.setIndex(new B.Attribute(concat(p.line,Uint32Array,p.nl),1));let lm=new B.LineMaterial({color:'#163e52',transparent:true,opacity:.78,toneMapped:false});presentationMaterial(lm);part.add(new B.Lines(lg,lm));
 let eg=new B.Geometry();eg.setAttribute('position',position);eg.setIndex(new B.Attribute(featureIndices(p.features,p.contacts,position.array),1));p.features.clear();
 // Geometry uses the exposed skin; native FE triangles remain intact for Mesh/Temperature.
 let hidden=new Uint8Array(p.nt),original=geometry.index.array;
 for(let face of p.contactFaces)if(coveredContact(face,p.contacts))hidden.fill(1,face.start,face.start+face.count);
 let exposed=new Uint32Array(p.nt),write=0;for(let i=0;i<p.nt;i++)if(!hidden[i])exposed[write++]=original[i];
 let exteriorGeometry=new B.Geometry();exteriorGeometry.setAttribute('position',position);exteriorGeometry.setAttribute('color',geometry.attributes.color);exteriorGeometry.setIndex(new B.Attribute(exposed.subarray(0,write),1));p.contacts.clear();p.contactFaces=[];
 let outline=new B.Lines(eg,presentationMaterial(new B.LineMaterial({color:geometryOutline[id],depthTest:true,depthWrite:false,toneMapped:false})));part.add(outline);
 geometry.computeBoundingBox();let box=geometry.boundingBox;exteriorGeometry.boundingBox=box.clone();part.userData={part:id,layer:partLayer[id],center:(box.min.y+box.max.y)/2,surface,nativeGeometry:geometry,exteriorGeometry,lines:part.children[1],outline,fade:1};group.add(part);}
 // A single physical anchor keeps source/bulk silicon and TIM1 phases aligned.
 const bounds=new Map();for(let p of group.children){let b=p.userData.surface.geometry.boundingBox,k=p.userData.layer,r=bounds.get(k)||{min:Infinity,max:-Infinity};r.min=Math.min(r.min,b.min.y);r.max=Math.max(r.max,b.max.y);bounds.set(k,r);}
 group.userData.layerBounds=Object.fromEntries(bounds);
 group.userData.anchors=Object.fromEntries([...bounds].map(([k,b])=>[k,(b.min+b.max)/2]));
 geometries.clear();temps.clear();return group;
}
function dispose(g){if(!g)return;g.traverse(o=>{if(o.userData.nativeGeometry){for(let geometry of [o.userData.nativeGeometry,o.userData.exteriorGeometry])if(geometry!==o.userData.surface.geometry)geometry.dispose();}o.geometry?.dispose();if(o.material)o.material.dispose();});g.removeFromParent();}
let active=null,loadingKey='',loadedKey='',errorKey='',generation=0,expanded=null,lastState='',gridGeneration=0,gridKey='',previewsRunning=false;
function mode(group,render){for(let p of group.children){let {part:id,surface,lines}=p.userData;surface.geometry=render==='geometry'?p.userData.exteriorGeometry:p.userData.nativeGeometry;surface.material.vertexColors=render==='temperature';surface.material.color.copy(render==='geometry'?geometryFill[id]:new B.Color(render==='temperature'?'#ffffff':base[id]));surface.material.needsUpdate=true;lines.visible=render==='mesh';p.userData.outline.visible=render==='geometry';p.userData.allowed=(id!==8||$('#native-pore').checked)&&(id!==12||$('#native-cavity').checked);}}
function trimChunks(){if(chunkCache.size<=12)return;let keep=new Set([...chunkCache.keys()].slice(-8));for(let k of chunkCache.keys())if(!keep.has(k)){chunkCache.delete(k);pending.delete(k);}}
async function loadMain(id,scope,patch,key){let token=++generation;loadingKey=key;errorKey='';status.textContent='Loading exact native FE surface · '+id;status.dataset.state='loading';$('#native-retry').hidden=true;try{let rec=await snapshot(id),g=await build(rec,scope,patch);if(token!==generation||id!==(expanded||B.state().caseId)){dispose(g);return;}dispose(active);active=g;root.add(g);loadedKey=key;lastState='';status.textContent=id+' · '+rec.native_mesh_nodes.toLocaleString()+' nodes · '+rec.native_volume_elements.toLocaleString()+' volume elements';status.dataset.state='ready';status.dataset.caseId=id;trimChunks();}catch(e){if(token!==generation)return;errorKey=key;dispose(active);active=null;loadedKey='';status.textContent='Native data unavailable: '+e.message;status.dataset.state='error';$('#native-retry').hidden=false;console.error(e);}finally{if(token===generation)loadingKey='';}}
function refresh(){lastState='';}
window.pm3NativeRefresh=refresh;
$('#native-retry').onclick=()=>{errorKey='';refresh();};$('#native-pore').onchange=refresh;$('#native-cavity').onchange=()=>{gridKey='';refresh();};
$('#native-grid-exit').onclick=()=>{gridGeneration++;gridKey='';expanded=null;B.showAssembly();refresh();};
$('#native-grid-back').onclick=()=>{expanded=null;loadedKey='';refresh();};$('#native-grid-part').onchange=()=>{gridKey='';refresh();};$('#native-grid-refresh').onclick=()=>{gridKey='';refresh();};
const closedAnchors={sink:1.92,lid:1.405,seal:1.405,tim1:1.183,si:.9955,bumps:.7805,uf:.7805,bt:.5305};
const explodedAnchors={sink:1.92,lid:1.35,seal:1.35,tim1:1.01,si:.73,bumps:.46,uf:.46,bt:.18};
function focusY(group,s,layer,value){
 if(s.view!=='assembly'||s.layout!=='focused')return value;
 let bounds=group.userData.layerBounds.sink,lift=Math.max(0,(bounds.max-bounds.min)/2+.16-.94);
 return value+(layer==='sink'?lift:0)-(s.layer==='sink'?lift:0);
}
function layout(group,s,alpha){
 for(let p of group.children){
  let layer=p.userData.layer,controller=layer==='cavity'?'lid':layer,old=B.layers.get(controller);
  let scale=new B.Vector(1,1,1),position=new B.Vector();
  if(s.view==='assembly'&&(s.layout==='closed'||s.layout==='exploded')){
   // Translate the native assembly by the old view's displacement, not its absolute center.
   if(s.layout==='exploded')position.y=(explodedAnchors[controller]??0)-(closedAnchors[controller]??0);
  }else if(old){
   let data=old.userData,anchor=group.userData.anchors[controller]??group.userData.anchors[layer];
   scale.set(data.targetScale??1,data.targetYScale??1,data.targetScale??1);
   position.set(data.targetX??0,focusY(group,s,controller,data.targetY??0)-anchor*scale.y,-(data.targetZ??0));
  }
  p.userData.targetPosition=position;p.userData.targetDisplayScale=scale;
  p.position.lerp(position,alpha);p.scale.lerp(scale,alpha);
  if(p.position.distanceTo(position)<1e-6)p.position.copy(position);
  if(p.scale.distanceTo(scale)<1e-6)p.scale.copy(scale);
  let solo=s.view!=='assembly'&&s.view!=='mesh-study';
  let target=p.userData.allowed&&(!solo||layer===s.layer)?1:0;
  if(!p.userData.initialized){p.userData.fade=target;p.userData.initialized=true;}
  p.userData.fade+=(target-p.userData.fade)*alpha;
  if(Math.abs(p.userData.fade-target)<.005)p.userData.fade=target;
  p.visible=p.userData.fade>0;
  const ghost=s.layer!=='all'&&layer!==s.layer&&(s.layout==='focused'||s.view!=='assembly');
  let opacity=p.userData.presentationAlpha??1,targetOpacity=ghost?.18:1;opacity+=(targetOpacity-opacity)*alpha;if(Math.abs(opacity-targetOpacity)<.005)opacity=targetOpacity;p.userData.presentationAlpha=opacity;
  let material=p.userData.surface.material,transparent=opacity<.995;if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
  material.opacity=opacity;material.depthWrite=!transparent;material.forceSinglePass=true;
  let outlineMaterial=p.userData.outline.material;outlineMaterial.opacity=ghost?opacity*.55:opacity;let outlineTransparent=ghost||opacity<.995;if(outlineMaterial.transparent!==outlineTransparent){outlineMaterial.transparent=outlineTransparent;outlineMaterial.needsUpdate=true;}
  p.userData.lines.material.opacity=.78*opacity;
  for(let child of p.children)child.material.userData.fade.value=p.userData.fade;
 }
}
// This selectable overlay is not part of the FE geometry, case catalogue or temperature data.
let tim2Overlay=null,tim2Source=null,tim2Fade=0;
function updateTim2(s,alpha){
 if(!active||active.userData.caseId!==(expanded||s.caseId)){if(tim2Overlay)tim2Overlay.visible=false;return;}
 if(active!==tim2Source){
  dispose(tim2Overlay);tim2Overlay=null;tim2Source=active;
  let lid=active.children.find(p=>p.userData.layer==='lid'),sink=active.children.find(p=>p.userData.layer==='sink');
  if(!lid||!sink)return;
  let a=lid.userData.nativeGeometry.boundingBox,b=sink.userData.nativeGeometry.boundingBox;
  let x0=Math.max(a.min.x,b.min.x),x1=Math.min(a.max.x,b.max.x),z0=Math.max(a.min.z,b.min.z),z1=Math.min(a.max.z,b.max.z),y=(a.max.y+b.min.y)/2;
  if(x1<=x0||z1<=z0)return;
  let geometry=new B.Geometry();geometry.setAttribute('position',new B.Attribute(new Float32Array([x0,y,z0,x1,y,z0,x1,y,z1,x0,y,z1]),3));geometry.setIndex([0,2,1,0,3,2]);
  let fill=new B.Color('#a7b8c2').lerp(new B.Color('#ffffff'),.16),edge=new B.Color('#a7b8c2').multiplyScalar(.45);
  let surface=new B.Mesh(geometry,presentationMaterial(new B.Basic({color:fill,side:B.DoubleSide,transparent:true,opacity:.9,depthWrite:false,toneMapped:false})));
  surface.userData.interfaceLayer='tim2';
  let perimeter=new B.Geometry();perimeter.setAttribute('position',geometry.attributes.position);perimeter.setIndex([0,1,1,2,2,3,3,0]);
  tim2Overlay=new B.Group();tim2Overlay.add(surface,new B.Lines(perimeter,presentationMaterial(new B.LineMaterial({color:edge,depthWrite:false,toneMapped:false}))));tim2Overlay.userData={surface,center:y,schematic:true};root.add(tim2Overlay);tim2Fade=0;
 }
 if(!tim2Overlay)return;
 let target=s.mode==='geometry'&&s.view!=='m1-study'&&s.view!=='mesh-study'&&(s.view==='assembly'||s.layer==='tim2')?1:0;
 tim2Fade+=(target-tim2Fade)*alpha;if(Math.abs(target-tim2Fade)<.005)tim2Fade=target;
 tim2Overlay.visible=s.mode==='geometry'&&tim2Fade>0;
 for(let child of tim2Overlay.children)child.material.userData.fade.value=tim2Fade;let ghost=s.layer!=='all'&&s.layer!=='tim2'&&(s.layout==='focused'||s.view!=='assembly');tim2Overlay.userData.surface.material.opacity=ghost?.16:.9;let line=tim2Overlay.children[1].material;if(line.transparent!==ghost){line.transparent=ghost;line.needsUpdate=true;}line.opacity=ghost?.25:1;
 let position=new B.Vector(),scale=new B.Vector(1,1,1),old=B.layers.get('tim2');
 if(s.view==='assembly'&&(s.layout==='closed'||s.layout==='exploded')){
  if(s.layout==='exploded')position.y=((explodedAnchors.lid-closedAnchors.lid)+(explodedAnchors.sink-closedAnchors.sink))/2;
 }else if(old){let d=old.userData;scale.set(d.targetScale??1,1,d.targetScale??1);position.set(d.targetX??0,focusY(active,s,'tim2',d.targetY??0)-tim2Overlay.userData.center,-(d.targetZ??0));}
 tim2Overlay.position.lerp(position,alpha);tim2Overlay.scale.lerp(scale,alpha);
}
let contextFitKey='';
let previousFrame=performance.now();
window.pm3NativeFrame=()=>{
 let now=performance.now(),alpha=reducedMotion.matches?1:1-Math.exp(-Math.min(now-previousFrame,250)/110);previousFrame=now;
 let s=B.state();if(s.view!=='mesh-study'&&expanded){expanded=null;gridGeneration++;}
 let study=s.view==='mesh-study'&&!expanded;grid.hidden=!study;$('#native-grid-back').hidden=!expanded;controls.hidden=s.view==='m1-study';status.hidden=study||s.view==='m1-study';
 if(s.view==='m1-study'){root.visible=false;B.original.visible=true;return;}
 if(study){let legend=grid.querySelector('.native-grid-legend');if(!legend){legend=document.createElement('div');legend.className='native-grid-legend';legend.innerHTML='<div class=temperature-gradient></div><small>74.75 °C · 80 °C yellow · 90 °C orange · 104.80 °C dark red</small>';grid.querySelector('header').append(legend);}legend.hidden=s.mode!=='temperature';root.visible=false;B.original.visible=false;let k=s.mode+'|'+$('#native-grid-part').value+'|'+$('#native-cavity').checked;if(k!==gridKey&&!previewsRunning){gridKey=k;renderGrid(s.mode,$('#native-grid-part').value);}return;}
 B.original.visible=false;root.visible=true;
 let scope=(s.view==='assembly'&&!expanded)?'all':expanded?$('#native-grid-part').value:'all';
 if(scope==='tim2'||(s.view!=='assembly'&&s.layer==='tim2')){if(!active||active.userData.caseId!==s.caseId){let contactKey=s.caseId+'|all|null';if(contactKey!==loadingKey&&contactKey!==errorKey)loadMain(s.caseId,'all',null,contactKey);status.textContent='Loading TIM2 contact-plane reference…';return;}if(active)active.visible=false;updateTim2(s,alpha);status.textContent=s.mode==='geometry'?'TIM2 · selectable schematic contact plane · no standalone solid FE body.':'TIM2 has no standalone FE mesh or nodal temperature field. Select Geometry to view its schematic contact plane.';status.dataset.state='interface';return;}
 let id=expanded||s.caseId,patch=s.view==='patch-solo'?s.patchBounds:null,key=[id,scope,JSON.stringify(patch)].join('|');
 if(loadingKey&&loadingKey!==key){generation++;loadingKey='';}
 if(key!==loadedKey&&key!==loadingKey&&key!==errorKey)loadMain(id,scope,patch,key);
 if(active){active.visible=loadedKey===key;if(active.visible&&!loadingKey&&(status.dataset.caseId!==id||status.dataset.state!=='ready')){let rec=active.userData.snapshot;status.textContent=id+' · '+rec.native_mesh_nodes.toLocaleString()+' nodes · '+rec.native_volume_elements.toLocaleString()+' volume elements';status.dataset.state='ready';status.dataset.caseId=id;}let ms=s.mode+'|'+$('#native-pore').checked+'|'+$('#native-cavity').checked;if(ms!==lastState){mode(active,s.mode);lastState=ms;}if(expanded){for(let p of active.children){p.visible=p.userData.allowed;for(let c of p.children)c.material.userData.fade.value=1;p.position.set(0,-active.userData.anchors[p.userData.layer],0);p.scale.set(1,1,1);}if(scope==='all')previewLayout(active,'all');}else layout(active,s,alpha);}
 updateTim2(s,alpha);
 const fitKey=s.view==='assembly'&&s.layout==='focused'?[s.caseId,s.layer,Math.round(B.canvas.clientWidth),Math.round(B.canvas.clientHeight)].join('|'):'';
 if(fitKey&&fitKey!==contextFitKey&&active?.visible){let bounds=new B.Box();for(let p of active.children){if(!p.userData.allowed)continue;let box=p.userData.nativeGeometry.boundingBox,scale=p.userData.targetDisplayScale,position=p.userData.targetPosition;for(let x of [box.min.x,box.max.x])for(let y of [box.min.y,box.max.y])for(let z of [box.min.z,box.max.z])bounds.expandByPoint(new B.Vector(x,y,z).multiply(scale).add(position));}B.fitBounds(bounds);contextFitKey=fitKey;}else if(!fitKey)contextFitKey='';
 if(s.mode==='temperature'){$('#field-view-title').textContent='NATIVE NODAL TEMPERATURE · °C';$('#field-view-note').textContent=id+' · paired surface-node values · fixed scale; 80 °C enters warm yellow';}
 if(s.mode==='mesh'){$('#field-view-title').textContent='ACTUAL FE BOUNDARY MESH';$('#field-view-note').textContent=id+' · original face perimeters, including midside nodes; no graphics diagonals';}
};
function previewLayout(g,scope){
 const order=['bt','bumps','uf','si','tim1','seal','lid','sink'],centers={};let cursor=0;
 for(let layer of order){let b=g.userData.layerBounds[layer];if(!b)continue;let height=b.max-b.min;centers[layer]=cursor+height/2;cursor+=height+.16;}
 for(let p of g.children){let layer=p.userData.layer;p.visible=p.userData.allowed;
  let y=-g.userData.anchors[layer];
  if(scope==='all')y=layer==='cavity'?centers.lid-g.userData.anchors.lid:centers[layer]-g.userData.anchors[layer];
  p.position.set(0,y,0);
 }
}
async function renderGrid(render,scope){previewsRunning=true;let token=++gridGeneration,box=$('.native-nine');box.replaceChildren();const ids=['0p0_M0','10p0_F_M2','10p0_F_M3'].flatMap(x=>['coarse','medium','fine'].map(l=>x+'__'+l));for(let id of ids){let c=C.cases.find(c=>c.case_id===id),card=document.createElement('div');card.tabIndex=0;card.setAttribute('role','group');card.className='native-card';card.dataset.caseId=id;card.innerHTML='<strong>'+id.replace('__',' · ')+'</strong><div class="native-preview">Loading native mesh…</div><small>'+c.native_volume_elements.toLocaleString()+' elements · Si peak '+c.native_Si_peak_C.toFixed(4)+' °C</small>';card.onkeydown=e=>{if(e.target===card&&e.key==='Enter')card.onclick()};card.onclick=()=>{expanded=id;generation++;loadingKey='';loadedKey='';refresh();B.centerCamera(scope==='all'?12:7);};box.append(card);}
 let renderer;
 try{renderer=new B.Renderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});renderer.setSize(600,340);renderer.outputColorSpace=B.SRGB;let scene=new B.Scene(),camera=new B.Camera(34,600/340,.01,200);
 for(let id of ids){if(token!==gridGeneration)break;let rec=await snapshot(id),g=await build(rec,scope);if(token!==gridGeneration){dispose(g);break;}mode(g,render);previewLayout(g,scope);scene.add(g);let bounds=new B.Box().setFromObject(g),center=new B.Vector(),size=new B.Vector();bounds.getCenter(center);bounds.getSize(size);let distance=Math.max(size.x,size.y*1.65,size.z,1)*1.05;camera.position.set(center.x+distance*.65,center.y+distance*.95,center.z+distance);camera.lookAt(center);renderer.render(scene,camera);let img=document.createElement('img');img.src=renderer.domElement.toDataURL('image/png');img.alt=id+' native '+scope+' '+render;box.querySelector('[data-case-id="'+id+'"] .native-preview').replaceChildren(img);dispose(g);trimChunks();await new Promise(r=>setTimeout(r,15));}
 }catch(e){console.error(e);let slot=box.querySelector('.native-preview:not(:has(img))');if(slot)slot.textContent='Could not load native data: '+e.message;gridKey='error';}finally{renderer?.dispose();renderer?.forceContextLoss();previewsRunning=false;}
}
let pointerStart=null;B.canvas.addEventListener('pointerdown',e=>{pointerStart=[e.clientX,e.clientY]});B.canvas.addEventListener('pointerup',e=>{if(!active||!root.visible||!pointerStart||Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>5)return;let r=B.canvas.getBoundingClientRect(),ray=new B.Raycaster();ray.setFromCamera(new B.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),B.camera);let surfaces=active.visible?active.children.filter(p=>p.visible&&p.userData.fade>.5).map(p=>p.userData.surface):[];if(tim2Overlay?.visible&&tim2Fade>.5)surfaces.push(tim2Overlay.userData.surface);let current=B.state(),hits=ray.intersectObjects(surfaces,false),hit=(current.view==='assembly'&&current.layer!=='all'?hits.find(h=>(h.object.userData.interfaceLayer||partLayer[h.object.userData.nativePart])===current.layer):null)||hits[0];if(!hit)return;if(hit.object.userData.interfaceLayer==='tim2'){B.selectLayer('tim2');return;}let id=hit.object.userData.nativePart,layer=partLayer[id],s=B.state();if(s.view==='mesh-study')return;if(layer==='tim1'&&s.layer==='tim1'&&s.patchBounds){let point=hit.object.parent.worldToLocal(hit.point.clone()),x=point.x*5,y=-point.z*5,b=s.patchBounds;if(x>=b[0]&&x<=b[1]&&y>=b[2]&&y<=b[3]){B.isolatePatch();return;}}if(layer&&layer!=='cavity')B.selectLayer(layer);},true);
const style=document.createElement('style');style.textContent=`.native-status{position:absolute;top:10px;left:14px;right:14px;z-index:4;font:10px monospace;color:#31576b;pointer-events:none}.native-status[data-state=error]{color:#b63828}.native-controls{position:absolute;right:12px;bottom:69px;z-index:6;display:flex;gap:9px;align-items:center;font-size:10px;background:#fffffff0;padding:8px;border-radius:7px;flex-wrap:wrap}.native-controls label{display:flex;align-items:center;gap:3px}.native-controls button,.native-grid-panel button,.native-grid-panel select{font:inherit;border:1px solid #bdcfd8;border-radius:5px;padding:5px;background:#fff;color:#234657}.native-grid-panel{position:absolute;inset:0;z-index:5;background:#edf2f5;padding:12px 12px 125px;overflow:auto}.native-grid-panel[hidden],.native-controls[hidden]{display:none!important}.native-grid-panel header{display:grid;gap:8px;padding-bottom:12px;font-size:12px}.native-grid-panel header>div{display:flex;gap:8px;align-items:center}.native-grid-legend{max-width:400px;padding:5px 0}.native-grid-legend[hidden]{display:none}.native-grid-panel small{font-size:10px;line-height:1.5;color:#537082}.native-nine{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.native-grid-panel .native-card{padding:8px;overflow:hidden;text-align:left;box-shadow:0 2px 8px #173b4c0c}.native-card strong{font:10px monospace;display:block}.native-preview{aspect-ratio:600/340;display:flex;align-items:center;justify-content:center;font-size:10px}.native-preview img{width:100%;height:100%;object-fit:contain}.native-card small{display:block;font-size:9px}.native-card:hover{border-color:#287c9b;background:#f8fcff}.temperature-gradient{background:linear-gradient(90deg,#183f9a 0%,#147fce 7.49%,#1bc6bc 14.14%,#ffe548 17.47%,#ffb122 34.11%,#fa651b 57.40%,#db221e 84.03%,#970e32 100%)!important}.temperature-scale{position:relative;padding-top:4px}.temperature-scale:after{content:'80 °C → warm';position:absolute;top:-22px;left:17.47%;font-size:9px;color:#725321;background:#ffffffd9;padding:0 2px}@media(max-width:700px){.native-nine{gap:4px}.native-grid-panel{padding:8px 6px 130px}.native-card strong{font-size:8px}.native-card small{font-size:8px}.native-controls{bottom:68px;max-width:230px}.native-grid-panel header>div{flex-wrap:wrap}}`;
document.head.append(style);
window.PM3NativeTest={catalog:C,record,snapshot,build,color,refresh,addFeatureFace,featureIndices,get tim2(){return tim2Overlay},get active(){return active},get loadedKey(){return loadedKey},get gridReady(){return !previewsRunning},get expanded(){return expanded}};
})();
