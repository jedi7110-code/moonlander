"""Extract the front-facing suit (including its detached boot) from the supplied OBJ."""
import bpy, bmesh, sys
from pathlib import Path
from mathutils import Vector

source, target = map(Path, sys.argv[sys.argv.index('--') + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=str(source))
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.separate(type='LOOSE')
bpy.ops.object.mode_set(mode='OBJECT')
parts=[]
for obj in bpy.context.scene.objects:
    if obj.type!='MESH': continue
    coords=[obj.matrix_world @ v.co for v in obj.data.vertices]
    if min(v.x for v in coords)>-.33 and max(v.x for v in coords)<-.02:
        parts.append(obj)
if len(parts)!=2:
    raise RuntimeError('Expected the front suit and its detached boot')
bpy.ops.object.select_all(action='DESELECT')
for obj in parts: obj.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.object.join()
obj=bpy.context.object;obj.name='Reference EVA suit'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
coords=[v.co for v in obj.data.vertices]
low=Vector([min(v[i] for v in coords) for i in range(3)])
high=Vector([max(v[i] for v in coords) for i in range(3)])
scale=2/(high.z-low.z)
centre=Vector(((high.x+low.x)/2,0,low.z))
for v in obj.data.vertices:
    v.co=(v.co-centre)*scale
    v.co.y-=.045
# Make material boundaries clean without changing the supplied silhouette.
source_normals={tuple(round(value,7) for value in obj.data.vertices[loop.vertex_index].co):tuple(obj.data.corner_normals[loop.index].vector) for loop in obj.data.loops}
bm=bmesh.new();bm.from_mesh(obj.data)
head_edges=[e for e in bm.edges if all(v.co.z>1.66 for v in e.verts)]
bmesh.ops.subdivide_edges(bm,edges=head_edges,cuts=3,use_grid_fill=True)
for height in [.055,.80,1.04]:
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(0,0,height),plane_no=(0,0,1))
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(obj.data);bm.free()
obj.data.update()
normals=[source_normals.get(tuple(round(value,7) for value in obj.data.vertices[loop.vertex_index].co),tuple(obj.data.corner_normals[loop.index].vector)) for loop in obj.data.loops]
obj.data.normals_split_custom_set(normals)
obj.data.materials.clear()
for name,color,roughness in [('Suit cloth',(.68,.70,.66,1),.85),('Helmet shell',(.78,.80,.76,1),.42),('Visor',(.015,.025,.022,1),.19),('Dark fittings',(.025,.032,.03,1),.75)]:
    material=bpy.data.materials.new(name);material.diffuse_color=color;material.use_nodes=True
    shader=material.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=color;shader.inputs['Roughness'].default_value=roughness
    obj.data.materials.append(material)
for polygon in obj.data.polygons:
    p=sum((obj.data.vertices[i].co for i in polygon.vertices),Vector())/len(polygon.vertices)
    x,y,h=p;front=-y
    material=0
    if h>1.66:material=1
    # Keep the actual mesh; these masks only assign the cabin's existing finishes.
    if h>1.70 and h<1.965 and front>.075 and (x/.117)**2+((h-1.835)/.145)**2<1:
        material=2
    if h<.055 or (.80<h<1.04 and abs(x)>.31):material=3
    polygon.material_index=material;polygon.use_smooth=True
target.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True)
print('Reference suit:',len(obj.data.vertices),'vertices,',len(obj.data.polygons),'faces')
