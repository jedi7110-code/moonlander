"""Bake cabin poses without rebuilding the approved surface or walk actions."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Quaternion, Vector

LOCAL = Path(__file__).resolve().parent / 'local'
parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, default=LOCAL / 'cabin')
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

def seated():
    shift('CONTROLLER', (0, 0, -.103))
    rotate('pelvis', (1, 0, 0), -.95)
    rotate('Bone.001', (1, 0, 0), .23)
    rotate('Bone.002', (1, 0, 0), .54)
    for side, sign in [('L', 1), ('R', -1)]:
        shift('leg3_control_' + side, (sign * .005, -.034, 0))
        shift('paw_control_' + side, (0, .018, 0))

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
            if name in ['Sleep', 'Sit', 'Groom', 'Play']:
                rotate('tail' + str(i), (0, 0, 1), .40 + .012 * math.sin(phase * math.tau - i * .4))
                bone = arm.pose.bones['tail' + str(i)]
                axis = bone.bone.matrix_local.to_3x3().inverted() @ Vector((1, 0, 0))
                pitches = [-.30, .08, .16, .12, .06] if name == 'Sleep' else [.90, .12, .15, .12, .06]
                bone.rotation_quaternion @= Quaternion(axis, pitches[i - 1])
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
