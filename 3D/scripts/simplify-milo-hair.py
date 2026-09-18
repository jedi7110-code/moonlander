"""Blender background: simplify fitted hair cards without replacing their UVs.
blender -b --factory-startup --python scripts/simplify-milo-hair.py -- input.json output.json 0.5
"""
import bpy
import json
import sys
from pathlib import Path

source, target, ratio = sys.argv[sys.argv.index('--') + 1:]
data = json.loads(Path(source).read_text())
attributes = data['data']['attributes']
positions = attributes['position']['array']
uvs = attributes['uv']['array']
normals = attributes['normal']['array']
indices = data['data']['index']['array']
# Weld position duplicates but preserve per-corner UVs and shading normals.
vertices, remap, unique = [], [], {}
for i in range(0, len(positions), 3):
    point = tuple(positions[i:i + 3])
    key = tuple(round(v, 5) for v in point)
    if key not in unique:
        unique[key] = len(vertices)
        vertices.append(point)
    remap.append(unique[key])
faces = [tuple(remap[i] for i in indices[j:j + 3]) for j in range(0, len(indices), 3)]
mesh = bpy.data.meshes.new('Fitted hair cards')
mesh.from_pydata(vertices, [], faces)
mesh.update()
uv_layer = mesh.uv_layers.new(name='UVMap')
for loop, original in zip(mesh.loops, indices):
    uv_layer.data[loop.index].uv = uvs[original * 2:original * 2 + 2]
for polygon in mesh.polygons:
    polygon.use_smooth = True
mesh.normals_split_custom_set([normals[i * 3:i * 3 + 3] for i in indices])
obj = bpy.data.objects.new('Hair', mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
modifier = obj.modifiers.new('Half density hair cards', 'DECIMATE')
modifier.decimate_type = 'COLLAPSE'
modifier.ratio = float(ratio)
modifier.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=modifier.name)
mesh = obj.data
mesh.calc_loop_triangles()
uv_layer = mesh.uv_layers.active
out = {'position': [], 'normal': [], 'uv': []}
new_indices, unique = [], {}
for triangle in mesh.loop_triangles:
    for loop_index in triangle.loops:
        vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
        p = tuple(vertex.co)
        n = tuple(mesh.corner_normals[loop_index].vector)
        uv = tuple(uv_layer.data[loop_index].uv)
        key = tuple(round(v, 7) for v in p + n + uv)
        if key not in unique:
            unique[key] = len(out['position']) // 3
            out['position'].extend(p)
            out['normal'].extend(n)
            out['uv'].extend(uv)
        new_indices.append(unique[key])
for name, values in out.items():
    attributes[name]['array'] = values
data['data']['index'] = {'type': 'Uint32Array', 'array': new_indices}
data['data'].pop('boundingSphere', None)
Path(target).write_text(json.dumps(data, separators=(',', ':')))
print(f'Hair triangles: {len(indices)//3} -> {len(new_indices)//3}; vertices: {len(out["position"])//3}')
