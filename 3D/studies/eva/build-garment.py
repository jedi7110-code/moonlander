import bpy, bmesh, json, sys, math
from pathlib import Path

args = sys.argv[sys.argv.index('--') + 1:]
source, target, blend = map(Path, args)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
parts = []
for index, part in enumerate(json.loads(source.read_text())['parts']):
    # Three.js Y-up to Blender Z-up, keeping the garment facing -Y.
    p = part['positions']
    vertices = [(p[i], -p[i+2], p[i+1]) for i in range(0, len(p), 3)]
    faces = [part['indices'][i:i+3] for i in range(0, len(part['indices']), 3)]
    mesh = bpy.data.meshes.new('Pressure cloth section')
    mesh.from_pydata(vertices, [], faces)
    bm = bmesh.new(); bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.00001)
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh); bm.free()
    obj = bpy.data.objects.new('Cloth %d' % index, mesh)
    bpy.context.collection.objects.link(obj); parts.append(obj)
for obj in parts: obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
garment = bpy.context.object; garment.name = 'EVA tailored garment'
remesh = garment.modifiers.new('Joined shoulder and hip seams', 'REMESH')
remesh.mode = 'VOXEL'; remesh.voxel_size = .0035; remesh.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth = garment.modifiers.new('Relax pressure cloth', 'SMOOTH')
smooth.factor = 1.1; smooth.iterations = 4
bpy.ops.object.modifier_apply(modifier=smooth.name)
decimate = garment.modifiers.new('Cabin display topology', 'DECIMATE')
decimate.ratio = .07
bpy.ops.object.modifier_apply(modifier=decimate.name)
for poly in garment.data.polygons: poly.use_smooth = True
# Pack nonoverlapping UV islands for the existing woven-cloth bump map.
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(70), island_margin=.015)
bpy.ops.object.mode_set(mode='OBJECT')
material = bpy.data.materials.new('Pressure cloth'); material.diffuse_color = (.67, .69, .64, 1)
garment.data.materials.append(material)
target.parent.mkdir(parents=True, exist_ok=True); blend.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True, export_materials='NONE')
print('Garment mesh:', len(garment.data.vertices), 'vertices,', len(garment.data.polygons), 'faces')
