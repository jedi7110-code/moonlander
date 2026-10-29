"""Bake cabin poses without rebuilding the approved surface or walk actions."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Quaternion, Vector

LOCAL = Path(__file__).resolve().parent / 'local'
parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, default=LOCAL / 'cabin')
sleep_options = parser.add_mutually_exclusive_group()
sleep_options.add_argument('--sleep-curl', action='store_true', help='Study-only curled sleeping pose')
sleep_options.add_argument('--sleep-side', action='store_true', help='Study-only relaxed side sleeping pose; viewer rolls the whole rig')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
args.out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(LOCAL / 'lucy-combined.blend'), load_ui=False, use_scripts=False)
arm = bpy.data.objects['Lucy_Blendkit_Rig']
skin = bpy.data.objects['Lucy_Free3D_Surface']
skin.shape_key_add(name='Basis')
blink = skin.shape_key_add(name='Blink')
eye_materials = {i for i, m in enumerate(skin.data.materials) if m.name in ['Hazel iris', 'Pupils and eye margin']}
eye_vertices = {v for p in skin.data.polygons if p.material_index in eye_materials for v in p.vertices}
for index in eye_vertices:
    point = blink.data[index].co
    point.z = .187 + (point.z - .187) * .06
arm.animation_data_clear()
walks = {'Idle', 'Walk', 'WalkLevel', 'WalkLow'}
for action in list(bpy.data.actions):
    if action.name not in walks:
        bpy.data.actions.remove(action)

def reset():
    for bone in arm.pose.bones:
        bone.matrix_basis.identity()

def shift(name, xyz):
    bone = arm.pose.bones[name]
    bone.location = bone.bone.matrix_local.to_3x3().inverted() @ Vector(xyz)

def rotate(name, axis, angle):
    bone = arm.pose.bones[name]
    bone.rotation_quaternion = Quaternion(bone.bone.matrix_local.to_3x3().inverted() @ Vector(axis), angle)

def turn_world(name, axis, angle):
    bpy.context.view_layer.update()
    bone = arm.pose.bones[name]
    pivot = Matrix.Translation(bone.head)
    bone.matrix = pivot @ Quaternion(Vector(axis), angle).to_matrix().to_4x4() @ pivot.inverted() @ bone.matrix

def seated():
    shift('CONTROLLER', (0, 0, -.103))
    rotate('pelvis', (1, 0, 0), -.95)
    rotate('Bone.001', (1, 0, 0), .23)
    rotate('Bone.002', (1, 0, 0), .54)
    for side, sign in [('L', 1), ('R', -1)]:
        shift('leg3_control_' + side, (sign * .005, -.060, 0))
        shift('paw_control_' + side, (0, .018, 0))

# Place the ruff between the throat and chest. Keep the later seated belly
# and grounded hind-paw corrections independent and unchanged.
def smooth(a, b, value):
    t = max(0, min(1, (value - a) / (b - a)))
    return t * t * (3 - 2 * t)

reset()
seated()
bpy.context.view_layer.update()
chest = skin.shape_key_add(name='SitRuff')
belly = skin.shape_key_add(name='SitBelly')
paws = skin.shape_key_add(name='SitPaws')
shoulders = skin.shape_key_add(name='SitShoulders')
face = skin.shape_key_add(name='FaceRefine')
coat_indices = {i for p in skin.data.polygons if skin.data.materials[p.material_index].name == 'Lucy calico coat' for i in p.vertices}
to_arm = arm.matrix_world.inverted() @ skin.matrix_world
to_skin = to_arm.inverted()
belly_offsets = {}
belly_ground = {}
for vertex in skin.data.vertices:
    x, y, z = vertex.co
    # One continuous horizontal remap for coat, sockets, eyes and whiskers:
    # slightly slimmer cheeks, with a little extra inward spacing at the eyes.
    # Do not move the eyes independently out of their sockets. Height/depth
    # and the blink delta are unchanged; the neck transition fades smoothly.
    head = (1 - smooth(-.215, -.170, y)) * smooth(.125, .165, z)
    inward = math.copysign(.0012 * smooth(0, .012, abs(x)), x)
    face.data[vertex.index].co.x -= (x * .07 + inward) * head
    if vertex.index not in coat_indices:
        continue
    # Broaden the resting hind paws and lower the raised upper surface while
    # retaining the sole height. This is separate from moving the leg targets.
    paw = smooth(-.060, -.015, y) * (1 - smooth(.023, .058, z))
    deform = Matrix(((0, 0, 0, 0),) * 4)
    for group in vertex.groups:
        bone = arm.pose.bones.get(skin.vertex_groups[group.group].name)
        if bone and bone.bone.use_deform:
            deform += (bone.matrix @ bone.bone.matrix_local.inverted()) * group.weight
    local_deform = to_skin @ deform @ to_arm
    posed = local_deform @ vertex.co
    # The seated upper trunk must not flare sideways like human shoulders.
    # Narrow its sides, not the central ruff's forward depth. Fade above the
    # planted forelegs and below the head; preserve the low abdomen/haunches.
    shoulder = smooth(-.230, -.185, y) * (1 - smooth(-.055, .010, y))
    shoulder *= smooth(.065, .120, posed.z) * (1 - smooth(.175, .215, posed.z))
    shoulder *= smooth(.010, .030, abs(x))
    shoulder_offset = Vector((-posed.x * .34 * shoulder, 0, 0))
    shoulders.data[vertex.index].co += local_deform.to_3x3().inverted_safe() @ shoulder_offset
    paw *= 1 - smooth(.028, .052, posed.z)
    paw_offset = Vector((x * .06, -max(0, .022 - y) * .14, -max(0, posed.z - .008) * .55)) * paw
    paws.data[vertex.index].co += local_deform.to_3x3().inverted_safe() @ paw_offset
    # Sitting compresses the abdomen into a broad, low volume behind the
    # forelegs. Keep the breast, head, feet and tail out of this correction.
    # Inflate the continuous ventral surface in bind space: inverse skinning
    # around the folded hip can introduce creases as the seated pose animates.
    abdomen = smooth(-.145, -.085, y) * (1 - smooth(.035, .095, y))
    abdomen *= smooth(.045, .080, z) * (1 - smooth(.115, .170, z))
    belly_offset = Vector((x * .26, 0, -.018)) * abdomen
    belly_offsets[vertex.index] = belly_offset
    belly_ground[vertex.index] = smooth(.018, .050, posed.z)
    # Move the original ruff back/down off the jaw toward the throat root.
    weight = smooth(-.244, -.196, y) * (1 - smooth(-.120, -.055, y))
    weight *= smooth(.080, .112, z) * (1 - smooth(.150, .185, z))
    weight *= 1 - smooth(.027, .062, abs(x))
    if weight < 1e-5:
        continue
    offset = local_deform.to_3x3().inverted_safe() @ Vector((0, -.020 * weight, -.016 * weight))
    chest.data[vertex.index].co += offset
# Spread the abdominal compression across the connected surface instead of
# leaving a local bump where the abdomen meets the thigh and foreleg weights.
neighbors = [[] for _ in skin.data.vertices]
for edge in skin.data.edges:
    a, b = edge.vertices
    neighbors[a].append(b)
    neighbors[b].append(a)
for _ in range(16):
    relaxed = {}
    for i, value in belly_offsets.items():
        vertex = skin.data.vertices[i]
        if vertex.co.y < -.145 or vertex.co.z < .045 or not neighbors[i]:
            relaxed[i] = Vector((0, 0, 0))
        else:
            mean = sum((belly_offsets.get(j, Vector((0, 0, 0))) for j in neighbors[i]), Vector((0, 0, 0))) / len(neighbors[i])
            relaxed[i] = value.lerp(mean, .5)
    belly_offsets = relaxed
for i, value in belly_offsets.items():
    belly.data[i].co += value * belly_ground[i]

chest.value = 0
belly.value = 0
paws.value = 0
shoulders.value = 0
face.value = 0
reset()

scene = bpy.context.scene
scene.render.fps = 30
specs = [('Sleep', 91), ('Eat', 61), ('Sit', 271), ('Groom', 289), ('Play', 91), ('Crouch', 31), ('Jump', 31)]
for name, frames in specs:
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = action
    for frame in range(1, frames + 1):
        scene.frame_set(frame)
        reset()
        phase = (frame - 1) / (frames - 1)
        if name == 'Sleep':
            shift('CONTROLLER', (0, 0, -.096 + .0004 * math.sin(phase * math.tau)))
            rotate('pelvis', (1, 0, 0), -.14)
            rotate('Bone.002', (1, 0, 0), .79)
            rotate('Bone.004', (1, 0, 0), .0)
            for side, sign in [('L', 1), ('R', -1)]:
                shift('paw_control_' + side, (sign * .003, -.022, 0))
                shift('leg3_control_' + side, (sign * .010, -.048, 0))
            if args.sleep_side:
                # Relax the limbs without folding or scaling the spine. The
                # complete rig is laid on its side by the study presentation.
                reset()
                rotate('pelvis', (1, 0, 0), -.06)
                rotate('Bone.001', (1, 0, 0), .04)
                rotate('Bone.002', (1, 0, 0), .12)
                rotate('Bone.004', (1, 0, 0), .10)
                turn_world('Bone.002', (0, 0, 1), -.22)
                turn_world('Bone.004', (0, 1, 0), -.20)
                for side, sign in [('L', 1), ('R', -1)]:
                    # Offset the upper legs so all four paws do not stack.
                    shift('paw_control_' + side, (-.050 if side == 'L' else -.010, -.075 if side == 'L' else -.050, .032 if side == 'L' else .022))
                    shift('leg3_control_' + side, (-.045 if side == 'L' else -.008, .075 if side == 'L' else .055, .026))
                bpy.context.view_layer.update()
                for side in ['L', 'R']:
                    # Relax the toes along the metatarsus instead of keeping
                    # the walking pose's hooked, floor-facing ankle.
                    paw = arm.pose.bones['feet_' + side]
                    rest = paw.bone.tail_local - paw.bone.head_local
                    lower = arm.pose.bones['leg3_' + side]
                    direction = lower.tail - lower.head
                    angle = math.atan2(rest.y * direction.z - rest.z * direction.y, rest.y * direction.y + rest.z * direction.z)
                    rotate(paw.name, (1, 0, 0), angle * .8)
            if args.sleep_curl:
                # Curve the spine around the tucked limbs and settle onto one
                # flank, rather than lowering an otherwise straight back.
                shift('CONTROLLER', (0, 0, -.104 + .0004 * math.sin(phase * math.tau)))
                rotate('pelvis', (0, 0, 1), -.65)
                pb = arm.pose.bones['pelvis']
                pb.rotation_quaternion @= Quaternion(pb.bone.matrix_local.to_3x3().inverted() @ Vector((0, 1, 0)), .45)
                rotate('Bone.001', (0, 0, 1), 0)
                rotate('Bone.002', (0, 0, 1), 0)
                rotate('Bone.004', (0, 0, 1), 0)
                turn_world('Bone.001', (0, 0, 1), 1.15)
                turn_world('Bone.002', (0, 0, 1), 1.10)
                arm.pose.bones['Bone.001'].scale.y = .80
                arm.pose.bones['Bone.002'].scale.y = .60
                bpy.context.view_layer.update()
                neck = arm.pose.bones['Bone.002']
                down_axis = (neck.tail - neck.head).cross(Vector((0, 0, -1))).normalized()
                turn_world('Bone.002', down_axis, .45)
                turn_world('Bone.004', down_axis, -.15)
                bpy.context.view_layer.update()
                head = arm.pose.bones['Bone.004']
                # Keep the head rigid while the tucked neck shortens.
                head.matrix = Matrix.LocRotScale(head.head, head.matrix.to_quaternion(), Vector((1, 1, 1)))
                bpy.context.view_layer.update()
                mouth = head.matrix @ head.bone.matrix_local.inverted() @ Vector((0, -.267, .168))
                hip = arm.pose.bones['pelvis'].head
                for side, sign in [('L', 1), ('R', -1)]:
                    shoulder = arm.pose.bones['paw1_' + side].head
                    target = mouth.lerp(shoulder, .25) + Vector((sign * .012, .010, -.014))
                    target.z = max(.010, target.z)
                    control = arm.pose.bones['paw_control_' + side]
                    shift(control.name, target - control.bone.head_local)
                    target = hip.lerp(mouth, .25) + Vector((sign * .013, -.012, 0))
                    target.z = .012
                    control = arm.pose.bones['leg3_control_' + side]
                    shift(control.name, target - control.bone.head_local)
        elif name == 'Eat':
            shift('CONTROLLER', (0, 0, -.009))
            rotate('Bone.001', (1, 0, 0), .13)
            rotate('Bone.002', (1, 0, 0), .53)
            rotate('Bone.004', (1, 0, 0), .12 + .018 * math.sin(phase * math.tau * 5))
        elif name in ['Sit', 'Groom', 'Play']:
            seated()
            if name == 'Sit':
                rotate('Bone.004', (0, 0, 1), .45 * math.sin(phase * math.tau) ** 3)
            elif name == 'Groom':
                # Lift toward the mouth, wipe the cheek, then settle before turning to the flank.
                t = phase * 9.6
                def smooth(x):
                    x = max(0, min(1, x))
                    return x * x * (3 - 2 * x)
                def envelope(a, b):
                    return smooth((t - a) / .70) * smooth((b - t) / .70)
                lick, wipe, flank = envelope(.6, 2.9), envelope(2.9, 5.2), envelope(5.7, 9.0)
                stroke = .5 - .5 * math.cos((t - 3.1) * math.tau / 1.4)
                raised = max(lick, wipe)
                rotate('Bone.002', (1, 0, 0), .54 + .32 * lick + .16 * wipe + .30 * flank)
                rotate('Bone.004', (0, 0, 1), .18 * raised - 1.25 * flank)
                bpy.context.view_layer.update()
                head = arm.pose.bones['Bone.004']
                mouth = head.matrix @ head.bone.matrix_local.inverted() @ Vector((.008, -.273, .170))
                target = mouth + Vector((.006, .008 + .010 * wipe * stroke, -.006 + .018 * wipe * stroke))
                control = arm.pose.bones['paw_control_L']
                planted = control.bone.head_local + Vector((0, .018, 0))
                shift(control.name, planted.lerp(target, raised) - control.bone.head_local)
            else:
                reach = (1 - math.cos(phase * math.tau)) / 2
                shift('paw_control_L', (-.008 * reach, .018 - .046 * reach, .082 * reach))
                rotate('Bone.004', (1, 0, 0), -.12 * reach)
        elif name == 'Crouch':
            shift('CONTROLLER', (0, 0, -.027))
            rotate('Bone.002', (1, 0, 0), .22)
            rotate('Bone.004', (1, 0, 0), -.08)
        elif name == 'Jump':
            shift('CONTROLLER', (0, 0, -.012))
            for side in ['L', 'R']:
                shift('paw_control_' + side, (0, .022, .035))
                shift('leg3_control_' + side, (0, -.025, .032))
        for i in range(1, 6):
            if name == 'Sleep' and args.sleep_side:
                rotate('tail' + str(i), (1, 0, 0), [-.13, -.10, .03, .16, .18][i - 1])
                turn_world('tail' + str(i), (0, 0, 1), [.32, .0, -.10, -.10, -.05][i - 1])
            elif name in ['Sleep', 'Sit', 'Groom', 'Play']:
                rotate('tail' + str(i), (0, 0, 1), .40 + .012 * math.sin(phase * math.tau - i * .4))
                bone = arm.pose.bones['tail' + str(i)]
                axis = bone.bone.matrix_local.to_3x3().inverted() @ Vector((1, 0, 0))
                pitches = [-.30, .08, .16, .12, .06] if name == 'Sleep' else [.90, .12, .15, .12, .06]
                bone.rotation_quaternion @= Quaternion(axis, pitches[i - 1])
                if name == 'Sleep' and args.sleep_curl:
                    bpy.context.view_layer.update()
                    angle = .45 - .55 * (i - 1)
                    x, y = math.cos(angle), math.sin(angle)
                    current = bone.tail - bone.head
                    drop = max(-.5, min(.5, (.012 - bone.head.z) / max(current.length * (6 - i), .001)))
                    desired = Vector((x, y, drop)).normalized()
                    pivot = Matrix.Translation(bone.head)
                    bone.matrix = pivot @ current.normalized().rotation_difference(desired).to_matrix().to_4x4() @ pivot.inverted() @ bone.matrix
            else:
                rotate('tail' + str(i), (1, 0, 0), [-.13, -.10, .03, .16, .18][i - 1])
        for bone in arm.pose.bones:
            for prop in ['location', 'rotation_quaternion', 'scale']:
                bone.keyframe_insert(prop, frame=frame)
    for curve in action.fcurves:
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'

arm.animation_data.action = None
reset()
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
skin.select_set(True)
scene.frame_start = 1
scene.frame_end = 37
bpy.ops.export_scene.gltf(filepath=str(args.out / 'lucy-cabin.glb'), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
    export_apply=False, export_extras=False, export_anim_slide_to_zero=True)
print(json.dumps({'file': str(args.out / 'lucy-cabin.glb'), 'clips': [a.name for a in bpy.data.actions]}))
