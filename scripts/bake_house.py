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
for node in scene.graph.nodes_geometry:
    transform,geo=scene.graph[node]
    mesh=scene.geometry[geo].copy();mesh.apply_transform(transform)
    triangles.extend(mesh.triangles*SCALE+OFFSET)
triangles=np.array(triangles)
heights=defaultdict(list); obstacles=defaultdict(list)
for tri in triangles:
    normal=np.cross(tri[1]-tri[0],tri[2]-tri[0]); length=np.linalg.norm(normal)
    if length<1e-8:continue
    normal/=length
    flat=tri[:,[0,2]]
    mn=flat.min(axis=0);mx=flat.max(axis=0)
    if abs(normal[1])>.7:
        # Rasterize both windings: this model contains double-sided floors.
        a,b,c=flat;den=np.cross(b-a,c-a)
        if abs(den)<1e-8:continue
        for ix in range(int(np.floor(mn[0]/CELL)),int(np.ceil(mx[0]/CELL))+1):
            for iz in range(int(np.floor(mn[1]/CELL)),int(np.ceil(mx[1]/CELL))+1):
                p=np.array([(ix+.5)*CELL,(iz+.5)*CELL]);v=p-a
                u=np.cross(v,c-a)/den;w=np.cross(b-a,v)/den
                if u>=-1e-5 and w>=-1e-5 and u+w<=1.00001:
                    h=tri[0,1]+u*(tri[1,1]-tri[0,1])+w*(tri[2,1]-tri[0,1])
                    heights[(ix,iz)].append(float(h))
    else:
        # Capsule clearance from structural faces, not visual bounding boxes.
        for ix in range(int(np.floor((mn[0]-RADIUS)/CELL)),int(np.ceil((mx[0]+RADIUS)/CELL))+1):
            for iz in range(int(np.floor((mn[1]-RADIUS)/CELL)),int(np.ceil((mx[1]+RADIUS)/CELL))+1):
                p=np.array([(ix+.5)*CELL,(iz+.5)*CELL]);closest=1e9
                for a,b in zip(flat,np.roll(flat,-1,axis=0)):
                    d=b-a;t=np.clip(np.dot(p-a,d)/max(np.dot(d,d),1e-10),0,1)
                    closest=min(closest,np.linalg.norm(p-(a+t*d)))
                if closest<RADIUS:obstacles[(ix,iz)].append((float(tri[:,1].min()),float(tri[:,1].max())))

points=[];cells=defaultdict(list)
for (ix,iz),hh in sorted(heights.items()):
    unique=[]
    for h in sorted(hh):
        if not unique or h-unique[-1]>.07:unique.append(h)
        else:unique[-1]=max(unique[-1],h)
    for i,h in enumerate(unique):
        if h>4.6:continue
        if h>4.3 and not (7.3<(ix+.5)*CELL<10.2 and 9.9<(iz+.5)*CELL<11):continue
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
placements={'spawns':[near(15,15),near(15.7,15),near(14.3,15)],'ghost':near(24,5),'keys':[near(4,7),near(15,5),near(24,7),top,near(24,17)],'batteries':[near(15,14),near(8,12),near(24,5),near(4,15),top,near(22,19)],'exit':near(15,21),'patrol':[near(4,7),near(15,5),near(24,7),top,near(24,17),near(15,15)]}
out={'cell':CELL,'radius':RADIUS,'maxStep':MAX_STEP,'clearance':CLEARANCE,'scale':SCALE,'offset':OFFSET.tolist(),'points':pts,'links':edges,'placements':placements}
Path('src/lib/house-nav.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
print('top',pts[top],'spawns',[pts[i] for i in placements['spawns']])
