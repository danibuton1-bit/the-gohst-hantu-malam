"""Bake walkable surfaces from the uploaded GLB. Requires numpy + trimesh.
Run: python3 scripts/bake_house.py /path/to/haunted_house.glb
Coordinates and heights are in metres; rendering uses the same transform.
"""
import sys,json
from collections import defaultdict,deque
from pathlib import Path
import numpy as np
import trimesh

SCALE=.32
OFFSET=np.array([15.,0.,21.])
CELL=.2
RADIUS=.22
MAX_STEP=.29
CLEARANCE=1.65
scene=trimesh.load(sys.argv[1],force='scene',process=False)
triangles=[]
parts=[]
for node in scene.graph.nodes_geometry:
    transform,geo=scene.graph[node]
    mesh=scene.geometry[geo].copy();mesh.apply_transform(transform)
    world=mesh.triangles*SCALE+OFFSET
    parts.append((geo,world))
    triangles.extend(world)
# Preserve the uploaded geometry; the source contains stairs but no upper floor.
# Extend the same footprint and wall meshes, and leave the stairwell open.
raw=Path(sys.argv[1]).read_bytes()
import struct
model=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
assert all(len(m['primitives'])==1 for m in model['meshes'])
assert len(scene.geometry)==len(model['meshes'])
mesh_ids={name:i for i,name in enumerate(scene.geometry)}
doors=[];structure=[];kept=[]
UPPER=4.535
RISE=3.779
BOUNDS=[1.52,.969,28.48,18.858]
HOLE=[7.504,10.65,10.15,15.709]
for name,tris in parts:
    bounds=np.array([tris.min(axis=(0,1)),tris.max(axis=(0,1))])
    size=bounds[1]-bounds[0]
    mesh_id=mesh_ids[name]
    if 2.4<size[1]<2.7 and min(size[[0,2]])<.1:
        v=bool(size[0]<size[2]);center=(bounds[0]+bounds[1])/2
        for h in [.756,UPPER]:
            doors.append({'mesh':mesh_id,'x':round(center[0]*50,3),'y':round(center[2]*50,3),'h':h,'v':v,'width':round(max(size[0],size[2])*50,3),'height':round(size[1],3),'thickness':round(min(size[0],size[2])*50,3)})
        continue # Door panels are dynamic, not permanent obstacles.
    kept.extend(tris)
    if size[1]>3.7 and min(size[[0,2]])<.25:
        # Both visible and invisible wall faces retain their openings.
        structure.append(mesh_id)
        upper=tris.copy();upper[:,:,1]+=RISE
        kept.extend(upper)
def floor(x0,z0,x1,z1,h):
    a=[x0,h,z0];b=[x1,h,z0];c=[x1,h,z1];d=[x0,h,z1]
    return [np.array([a,b,c]),np.array([a,c,d])]
x0,z0,x1,z1=BOUNDS;hx0,hz0,hx1,hz1=HOLE
floor_rects=[[x0,z0,x1,hz0],[x0,hz1,x1,z1],[x0,hz0,hx0,hz1],[hx1,hz0,x1,hz1]]
for rect in floor_rects:kept.extend(floor(*rect,UPPER))
# Guard the upper stair opening on three sides, keeping the top landing open.
rails=[[hx0,hz0,hx0,hz1],[hx1,hz0,hx1,hz1],[hx0,hz1,hx1,hz1]]
for ax,az,bx,bz in rails:
    a=[ax,UPPER,az];b=[bx,UPPER,bz];c=[bx,UPPER+1.05,bz];d=[ax,UPPER+1.05,az]
    kept.extend([np.array([a,b,c]),np.array([a,c,d])])
triangles=np.array(kept)
extension={'upper':UPPER,'rise':RISE,'bounds':BOUNDS,'hole':HOLE,'floors':floor_rects,'rails':rails,'structure':structure}
heights=defaultdict(list); obstacles=defaultdict(list)
for tri in triangles:
    normal=np.cross(tri[1]-tri[0],tri[2]-tri[0]); length=np.linalg.norm(normal)
    if length<1e-8:continue
    normal/=length
    flat=tri[:,[0,2]]
    mn=flat.min(axis=0);mx=flat.max(axis=0)
    flat_floor=abs(normal[1])>.7
    padding=0 if flat_floor else RADIUS
    xx,zz=np.meshgrid(np.arange(int(np.floor((mn[0]-padding)/CELL)),int(np.ceil((mx[0]+padding)/CELL))+1),np.arange(int(np.floor((mn[1]-padding)/CELL)),int(np.ceil((mx[1]+padding)/CELL))+1),indexing='ij')
    ids=np.column_stack([xx.ravel(),zz.ravel()]);samples=(ids+.5)*CELL
    if flat_floor:
        a,b,c=flat;ab=b-a;ac=c-a;den=ab[0]*ac[1]-ab[1]*ac[0]
        if abs(den)<1e-8:continue
        v=samples-a;u=(v[:,0]*ac[1]-v[:,1]*ac[0])/den;w=(ab[0]*v[:,1]-ab[1]*v[:,0])/den
        mask=(u>=-1e-5)&(w>=-1e-5)&(u+w<=1.00001)
        hh=tri[0,1]+u*(tri[1,1]-tri[0,1])+w*(tri[2,1]-tri[0,1])
        for key,h in zip(ids[mask],hh[mask]):heights[tuple(key)].append(float(h))
    else:
        closest=np.full(len(samples),np.inf)
        for a,b in zip(flat,np.roll(flat,-1,axis=0)):
            d=b-a;t=np.clip((samples-a)@d/max(d@d,1e-10),0,1)
            closest=np.minimum(closest,np.linalg.norm(samples-(a+t[:,None]*d),axis=1))
        span=(float(tri[:,1].min()),float(tri[:,1].max()))
        for key in ids[closest<RADIUS]:obstacles[tuple(key)].append(span)

points=[];cells=defaultdict(list)
for (ix,iz),hh in sorted(heights.items()):
    unique=[]
    for h in sorted(hh):
        if not unique or h-unique[-1]>.07:unique.append(h)
        else:unique[-1]=max(unique[-1],h)
    for i,h in enumerate(unique):
        if h>UPPER+.03:continue
        if i+1<len(unique) and unique[i+1]-h<CLEARANCE:continue
        if any(lo<h+CLEARANCE and hi>h+.31 for lo,hi in obstacles[(ix,iz)]):continue
        idx=len(points);points.append([round((ix+.5)*CELL,3),round((iz+.5)*CELL,3),round(h,3)])
        cells[(ix,iz)].append(idx)
links=[[] for _ in points]
for (ix,iz),ids in cells.items():
    for idx in ids:
        for dx,dz in [(1,0),(-1,0),(0,1),(0,-1)]:
            for nxt in cells.get((ix+dx,iz+dz),[]):
                if abs(points[idx][2]-points[nxt][2])<=MAX_STEP:links[idx].append(nxt)
# Keep the connected playable component; discard furniture tops and roof surfaces.
seed=min(range(len(points)),key=lambda i:(points[i][0]-15)**2+(points[i][1]-15)**2+100*(points[i][2]-.756)**2)
reachable={seed};q=deque([seed])
while q:
    for j in links[q.popleft()]:
        if j not in reachable:reachable.add(j);q.append(j)
old=sorted(reachable);remap={j:i for i,j in enumerate(old)}
pts=[points[j] for j in old];edges=[[remap[k] for k in links[j] if k in reachable] for j in old]
# Literal placement on reachable surfaces, including the stair landing.
def near(x,z,h=.756):return min(range(len(pts)),key=lambda i:(pts[i][0]-x)**2+(pts[i][1]-z)**2+25*(pts[i][2]-h)**2)
stair=[i for i,p in enumerate(pts) if 7.3<p[0]<10.2 and 10<p[1]<16 and p[2]>.95]
print('reachable',len(pts),'height range',min(p[2] for p in pts),max(p[2] for p in pts),'stairs',len(stair))
top=max((i for i,p in enumerate(pts) if 7.3<p[0]<10.2 and 9.9<p[1]<11),key=lambda i:pts[i][2])
placements={'spawns':[near(15,15),near(15.7,15),near(14.3,15)],'ghost':near(24,5),'keys':[near(4,7),near(15,5),near(24,7),near(4,7,UPPER),near(24,17,UPPER)],'batteries':[near(15,14),near(8,12),near(24,5),near(4,15),top,near(22,19)],'exit':near(15,21),'patrol':[near(4,7),near(15,5),near(24,7),top,near(24,17,UPPER),near(15,15)]}
out={'doors':doors,'extension':extension,'cell':CELL,'radius':RADIUS,'maxStep':MAX_STEP,'clearance':CLEARANCE,'scale':SCALE,'offset':OFFSET.tolist(),'points':pts,'links':edges,'placements':placements}
Path('src/lib/house-nav.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
print('top',pts[top],'spawns',[pts[i] for i in placements['spawns']])
