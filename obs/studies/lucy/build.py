"""Private fit study: Free3D mesh, existing Blendkit armature. No public export."""
import bpy, math, json, bmesh, argparse, sys
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

STUDY=Path(__file__).resolve().parent
LOCAL=STUDY/'local'
parser=argparse.ArgumentParser(description='Build the approved Lucy preview from local source assets.')
parser.add_argument('--source-rig',default=LOCAL/'source'/'domestic-cat-rigged.blend',type=Path)
parser.add_argument('--source-mesh',default=LOCAL/'source'/'cat.fbx',type=Path)
parser.add_argument('--out',default=LOCAL,type=Path)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=args.out.expanduser().resolve()
SOURCE=args.source_rig.expanduser().resolve()
MESH=args.source_mesh.expanduser().resolve()
PROJECT=Path(__file__).resolve().parents[3]
if OUT.is_relative_to(PROJECT) and not OUT.is_relative_to(LOCAL.resolve()):
    parser.error('Keep generated assets in this study local/ folder or outside the game repository.')
for source in [SOURCE,MESH]:
    if not source.is_file():parser.error(f'Source asset not found: {source}')
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False,use_scripts=False)
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
world=arm.matrix_world.copy();arm.parent=None;arm.matrix_world=world
for o in list(bpy.data.objects):
    if o!=arm:bpy.data.objects.remove(o,do_unlink=True)
arm.animation_data_clear()
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
for p in arm.pose.bones:
    p.matrix_basis.identity();p.rotation_mode='QUATERNION'
    for c in list(p.constraints):
        if c.type=='IK' and not c.target:p.constraints.remove(c)

bpy.ops.import_scene.fbx(filepath=str(MESH))
skin=next(o for o in bpy.context.scene.objects if o.type=='MESH')
skin.name='Lucy_Free3D_Surface'
# Reorient and uniformly scale only. The supplied silhouette is not sculpted or remeshed.
for v in skin.data.vertices:
    p=skin.matrix_world@v.co
    v.co=(p.y*.07,-p.x*.07-.08,(p.z-.071487762)*.07)
skin.parent=None;skin.matrix_world=Matrix.Identity(4)
original=[v.co.copy() for v in skin.data.vertices]
for o in list(bpy.data.objects):
    if o not in [arm,skin]:bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.objects.active=skin
try:bpy.ops.mesh.customdata_custom_splitnormals_clear()
except RuntimeError:pass
for p in skin.data.polygons:p.use_smooth=True
for e in skin.data.edges:e.use_edge_sharp=False

bpy.context.view_layer.objects.active=arm;skin.select_set(False);arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bones=arm.data.edit_bones
def bone(name,head,tail):
    b=bones[name];b.use_connect=False;b.head=head;b.tail=tail
bone('CONTROLLER',(0,-.065,.245),(0,-.065,.29))
bone('pelvis',(0,.008,.165),(0,-.080,.178))
bone('Bone.001',(0,-.080,.178),(0,-.151,.173))
bone('Bone.002',(0,-.151,.173),(0,-.196,.194))
bone('Bone.004',(0,-.196,.194),(0,-.240,.211))
tail=[(0,.060,.174),(0,.102,.171),(0,.142,.169),(0,.182,.168),(0,.222,.167),(0,.256,.167)]
for i in range(5):bone('tail'+str(i+1),tail[i],tail[i+1])
for side,sign in [('L',1),('R',-1)]:
    rear=[(sign*.027,.010,.147),(sign*.029,-.009,.086),(sign*.030,.031,.039),(sign*.027,.022,.009),(sign*.027,.002,.005)]
    front=[(sign*.030,-.144,.145),(sign*.030,-.138,.080),(sign*.027,-.140,.012),(sign*.027,-.158,.005)]
    for i in range(3):bone('leg'+str(i+1)+'_'+side,rear[i],rear[i+1])
    bone('feet_'+side,rear[3],rear[4])
    bone('leg3_control_'+side,rear[3],Vector(rear[3])+Vector((0,.040,0)))
    for i in range(2):bone('paw'+str(i+1)+'_'+side,front[i],front[i+1])
    bone('paw3_'+side,front[2],front[3])
    bone('paw_control_'+side,front[2],Vector(front[2])+Vector((0,.040,0)))
    bone('leg2_pole2_'+side,(sign*.05,.10,.065),(sign*.05,.13,.065))
    bone('paw_pole_'+side,(sign*.05,-.06,.060),(sign*.05,-.03,.060))
for b in bones:
    b.use_deform=b.name!='CONTROLLER' and 'control' not in b.name and 'pole' not in b.name
bpy.ops.object.mode_set(mode='OBJECT')
arm.show_in_front=True;arm.name='Lucy_Blendkit_Rig'
for p in arm.pose.bones:
    for c in p.constraints:
        if c.type=='IK':c.use_stretch=False
# Make the fitted solver's neutral pose the bind pose, without moving the surface.
bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='POSE');bpy.ops.pose.select_all(action='SELECT')
bpy.ops.pose.armature_apply(selected=False);bpy.ops.object.mode_set(mode='OBJECT')
for p in arm.pose.bones:p.matrix_basis.identity()
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
missing=[v.index for v in skin.data.vertices if not v.groups]
print('UNBOUND_POINTS',[list(skin.data.vertices[i].co) for i in missing])
# Detached whisker/eye islands do not receive Blender's heat weights.
for index in missing:
    point=skin.data.vertices[index].co
    def distance(b):
        segment=b.tail_local-b.head_local
        t=max(0,min(1,(point-b.head_local).dot(segment)/segment.length_squared))
        return (point-(b.head_local+segment*t)).length_squared
    nearest=min((b for b in arm.data.bones if b.use_deform),key=distance)
    group=skin.vertex_groups.get(nearest.name) or skin.vertex_groups.new(name=nearest.name)
    group.add([index],1,'REPLACE')
missing=[v.index for v in skin.data.vertices if not v.groups]
assert not missing,f'Unweighted vertices: {len(missing)}'
assert max((v.co-original[i]).length for i,v in enumerate(skin.data.vertices))<1e-7
# Remove detached coarse eyes and whisker wedges before subdivision.
adj=[set() for v in skin.data.vertices]
for e in skin.data.edges:
    a,b=e.vertices;adj[a].add(b);adj[b].add(a)
remaining=set(range(len(adj)));removed=[]
while remaining:
    stack=[remaining.pop()];group=[]
    while stack:
        i=stack.pop();group.append(i)
        for j in adj[i]:
            if j in remaining:remaining.remove(j);stack.append(j)
    if len(group)==20 or len(group)==5:removed.extend(group)
bm=bmesh.new();bm.from_mesh(skin.data);bm.verts.ensure_lookup_table();bmesh.ops.delete(bm,geom=[bm.verts[i] for i in removed],context='VERTS');bm.to_mesh(skin.data);bm.free()
# One surface subdivision softens the supplied mesh without rebuilding its proportions.
bpy.context.view_layer.objects.active=skin
surface=skin.modifiers.new('Surface smoothing','SUBSURF');surface.levels=1
bpy.ops.object.modifier_move_up(modifier=surface.name)
bpy.ops.object.modifier_apply(modifier=surface.name)
# Keep the tail tube on its own chain; automatic weights otherwise pull its base into the rump.
tail_centers=[('pelvis',.055),('tail1',.091),('tail2',.122),('tail3',.162),('tail4',.202),('tail5',.239)]
for v in skin.data.vertices:
    if v.co.y<=.055:
        tail_weight=sum(g.weight for g in v.groups if skin.vertex_groups[g.group].name.startswith('tail'))
        if tail_weight:
            for g in list(v.groups):
                if skin.vertex_groups[g.group].name.startswith('tail'):skin.vertex_groups[g.group].remove([v.index])
            skin.vertex_groups['pelvis'].add([v.index],tail_weight,'ADD')
        continue
    for g in list(v.groups):skin.vertex_groups[g.group].remove([v.index])
    y=v.co.y
    for (a,ay),(b,by) in zip(tail_centers,tail_centers[1:]):
        if ay<=y<=by:
            t=(y-ay)/(by-ay);skin.vertex_groups[a].add([v.index],1-t,'REPLACE');skin.vertex_groups[b].add([v.index],t,'REPLACE');break
    else:skin.vertex_groups['tail5'].add([v.index],1,'REPLACE')
# Small facial islands must travel with the skull when the neck lowers.
for v in skin.data.vertices:
    if v.co.y<-.223:
        for g in list(v.groups):skin.vertex_groups[g.group].remove([v.index])
        skin.vertex_groups['Bone.004'].add([v.index],1,'REPLACE')

mat=bpy.data.materials.new('Neutral inspection coat');mat.use_nodes=True
mat.name='Lucy calico coat'
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(1,1,1,1);bs.inputs['Roughness'].default_value=.88
skin.data.materials.clear();skin.data.materials.append(mat)
colors=skin.data.color_attributes.new(name='Calico',type='FLOAT_COLOR',domain='CORNER')
vertex_color=mat.node_tree.nodes.new('ShaderNodeVertexColor');vertex_color.layer_name='Calico';mat.node_tree.links.new(vertex_color.outputs['Color'],bs.inputs['Base Color'])
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def mix(a,b,t):return tuple(x*(1-t)+y*t for x,y in zip(a,b))
def patch(p,center,size):return 1-smooth(.86,1.12,sum(((p[i]-center[i])/size[i])**2 for i in range(3))**.5+.065*math.sin(p.y*195)*math.sin(p.z*218+p.x*133))
white=(.80,.77,.69);ginger=(.37,.13,.035);black=(.018,.022,.021)
for loop in skin.data.loops:
    p=skin.data.vertices[loop.vertex_index].co
    g=max(patch(p,(.045,-.08,.15),(.065,.079,.074)),patch(p,(-.044,.020,.15),(.066,.053,.079)))
    k=max(patch(p,(.039,.030,.18),(.06,.067,.065)),patch(p,(-.042,-.115,.164),(.061,.061,.075)))
    color=mix(mix(white,ginger,g),black,k)
    face=1-smooth(-.210,-.178,p.y)
    face_color=mix(ginger,black,(1-smooth(-.025,-.015,p.x))*smooth(.184,.210,p.z))
    blaze=1-smooth(.004,.009,abs(p.x))
    muzzle=1-smooth(.174,.184,p.z)
    face_color=mix(face_color,white,max(blaze,muzzle))
    color=mix(color,face_color,face)
    if p.y>.070:color=mix(ginger,black,smooth(.18,.235,p.y))
    colors.data[loop.index].color=(*color,1)
# Shallow eyes remain seated in the original sockets.
def solid(name,color,rough=.5):
    m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=rough;return m
iris=solid('Hazel iris',(.16,.19,.065),.32);pupil=solid('Pupils and eye margin',(.004,.008,.006),.26);nose=solid('Muted pink nose',(.26,.115,.095),.7);whisker=solid('Whiskers',(.55,.56,.50),.9)
parts=[skin]
def head_part(o,material):
    o.data.materials.append(material);o.vertex_groups.new(name='Bone.004').add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o)
def eye_piece(name,center,radii,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=center);o=bpy.context.object;o.name=name;o.scale=radii;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    for p in o.data.polygons:p.use_smooth=True
    head_part(o,material)
for side in [-1,1]:
    eye_piece('Eye socket',(side*.014,-.2568,.187),(.0078,.0035,.0060),pupil)
    eye_piece('Iris',(side*.014,-.2590,.187),(.0065,.0018,.0049),iris)
    eye_piece('Vertical pupil',(side*.014,-.2605,.187),(.0014,.00065,.0041),pupil)
    for i in range(4):
        curve=bpy.data.curves.new('Whisker','CURVE');curve.dimensions='3D';curve.bevel_depth=.00016;curve.bevel_resolution=1
        spline=curve.splines.new('BEZIER');spline.bezier_points.add(2)
        for p,co in zip(spline.bezier_points,[(side*.012,-.267,.172+i*.0018),(side*.035,-.274,.167+i*.005),(side*(.060+i%2*.006),-.273,.160+i*.009)]):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
        o=bpy.data.objects.new('Whisker',curve);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');head_part(bpy.context.object,whisker)
eye_piece('Nose',(0,-.2725,.173),(.0046,.0017,.0025),nose)
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=skin;bpy.ops.object.join()
skin.data.validate();skin.data.update()
original=[v.co.copy() for v in skin.data.vertices]

scene=bpy.context.scene;scene.render.fps=30
def reset():
    for p in arm.pose.bones:p.matrix_basis.identity()
def shift(name,xyz):
    p=arm.pose.bones[name];p.location=p.bone.matrix_local.to_3x3().inverted()@Vector(xyz)
def rotate(name,axis,angle):
    p=arm.pose.bones[name];p.rotation_quaternion=Quaternion(p.bone.matrix_local.to_3x3().inverted()@Vector(axis),angle)

def walking_rear_paws(phase):
    bpy.context.view_layer.update()
    for side,offset in [('L',0),('R',-.5)]:
        t=(phase+offset)%1
        if t<=.64:continue
        s=(t-.64)/.36
        extension=smooth(.20,.50,s)*(1-smooth(.62,.95,s))
        paw=arm.pose.bones['feet_'+side]
        rest=paw.bone.tail_local-paw.bone.head_local
        lower=arm.pose.bones['leg3_'+side]
        direction=lower.tail-lower.head
        # Follow the metatarsus in profile, without adding an inward toe twist.
        angle=math.atan2(rest.y*direction.z-rest.z*direction.y,rest.y*direction.y+rest.z*direction.z)
        rotate(paw.name,(1,0,0),angle*extension)

def walking_tail_sway(phase):
    bpy.context.view_layer.update()
    chain=[arm.pose.bones['tail'+str(i)] for i in range(1,6)]
    baseline=[p.matrix.to_quaternion() for p in chain]
    parent_rotation=chain[0].parent.matrix.to_quaternion()
    # Set absolute segment directions so lateral bends do not accumulate into a wag.
    for i,(p,orientation) in enumerate(zip(chain,baseline)):
        direction=orientation@Vector((0,1,0))
        axis=direction.cross(Vector((1,0,0))).normalized()
        sway=(.070+.010*i)*math.cos(math.tau*(phase-.24-i*.055/1.2))
        target=Quaternion(axis,sway)@orientation
        rest=p.parent.bone.matrix_local.to_quaternion().inverted()@p.bone.matrix_local.to_quaternion()
        p.rotation_quaternion=(parent_rotation@rest).inverted()@target
        parent_rotation=target

def sitting():
    shift('CONTROLLER',(0,0,-.025));rotate('pelvis',(1,0,0),-.36);rotate('Bone.002',(1,0,0),.22)
    for side in ['L','R']:shift('leg3_control_'+side,(0,-.025,0))
actions=[]
verified_names={'Idle','Walk','WalkLevel','WalkLow'}
tail_curves={'Walk':[.88,.32,.37,.44,.49],'WalkLevel':[-.13,-.10,.03,.16,.18],'WalkLow':[-.62,-.22,.20,.34,.30]}
for name,count in [('Idle',91),('Walk',37),('WalkLevel',37),('WalkLow',37),('Sleep',91),('Eat',61),('Sit',181),('Groom',145),('Crouch',31),('Jump',31)]:
    action=bpy.data.actions.new(name);action.use_fake_user=True;arm.animation_data_create();arm.animation_data.action=action
    for frame in range(1,count+1):
        scene.frame_set(frame);reset();phase=(frame-1)/(count-1)
        if name.startswith('Walk'):
            for side,rear,offset in [('L',True,0),('L',False,-.24),('R',True,-.5),('R',False,-.74)]:
                t=(phase+offset)%1;sign=1 if side=='L' else -1
                # Narrow tracks stay fixed during stance; only the lifted paw arcs outward.
                x=sign*((.012 if rear else .010)-.027)
                if t<.64:y=-.056+.112*t/.64;z=0
                else:
                    s=(t-.64)/.36
                    y=.056+.063*s-.525*s*s+.350*s*s*s
                    z=.020*math.sin(math.pi*s)**1.5
                    x+=sign*.003*math.sin(math.pi*s)**2
                    if not rear:
                        fold=smooth(.08,.44,s)*(1-smooth(.50,.90,s))
                        rotate('paw3_'+side,(1,0,0),1.55*fold)
                shift(('leg3_control_' if rear else 'paw_control_')+side,(x,y,z))
                # Keep elbows/hocks under the body, not flared toward the old wide poles.
                shift(('leg2_pole2_' if rear else 'paw_pole_')+side,(-sign*(.025 if rear else .045),0,0))
                if not rear:
                    shift('paw1_'+side,(-sign*.0035,-.006*math.cos(t*math.tau),.002*math.sin(t*math.tau)))
            shift('CONTROLLER',(0,0,-.012+.0008*math.cos(phase*math.tau*2)))
            rotate('Bone.002',(1,0,0),.35)
            rotate('Bone.004',(1,0,0),-.26)
        elif name=='Sleep':
            shift('CONTROLLER',(0,0,-.080+.0005*math.sin(phase*math.tau)));rotate('Bone.002',(1,0,0),.30);rotate('Bone.004',(1,0,0),.16)
            for side in ['L','R']:
                shift('paw_control_'+side,(0,.025,0));shift('leg3_control_'+side,(0,-.025,0))
        elif name=='Eat':
            shift('CONTROLLER',(0,0,-.008));rotate('Bone.001',(1,0,0),.16);rotate('Bone.002',(1,0,0),.85);rotate('Bone.004',(1,0,0),.09+.018*math.sin(phase*math.tau*5))
        elif name in ['Sit','Groom']:
            sitting()
            if name=='Sit':rotate('Bone.004',(0,0,1),.42*math.sin(phase*math.tau)**3)
            else:
                lift=.5-.5*math.cos(phase*math.tau)
                shift('paw_control_L',(-.008,-.040,.065+.020*lift));rotate('Bone.004',(1,0,0),.30+.10*lift);rotate('Bone.002',(0,0,1),-.18)
        elif name=='Crouch':shift('CONTROLLER',(0,0,-.035));rotate('Bone.002',(1,0,0),.15)
        elif name=='Jump':
            shift('CONTROLLER',(0,0,-.012))
            for side in ['L','R']:shift('paw_control_'+side,(0,.015,.040));shift('leg3_control_'+side,(0,-.020,.025))
        else:shift('CONTROLLER',(0,0,.0004*math.sin(phase*math.tau)))
        if name=='Idle' or name.startswith('Walk'):
            head=arm.pose.bones['Bone.004']
            head.rotation_quaternion @= Quaternion(head.bone.matrix_local.to_3x3().inverted()@Vector((0,0,1)),.035*math.sin(phase*math.tau))
        for i in range(1,6):
            if name in ['Sleep','Sit','Groom']:rotate('tail'+str(i),(0,0,1),.22+.025*math.sin(phase*math.tau-i*.4))
            else:rotate('tail'+str(i),(1,0,0),tail_curves.get(name,tail_curves['Walk'])[i-1]+.013*math.sin(phase*math.tau-i*.4))
        if name.startswith('Walk'):
            walking_rear_paws(phase)
            walking_tail_sway(phase)
        for p in arm.pose.bones:
            p.keyframe_insert('location',frame=frame);p.keyframe_insert('rotation_quaternion',frame=frame);p.keyframe_insert('scale',frame=frame)
    actions.append(action)
arm.animation_data.action=None;reset();bpy.context.view_layer.update()
# Test the fitted rest pose independently of animation.
rest=skin.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
rest_error=max((v.co-original[i]).length for i,v in enumerate(rest.vertices))
skin.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
print('REST_ERROR',rest_error)
arm['source']='Blendkit Domestic cat (rigged), Pawel Walasiewicz; adjusted joint positions'
skin['source']='Free3D Low poly cat 46138, snippysnappets; Personal Use License'
scene['distribution']='LOCAL PERSONAL STUDY ONLY. Generated assets are kept in the Git-ignored study local/ folder.'
scene.frame_start=1;scene.frame_end=37
arm.animation_data.action=actions[1];scene.frame_set(1)
for ids in [bpy.data.images,bpy.data.materials,bpy.data.meshes,bpy.data.particles]:
    for block in list(ids):
        if block.users==0:ids.remove(block)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'lucy-combined.blend'))
# Other poses stay as editable drafts in Blender; the web preview contains verified locomotion only.
draft_names=[a.name for a in actions if a.name not in verified_names]
verified_actions=[a for a in actions if a.name in verified_names]
for a in actions:
    if a.name not in verified_names:bpy.data.actions.remove(a)
actions=verified_actions
arm.select_set(True);skin.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'lucy-combined.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_apply=False,export_extras=False,export_anim_slide_to_zero=True)
report={'mesh_vertices':len(skin.data.vertices),'mesh_triangles':sum(len(p.vertices)-2 for p in skin.data.polygons),'bones':len(arm.data.bones),'clips':[a.name for a in actions],'unweighted_vertices':len(missing),'rest_max_error_m':rest_error,'glb_bytes':(OUT/'lucy-combined.glb').stat().st_size}
report['blender_drafts']=draft_names
(OUT/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
