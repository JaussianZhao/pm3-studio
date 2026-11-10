const fs=require('node:fs');
const path=require('node:path');
const {inflateSync}=require('node:zlib');

const native=path.resolve(__dirname,'../assets/native');
const output=path.join(native,'sensitivity-data');
const chunks=new Map();
global.window=global;
global.PM3_NATIVE_CHUNK=(name,data)=>chunks.set(name,data);
require(path.join(native,'catalog.js'));
const catalog=global.PM3_NATIVE_CATALOG;
function record(id){
 const name=catalog.index[id];
 if(!chunks.has(name))require(path.join(native,name));
 const value=chunks.get(name)[id];
 if(!value)throw Error('Missing native record '+id);
 return value;
}

fs.mkdirSync(output,{recursive:true});
const manifest={};
for(const {case_id:id} of catalog.cases){
 if(!/__(coarse|medium|fine)$/.test(id))continue;
 const source=record(id),snapshot=JSON.parse(inflateSync(Buffer.from(source.data,'base64')));
 const ids=new Set([id]);
 for(const body of snapshot.bodies){
  if(body.part!==6&&body.part!==7)continue;
  ids.add(body.mesh);
  ids.add(body.temperatures);
 }
 const name='sensitivity-data/'+id+'.js';
 const data=Object.fromEntries([...ids].map(key=>[key,record(key)]));
 const content='window.PM3_NATIVE_CHUNK('+JSON.stringify(name)+','+JSON.stringify(data)+');\n';
 fs.writeFileSync(path.join(native,name),content);
 const files=new Set([...ids].map(key=>catalog.index[key]));
 manifest[id]={bytes:Buffer.byteLength(content),chunks:Object.fromEntries([...files].map(file=>[file,fs.statSync(path.join(native,file)).size]))};
}


fs.writeFileSync(path.join(output,'catalog.js'),'window.PM3_SENSITIVITY_DATA='+JSON.stringify(manifest)+';\n');
