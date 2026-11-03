"""Export retained three-layer reference geometry and prescribed hot nodal fields; no solve.
Run: E:/Python/venvs/nature-skill/Scripts/python.exe scripts/export_thermomechanical.py
"""
from pathlib import Path
from collections import defaultdict,Counter
import sys,json,hashlib,struct,zlib,base64,zipfile,csv,io
import numpy as np
REPO=Path(__file__).resolve().parents[1]; WORK=REPO.parent; OUT=REPO/'assets/thermomechanical'
sys.path.insert(0,str(WORK/'tmp/pm3_0p5_A_AD_review'))
from fe_math import FACES
PAIRS=[('1p0','A'),('1p0','L'),('10p0','A'),('10p0','F')]
records={}; owners=defaultdict(set); cases=[]; reports=[]
def sha(raw):return hashlib.sha256(raw).hexdigest()
def add(raw,case):
 key=sha(raw); records[key]={'data':base64.b64encode(zlib.compress(raw,9)).decode()};owners[key].add(case);return key
for level,placement in PAIRS:
 folder=WORK/'tmp/review_pm3_interface_returned'/f'{level}pm3+3_thermomechanical_20261102_out_{placement}_M3_interfacefix_48core'
 if (level,placement)==('1p0','A'):folder=WORK/'tmp/review_pm3_interface_1514536'
 review=json.loads((folder/'independent_review.json').read_text(encoding='utf-8'));archive=Path(review['archive'])
 with zipfile.ZipFile(archive) as z:
  for role in ['M0matched','M3']:
   source_id=f'{level}_{placement}_{role}_TM'; cid='TM_'+source_id; source=folder/source_id
   meshraw=(source/'mesh_connectivity.json').read_bytes(); mesh=json.loads(meshraw); params=json.loads((source/'parameters.json').read_text())
   nodes={int(k):np.array(v) for k,v in mesh['nodes'].items()};ids=np.loadtxt(source/'temperature_nodes.txt',dtype=np.int64);temps=np.loadtxt(source/'temperature_hot.txt')
   assert len(ids)==len(set(ids))==len(temps)==len(nodes)==params['nodes'];assert set(ids)==set(nodes);assert np.isfinite(temps).all()
   temperatures=dict(zip(ids,temps));member=next(n for n in z.namelist() if f'/results/{source_id}/run_' in n and n.endswith('/prescribed_temperatures_hot.csv') and '/native_smoke/' not in n)
   raw=z.read(member);applied={int(r['node']):float(r['temperature_C']) for r in csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))}
   assert set(applied)==set(nodes);assert max(abs(applied[n]-temperatures[n]) for n in nodes)<1e-10
   bodies=[]; bymat=defaultdict(list)
   for e in mesh['elements']:bymat[e['mat']].append(e)
   for mat,elements in sorted(bymat.items()):
    part=10 if mat==2 else 4 if 5<=mat<=65 else 6 if 70<=mat<=309 else None
    assert part,(source_id,mat)
    faces={};counts=Counter()
    for e in elements:
     en=e['nodes'];kind={10:'tet',20:'hex',8:'hex'}[len(en)]
     for face in FACES[kind]:
      f=face[:4] if len(en)==8 else face; corner_count=3 if len(f)==6 else 4
      f=[en[i] for i in f];key=tuple(sorted(f[:corner_count]));counts[key]+=1;faces[key]=f
    boundary=[]
    for key,f in faces.items():
     assert counts[key]<=2,(source_id,mat,key)
     if counts[key]!=1:continue
     corners=3 if len(f)==6 else 4;xyz=np.array([nodes[n] for n in f[:corners]])
     normal=sum((np.cross(a,b) for a,b in zip(xyz,np.roll(xyz,-1,axis=0))),np.zeros(3))
     if np.linalg.norm(normal)<1e-12:continue
     if len(f)>4:f=[v for pair in zip(f[:corners],f[corners:]) for v in pair]
     boundary.append(f)
    used=sorted({n for f in boundary for n in f});lookup={n:i for i,n in enumerate(used)}
    xyz=np.array([nodes[n] for n in used]);q=np.rint(xyz*1e6).astype(np.int32);origin=q.min(axis=0);q=q-origin
    offsets=np.cumsum([0]+[len(f) for f in boundary],dtype=np.uint32);indices=np.array([lookup[n] for f in boundary for n in f],dtype=np.uint32)
    meshbytes=b'EPTCMSH1'+struct.pack('<III',len(used),len(boundary),len(indices))+q.astype('<i4').tobytes()+offsets.astype('<u4').tobytes()+indices.astype('<u4').tobytes()
    t=np.rint([temperatures[n]*1000 for n in used]).astype(np.int32);delta=np.diff(np.r_[np.int32(0),t]).astype('<i4')
    tempbytes=b'EPTCTMP2'+struct.pack('<I',len(used))+delta.tobytes()
    bodies.append({'name':f'{ {4:"Silicon",6:"TIM1",10:"Copper_lid"}[part]}_material_{mat}','part':part,'material_id':mat,'mesh':add(meshbytes,cid),'temperatures':add(tempbytes,cid),'origin_q':origin.tolist(),'surface_vertices':len(used),'surface_faces':len(boundary),'volume_elements':len(elements)})
   assert sum(b['volume_elements'] for b in bodies)==len(mesh['elements'])==params['solid_elements']
   summary=review['states'][source_id]['summary'];rec={'case_id':cid,'bodies':bodies,'native_mesh_nodes':len(nodes),'native_volume_elements':len(mesh['elements']),'meshed_bodies':len(bodies),'body_surface_vertices':sum(b['surface_vertices'] for b in bodies),'body_boundary_faces':sum(b['surface_faces'] for b in bodies)}
   records[cid]={'data':base64.b64encode(zlib.compress(json.dumps(rec,separators=(',',':')).encode(),9)).decode()};owners[cid].add(cid)
   info={'case_id':cid,'source_case':source_id,'pair':f'{level}_{placement}','role':role,'label':f'{level.replace("p",".")}% {placement} · '+('matched M0' if role=='M0matched' else 'M3'),'nodes':len(nodes),'elements':len(mesh['elements']),'material_regions':len(bodies),'temperature_range_C':[float(min(temps)),float(max(temps))],'thermal_source':params['thermal_source'],'job':str(review['job']),'source_archive':archive.name,'mesh_sha256':sha(meshraw),'applied_temperature_sha256':sha(raw),'applied_temperature_member':member,'tim1_hot_stress_MPa':summary['groups']['TIM1']['hot']}
   cases.append(info);reports.append({'case_id':cid,'temperature_nodes_verified':len(nodes),'surface_vertices':rec['body_surface_vertices'],'surface_faces':rec['body_boundary_faces'],'max_coordinate_rounding_mm':.0000005,'max_temperature_rounding_C':.0005,'mesh_sha256':sha(meshraw),'applied_temperature_sha256':sha(raw)})
   print(cid,len(nodes),len(mesh['elements']),rec['body_boundary_faces'],flush=True)
common={k:v for k,v in records.items() if len(owners[k])>1};files={'common.js':common}
for case in cases:
 name=case['case_id']+'.js';case['file']=name;files[name]={k:v for k,v in records.items() if owners[k]=={case['case_id']}}
for name,data in files.items():
 key='../thermomechanical/'+name;index={k:key for k in data}
 (OUT/name).write_text('Object.assign(window.PM3_NATIVE_CATALOG.index,'+json.dumps(index,separators=(',',':'))+');window.PM3_NATIVE_CHUNK('+json.dumps(key)+','+json.dumps(data,separators=(',',':'))+');\n',encoding='utf-8')
catalog={'cases':cases,'pairs':[f'{l}_{p}' for l,p in PAIRS],'temperature_scale_C':[74.75,104.8],'geometry':'Undeformed native three-layer Si / TIM1 / copper-lid reference meshes.','temperature_definition':'Prescribed hot nodal field applied to the structural model; original full-PM3 temperatures transferred by phase. Not an independent three-layer thermal solve.','load_N':{'lid':249.995755786,'silicon_path':191.845411353,'skirt_path':58.150345960},'reference_temperature_C':25,'limits':'One-way thermal-to-structural transfer, elastic materials and retained surrounding load allocation. Each M3 has its own matched M0.'}
(OUT/'catalog.js').write_text('window.PM3_TM_CATALOG='+json.dumps(catalog,separators=(',',':'))+';\n',encoding='utf-8')
(OUT/'provenance.json').write_text(json.dumps({'states':reports,'source':'Retained interface-corrected native connectivity and archived prescribed_temperatures_hot.csv','exporter':'scripts/export_thermomechanical.py','checks':'All structural node IDs and applied temperatures matched, native solid element counts checked; no solve, remeshing or spatial temperature estimation.'},indent=2),encoding='utf-8')
print('EXPORTED',len(cases),'states',sum(p.stat().st_size for p in OUT.iterdir()),'bytes')
