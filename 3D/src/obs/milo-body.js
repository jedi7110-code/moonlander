import * as THREE from 'three';
import {armBruiseMask,handBruiseMask,armBruiseShader} from './injury-appearance.js';

// Share tapered garment folds between surface shading and displacement.
const kneeFoldShader=`
vec2 miloKneeFolds(vec3 p){
  float x=abs(p.x)-.105;
  float handed=p.x<0.0?-1.0:1.0;
  vec2 folds=vec2(0.0);
  for(int i=0;i<3;i++){
    float row=float(i);
    float slope=i==1?.19:-.14;
    float center=.567-row*.041+handed*.003+handed*slope*x+.004*cos(x*28.0+row);
    float taper=1.0-smoothstep(.035,.085,abs(x+(row-1.0)*.008));
    float width=mix(.0025,.009,taper);
    float d=p.y-center;
    float valley=exp(-pow(d/width,2.0));
    float ridge=exp(-pow((d-.010)/(width*1.6),2.0));
    folds+=vec2(valley,ridge)*taper*(i==1?1.0:.86);
  }
  return min(folds,vec2(1.0));
}
vec2 miloFrontFolds(vec3 p){
  float side=abs(p.x);
  float offset=p.x<0.0?-.002:.002;
  vec2 folds=vec2(0.0);
  for(int i=0;i<2;i++){
    float center=i==0?.878+.20*(side-.025):.858+.025*(side-.070);
    float start=i==0?.022:.052;
    float end=i==0?.168:.153;
    float taper=smoothstep(start,start+.023,side)*(1.0-smoothstep(end-.038,end,side));
    float width=mix(.002,.007,taper);
    float d=p.y-center-offset;
    folds+=vec2(exp(-pow(d/width,2.0)),exp(-pow((d-.009)/(width*1.7),2.0)))*taper*(i==0?1.0:.78);
  }
  return min(folds,vec2(1.0));
}
`;

let bodyData=null,tattooMaps=null;
export function sampleMiloNeckline(geometry){
  if(!geometry)return null;
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const scan=new THREE.Mesh(geometry,material),ray=new THREE.Raycaster(),radii=[];
  // Measure the actual scan at the sloping collar edge, in head-local space.
  for(let i=0;i<128;i++){
    const angle=i*Math.PI*2/128,c=Math.cos(angle),s=Math.sin(angle);
    ray.set(new THREE.Vector3(c*4,(1.563-.020*s-1.637)/.055,s*4),new THREE.Vector3(-c,0,-s));
    const hit=ray.intersectObject(scan,false)[0];
    radii.push(hit?(4-hit.distance)*.055:null);
  }
  material.dispose();
  return radii.every(r=>Number.isFinite(r)&&r>.03)?radii:null;
}

export async function loadMiloBody(url=`${import.meta.env?.BASE_URL??'/3D/'}assets/obs/milo/body.json`){
  if(bodyData)return bodyData;
  const response=await fetch(url);if(!response.ok)throw new Error('Milo body could not be loaded');
  const data=await response.json();
  if(typeof document!=='undefined'){
    const loader=new THREE.TextureLoader(),base=import.meta.env?.BASE_URL??'/3D/';
    tattooMaps=await Promise.all(['tattoo-cosmo-atomic-bold.png','tattoo-cat-red.png'].map(name=>loader.loadAsync(`${base}assets/obs/milo/${name}`)));
    for(const map of tattooMaps){map.colorSpace=THREE.NoColorSpace;map.anisotropy=4;}
  }
  bodyData=data;return bodyData;
}

// The animation controllers remain the authoritative joints. Bones live below
// those controllers, so walking, IK, sitting and reaching deform the same skin.
export function attachMiloBody(root,m,pants,legacy){
  if(!bodyData)return null;
  const {body,chest,head,arms,legs}=root.userData,data=bodyData;
  const wristLift=.274+arms[0].hand.position.y,wristHeight=.904+wristLift;
  const drivers={body,chest,head},wrists=[];
  for(let i=0;i<arms.length;i++){
    const prefix=arms[i].side<0?'L':'R';
    arms[i].hand.position.z=-.025;
    arms[i].hand.scale.set(1.16,1.05,1.08);
    for(const key of ['arm','elbow','hand'])drivers[prefix+'_'+key]=arms[i][key];
    for(const key of ['leg','knee','boot'])drivers[prefix+'_'+key]=legs[i][key];
    arms[i].fingers.forEach((finger,j)=>{
      [finger,...finger.userData.links].forEach((link,k)=>drivers[`${prefix}_finger${j}_${k}`]=link);
    });
    drivers[prefix+'_thumb']=arms[i].thumb;
    for(let j=1;j<=2;j++){
      const driver=new THREE.Group();driver.position.copy(arms[i].hand.position);driver.position.z*=j/3;arms[i].elbow.add(driver);
      driver.scale.set(1,1,1).lerp(arms[i].hand.scale,j/3);
      drivers[`${prefix}_wrist${j}`]=driver;wrists.push({driver,hand:arms[i].hand,fraction:j/3});
    }
  }
  const bones=data.bones.map(spec=>{const bone=new THREE.Bone();bone.name='Milo skin '+spec.name;drivers[spec.name].add(bone);return bone;});
  const inverses=data.bones.map(spec=>{
    const target=[...spec.target];if(/_(hand|finger|thumb|wrist)/.test(spec.name))target[1]+=wristLift;
    return new THREE.Matrix4().makeTranslation(...target.map(v=>-v));
  });
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.uvs,2));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(data.joints,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(data.weights,4));
  // Shape the garment in bind space so normals and shadows follow its silhouette.
  const surface=geometry.attributes.position,smooth=THREE.MathUtils.smoothstep;
  const necklineRadii=sampleMiloNeckline(head.getObjectByName('Milo scanned head')?.geometry);
  const armTransforms=new Map();
  // Source and fitted half-widths keep the shirt, waistband and hips continuous.
  const waistHeights=[.96,1.025,1.075,1.10,1.125,1.175,1.225,1.275,1.325,1.36];
  const waistSource=new THREE.CubicInterpolant(waistHeights,[.178,.179,.158,.158,.173,.174,.177,.181,.185,.186],1);
  const waistFit=new THREE.CubicInterpolant(waistHeights,[.178,.170,.156,.153,.150,.149,.157,.175,.184,.186],1);
  const legHeights=[.17,.22,.30,.40,.535,.65,.72,.77,.82,.87,.94];
  const legSource=new THREE.CubicInterpolant(legHeights,[.069,.077,.078,.080,.087,.095,.098,.094,.074,.074,.076],1);
  const legFit=new THREE.CubicInterpolant(legHeights,[.069,.080,.081,.081,.080,.081,.081,.080,.078,.075,.076],1);
  for(let i=0;i<surface.count;i++){
    const x=Math.abs(surface.getX(i)),y=surface.getY(i),z=surface.getZ(i);
    // Straight cargo legs: fit both edges around each leg, fading before the crotch joins.
    if(y>.17&&y<.94){
      const fit=legFit.evaluate(y)[0]/legSource.evaluate(y)[0];
      const innerBlend=1-smooth(y,.75,.82);
      const blend=smooth(y,.17,.22)*(1-smooth(y,.87,.94))*(1-smooth(data.armRegions[i],.05,.20));
      const edgeBlend=THREE.MathUtils.lerp(innerBlend,1,smooth(x,.075,.125));
      surface.setX(i,Math.sign(surface.getX(i))*(x+(x-.100)*(fit-1)*blend*edgeBlend));
    }
    // The source leg envelopes cross the midline below the actual crotch seam.
    // Original cylindrical UVs retain the anatomical side even where X folded over.
    if(x<.050&&y>.75&&y<.89&&data.armRegions[i]<.05){
      const anatomicalX=Math.cos((data.uvs[i*2]-.5)*Math.PI*2);
      const blend=(1-smooth(x,.015,.050))*smooth(y,.75,.78)*(1-smooth(y,.855,.89));
      const unfolded=Math.sign(anatomicalX)*Math.max(Math.abs(surface.getX(i)),.016*Math.abs(anatomicalX));
      surface.setX(i,THREE.MathUtils.lerp(surface.getX(i),unfolded,blend));
    }
    if(y>.96&&y<1.36){
      const flank=1-smooth(data.armRegions[i],.05,.20);
      const fit=Math.min(1,waistFit.evaluate(y)[0]/waistSource.evaluate(y)[0]);
      const blend=smooth(y,.96,1.005)*(1-smooth(y,1.325,1.36))*flank;
      surface.setX(i,surface.getX(i)*THREE.MathUtils.lerp(1,fit,blend));
    }
    if(data.armRegions[i]>.95&&y<1.24){
      // Fit one long forearm taper in palms-in space, then undo skin blending.
      const side=surface.getX(i)<0?-1:1,pivot=side*.207,hand=arms.find(arm=>arm.side===side).hand;
      let m00=0,m02=0,m20=0,m22=0,sy=0,tz=0;
      for(let j=0;j<4;j++){
        const name=data.bones[data.joints[i*4+j]].name;
        const turn=name.endsWith('_wrist1')?1/3:name.endsWith('_wrist2')?2/3:/hand|finger|thumb/.test(name)?1:0;
        const w=data.weights[i*4+j],c=Math.cos(turn*side*Math.PI/2),s=Math.sin(turn*side*Math.PI/2);
        const sx=1+(hand.scale.x-1)*turn,sz=1+(hand.scale.z-1)*turn;
        m00+=w*c*sx;m02+=w*s*sz;m20-=w*s*sx;m22+=w*c*sz;tz+=w*hand.position.z*turn;
        sy+=w*(1+(hand.scale.y-1)*turn);
      }
      armTransforms.set(i,{m00,m02,m20,m22,sy,tz,pivot});
      if(y>.855){
        const t=THREE.MathUtils.clamp((y-.880)/.300,0,1);
        const rx=.025+.039*t-.014*t*t,rz=.036+.037*t-.016*t*t;
        const centreZ=-.036-.039*t+.014*t*t,centreX=-side*.010*smooth(y,.880,1.14);
        const nx=m00*(surface.getX(i)-pivot)+m02*z,nz=m20*(surface.getX(i)-pivot)+m22*z+tz;
        const angle=Math.atan2((nz-centreZ)/rz,(nx-centreX)/rx);
        const blend=smooth(y,.855,.880)*(1-smooth(y,1.14,1.24));
        const qx=THREE.MathUtils.lerp(nx,centreX+Math.cos(angle)*rx,blend);
        const qz=THREE.MathUtils.lerp(nz,centreZ+Math.sin(angle)*rz,blend)-tz;
        const determinant=m00*m22-m02*m20;
        surface.setX(i,pivot+(m22*qx-m02*qz)/determinant);
        surface.setZ(i,(m00*qz-m20*qx)/determinant);
      }
    }
    const neckRadius=Math.hypot(x,z+.009);
    if(y>1.47&&neckRadius>.001&&neckRadius<.14){
      const neckline=1.563-.020*(z+.009)/neckRadius;
      // Extend the existing shirt surface to the neck; no second fabric shell.
      const front=(z+.009)/neckRadius;
      const neckDepth=front>0?.081:.070;
      let neckFit=1/Math.hypot((surface.getX(i)/neckRadius)/.076,front/neckDepth);
      if(necklineRadii){
        const sample=(Math.atan2(z+.009,surface.getX(i))+Math.PI*2)%(Math.PI*2)*necklineRadii.length/(Math.PI*2);
        const index=Math.floor(sample);
        neckFit=THREE.MathUtils.lerp(necklineRadii[index],necklineRadii[(index+1)%necklineRadii.length],sample-index)+.001;
      }
      const envelope=neckFit+.30*Math.max(0,neckline-y)+(necklineRadii ? .010*smooth(neckline-y,0,.018) : 0);
      const blend=smooth(y,1.47,1.54)*(1-smooth(neckRadius,.11,.14));
      const difference=envelope-neckRadius;
      const expansion=.5*(difference+Math.sqrt(difference*difference+.000016));
      const radius=necklineRadii?THREE.MathUtils.lerp(neckRadius,envelope,blend):neckRadius+expansion*blend;
      surface.setX(i,surface.getX(i)*radius/neckRadius);
      surface.setZ(i,-.009+(z+.009)*radius/neckRadius);
      if(necklineRadii){
        const outside=smooth(neckRadius-neckFit,.004,.025)*(1-smooth(x,.11,.16));
        const shoulderHeight=neckline-.002;
        surface.setY(i,y-Math.max(0,y-shoulderHeight)*outside);
      }
    }
    if(x>.11&&x<.29&&y>1.37){
      // Round the whole deltoid volume, including its front/back cross-section.
      const dx=x-.175,dy=y-1.40,dz=z+.025;
      const radius=Math.hypot(dx/.085,dy/.140,dz/.098);
      const blend=smooth(x,.11,.17)*smooth(y,1.37,1.46);
      const scale=THREE.MathUtils.lerp(1,1/radius,blend);
      const shoulderY=necklineRadii&&x<.16?Math.min(surface.getY(i),1.40+dy*scale):1.40+dy*scale;
      surface.setXYZ(i,Math.sign(surface.getX(i))*(.175+dx*scale),shoulderY,-.025+dz*scale);
      // Fill the upper shoulder hollow with a curved roof, leaving the collar intact.
      const roof=1.552-.043*smooth(x,.085,.24)-.070*(z/.10)**2;
      const crown=smooth(x,.095,.13)*(1-smooth(x,.22,.26))*smooth(y,1.48,1.525);
      surface.setY(i,surface.getY(i)+Math.min(.012,Math.max(0,roof-surface.getY(i)))*crown);
    }
    if(data.armRegions[i]>.95&&y>1.24&&y<1.44){
      // Ease the biceps into the sleeve without narrowing the elbow or forearm.
      const belly=smooth(y,1.24,1.29)*(1-smooth(y,1.37,1.44));
      const front=smooth(z,-.065,.015),side=Math.sign(surface.getX(i));
      surface.setX(i,side*(.207+(Math.abs(surface.getX(i))-.207)*(1-.05*belly)));
      surface.setZ(i,surface.getZ(i)-.10*belly*front*Math.max(0,z+.045));
    }
    const rear=smooth(-z,.010,.065)*(1-smooth(data.armRegions[i],.05,.30));
    if(!rear||y<.68||y>1.19)continue;
    const hem=smooth(y,1.015,1.055)*(1-smooth(y,1.125,1.185));
    const hemDepth=.130*Math.sqrt(Math.max(0,1-(x/.181)**2));
    let depth=THREE.MathUtils.lerp(-z,Math.max(-z,hemDepth),rear*hem);
    const seatBlend=smooth(y,.83,.96),center=.100*(1-seatBlend);
    const radius=THREE.MathUtils.lerp(.098,.182,seatBlend);
    const seatDepth=THREE.MathUtils.lerp(.117,.139,smooth(y,.74,.96))*Math.sqrt(Math.max(0,1-((x-center)/radius)**2));
    const seat=smooth(y,.68,.75)*(1-smooth(y,.955,1.015))*smooth(x,.015,.050);
    depth=THREE.MathUtils.lerp(depth,Math.max(depth,seatDepth),rear*seat);
    surface.setZ(i,-depth);
  }
  // Compress the complete forearm in bind space; translating only the wrist
  // controllers would bunch up the skin where their weights begin.
  for(let i=0;i<surface.count;i++){
    const y=surface.getY(i),weight=smooth(data.armRegions[i],.8,.95);
    surface.setY(i,y+wristLift*THREE.MathUtils.clamp((1.178-y)/.274,0,1)*weight);
  }
  geometry.setIndex(data.indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  // A changing twist has a spatial derivative that ordinary skinned normals
  // miss. Bake normals from the relaxed surface, then undo the joint blend.
  const relaxed=geometry.clone(),relaxedPosition=relaxed.attributes.position;
  for(const [i,{m00,m02,m20,m22,sy,tz,pivot}] of armTransforms){
    const x=surface.getX(i)-pivot,y=surface.getY(i),z=surface.getZ(i);
    relaxedPosition.setXYZ(i,pivot+m00*x+m02*z,wristHeight+(y-wristHeight)*sy,m20*x+m22*z+tz);
  }
  relaxed.computeVertexNormals();
  const normal=new THREE.Vector3(),originalNormal=new THREE.Vector3();
  for(const [i,{m00,m02,m20,m22,sy}] of armTransforms){
    const y=data.positions[i*3+1],blend=smooth(y,.855,.880)*(1-smooth(y,1.14,1.24));
    if(!blend)continue;
    normal.fromBufferAttribute(relaxed.attributes.normal,i);
    const {x,z}=normal,determinant=m00*m22-m02*m20;
    normal.set((m22*x-m02*z)/determinant,normal.y/sy,(m00*z-m20*x)/determinant).normalize();
    originalNormal.fromBufferAttribute(geometry.attributes.normal,i).lerp(normal,blend).normalize();
    geometry.attributes.normal.setXYZ(i,...originalNormal.toArray());
  }
  relaxed.dispose();
  // Project onto the relaxed outer forearm, then carry the coordinates with
  // the skin. The tattoo is pigment, not a separate floating decal mesh.
  const tattooUv=new Float32Array(surface.count*2),tattooMask=new Float32Array(surface.count);
  for(const [i,{m00,m02,m20,m22,tz,pivot}] of armTransforms){
    const side=surface.getX(i)<0?-1:1,x=surface.getX(i)-pivot,z=surface.getZ(i),sourceY=data.positions[i*3+1];
    const t=THREE.MathUtils.clamp((sourceY-.880)/.300,0,1),centerZ=-.036-.039*t+.014*t*t,centerX=-side*.010*smooth(sourceY,.880,1.14);
    // Both supplied designs are 1:3, running from elbow toward wrist.
    const nx=m00*x+m02*z,nz=m20*x+m22*z+tz,width=.070,height=.210;
    tattooUv[i*2]=.5-side*(nz-centerZ)/width;tattooUv[i*2+1]=.5+(surface.getY(i)-1.055)/height;
    tattooMask[i]=smooth(side*(nx-centerX),.008,.020)*smooth(data.armRegions[i],.90,.98);
  }
  geometry.setAttribute('tattooUv',new THREE.BufferAttribute(tattooUv,2));geometry.setAttribute('tattooMask',new THREE.BufferAttribute(tattooMask,1));
  geometry.setAttribute('armRegion',new THREE.Float32BufferAttribute(data.armRegions,1));
  const bruiseMask=new Float32Array(surface.count),bruiseUv=new Float32Array(surface.count*2);
  for(let i=0;i<surface.count;i++){
    const x=surface.getX(i),y=surface.getY(i),z=surface.getZ(i),region=data.armRegions[i];
    bruiseMask[i]=Math.max(armBruiseMask(x,y,z,region),handBruiseMask(x,y,z,region));
    // Store pigment coordinates independently of position: grip fitting can
    // reshape the palm but must not slide the bruise over its surface.
    // Offset the smaller hand patch so its pale area breaks one edge instead
    // of repeating the forearm's pattern as a conspicuous circular ring.
    bruiseUv[i*2]=y<1?(y-.892)/.025+.75:(y-1.13)/.055;
    bruiseUv[i*2+1]=y<1?(x+.212)/.023+.65:(z+.003)/.045;
  }
  geometry.setAttribute('bruiseMask',new THREE.BufferAttribute(bruiseMask,1));
  geometry.setAttribute('bruiseUv',new THREE.BufferAttribute(bruiseUv,2));
  const material=m.skin.clone(),fabricMap=pants.userData.fabricMap??pants.bumpMap;material.roughness=.84;
  material.userData.bruiseStrength={value:0};
  material.side=THREE.DoubleSide;material.shadowSide=THREE.BackSide;
  if(fabricMap){material.bumpMap=fabricMap.clone();material.bumpMap.repeat.set(18,24);material.bumpMap.needsUpdate=true;material.bumpScale=.006;}
  material.onBeforeCompile=shader=>{
    shader.uniforms.bruiseStrength=material.userData.bruiseStrength;
    shader.uniforms.tattooAtom={value:tattooMaps?.[0]??null};shader.uniforms.tattooCat={value:tattooMaps?.[1]??null};shader.uniforms.tattooStrength={value:tattooMaps ? .88 : 0};
    shader.uniforms.shirtColor={value:m.cloth.color};shader.uniforms.trouserColor={value:pants.color};shader.uniforms.trouserMap={value:fabricMap};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float bruiseMask; varying float vBruiseMask; attribute vec2 bruiseUv; varying vec2 vBruiseUv; attribute float armRegion; attribute vec2 tattooUv; attribute float tattooMask; varying vec2 vTattooUv; varying float vTattooMask; varying float vArmRegion; varying vec3 vBodyPosition; varying vec2 vMiloUv;'+kneeFoldShader).replace('#include <begin_vertex>',`#include <begin_vertex>
      vBruiseMask=bruiseMask;vBruiseUv=bruiseUv;
      vBodyPosition=position;vArmRegion=armRegion;vMiloUv=uv;vTattooUv=tattooUv;vTattooMask=tattooMask;
      float trouserVertex=(1.0-smoothstep(1.065,1.085,position.y))*(1.0-smoothstep(.2,.5,armRegion));
      float frontMask=smoothstep(.015,.095,position.z),backMask=smoothstep(.015,.095,-position.z);
      float kneeShape=exp(-pow((position.y-.53)/.16,2.0));
      float calfShape=exp(-pow((position.y-.30)/.21,2.0));
      float backKneeShape=backMask*exp(-pow((position.y-.525)/.090,2.0));
      float waistShape=exp(-pow((position.y-1.005)/.055,2.0));
      float crotchShape=frontMask*exp(-pow((position.y-.865)/.115,2.0));
      float clothFold=sin(position.y*38.0+position.z*27.0+position.x*13.0)*sin(position.y*17.0-position.z*41.0);
      float crossFold=sin(position.x*58.0+position.y*31.0-position.z*19.0);
      vec2 backKneeFolds=miloKneeFolds(position);
      float backKneeFold=-backKneeFolds.x+.30*backKneeFolds.y;
      float waistFold=sin(position.x*67.0+position.z*36.0)+.45*sin(position.x*109.0-position.z*51.0);
      vec2 frontFolds=miloFrontFolds(position);
      float crotchFold=-frontFolds.x+.30*frontFolds.y;
      transformed+=normal*trouserVertex*(.0009*clothFold+(.0015*kneeShape+.0007*calfShape)*crossFold+.0028*backKneeShape*backKneeFold+.0017*waistShape*waistFold+.0022*crotchShape*crotchFold);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float bruiseStrength;varying float vBruiseMask;varying vec2 vBruiseUv;uniform vec3 shirtColor;uniform vec3 trouserColor;uniform sampler2D trouserMap;uniform sampler2D tattooAtom;uniform sampler2D tattooCat;uniform float tattooStrength;varying vec2 vTattooUv;varying float vTattooMask;varying float vArmRegion;varying vec3 vBodyPosition;varying vec2 vMiloUv;'+kneeFoldShader+armBruiseShader).replace('#include <color_fragment>',`#include <color_fragment>
      float side=abs(vBodyPosition.x);
      float neckline=1.563-.020*(vBodyPosition.z+.009)/max(length(vec2(vBodyPosition.x,vBodyPosition.z+.009)),.001);
      if(vBodyPosition.y>neckline)discard;
      float sleeve=mix(1.0,smoothstep(1.293,1.297,vBodyPosition.y),smoothstep(.20,.50,vArmRegion));
      float shirt=(1.0-smoothstep(neckline-.001,neckline+.001,vBodyPosition.y))*sleeve;
      float collar=smoothstep(neckline-.014,neckline-.010,vBodyPosition.y)*shirt;
      float cuff=(1.0-smoothstep(1.303,1.310,vBodyPosition.y))*smoothstep(.5,.8,vArmRegion)*shirt;
      float trousers=(1.0-smoothstep(1.073,1.077,vBodyPosition.y))*(1.0-smoothstep(.2,.5,vArmRegion));
      vec3 weave=texture2D(trouserMap,vMiloUv*vec2(18.0,24.0)).rgb;
      float weaveTone=mix(.90,1.08,smoothstep(.08,.42,dot(weave,vec3(.3333))));
      float kneeWear=exp(-pow((vBodyPosition.y-.53)/.18,2.0));
      float thighWear=exp(-pow((vBodyPosition.y-.82)/.23,2.0));
      float ankleWear=exp(-pow((vBodyPosition.y-.22)/.14,2.0));
      float frontMask=smoothstep(.015,.095,vBodyPosition.z),backMask=smoothstep(.015,.095,-vBodyPosition.z);
      float backKneeZone=backMask*exp(-pow((vBodyPosition.y-.525)/.090,2.0));
      float waistZone=exp(-pow((vBodyPosition.y-1.005)/.055,2.0));
      float crotchZone=frontMask*exp(-pow((vBodyPosition.y-.865)/.115,2.0));
      float seatZone=backMask*smoothstep(.895,.915,vBodyPosition.y)*exp(-pow((vBodyPosition.y-.945)/.065,2.0));
      float longFold=sin(vBodyPosition.y*31.0+vBodyPosition.z*25.0+abs(vBodyPosition.x)*17.0);
      float diagonalFold=sin(vBodyPosition.y*53.0-vBodyPosition.z*37.0+vBodyPosition.x*29.0);
      float fineFold=sin(vBodyPosition.y*89.0+vBodyPosition.z*21.0-vBodyPosition.x*47.0);
      float foldField=.52*longFold+.31*diagonalFold+.17*fineFold;
      float crease=pow(smoothstep(.12,.72,foldField),3.0),ridge=pow(smoothstep(.28,.82,-foldField),4.0);
      float wrinkleZone=clamp(.78*kneeWear+.36*thighWear+.46*ankleWear,0.0,1.0);
      float backThighSmooth=backMask*smoothstep(.70,.78,vBodyPosition.y)*(1.0-smoothstep(.875,.925,vBodyPosition.y));
      wrinkleZone*=1.0-.92*backThighSmooth;
      vec2 backKneeFolds=miloKneeFolds(vBodyPosition);
      float backKneeCrease=backKneeFolds.x;
      float backKneeRidge=backKneeFolds.y;
      float waistFold=sin(vBodyPosition.x*67.0+vBodyPosition.z*36.0)+.45*sin(vBodyPosition.x*109.0-vBodyPosition.z*51.0);
      vec2 frontFolds=miloFrontFolds(vBodyPosition);
      float seatFold=sin((vBodyPosition.y-.84)*46.0+vBodyPosition.x*29.0-vBodyPosition.z*26.0);
      float jointCrease=backKneeZone*backKneeCrease+.62*waistZone*pow(smoothstep(.18,.90,waistFold),3.0)+.82*crotchZone*frontFolds.x+.16*seatZone*pow(smoothstep(.12,.76,seatFold),3.0);
      float jointRidge=backKneeZone*backKneeRidge+.55*waistZone*pow(smoothstep(.28,.96,-waistFold),3.0)+.72*crotchZone*frontFolds.y+.12*seatZone*pow(smoothstep(.22,.84,-seatFold),3.0);
      float foldShade=1.0+.022*longFold+.016*diagonalFold-.32*crease*wrinkleZone+.085*ridge*wrinkleZone-.39*jointCrease+.12*jointRidge;
      vec3 trouserSurface=trouserColor*weaveTone*foldShade;

      float belt=smoothstep(1.045,1.050,vBodyPosition.y)*(1.0-smoothstep(1.069,1.075,vBodyPosition.y))*trousers;
      float buckle=belt*frontMask*(1.0-smoothstep(.022,.028,abs(vBodyPosition.x)));
      float loopDistance=min(abs(abs(vBodyPosition.x)-.062),abs(abs(vBodyPosition.x)-.148));
      float beltLoop=frontMask*(1.0-smoothstep(.006,.010,loopDistance))*smoothstep(1.034,1.040,vBodyPosition.y)*(1.0-smoothstep(1.083,1.090,vBodyPosition.y));
      trouserSurface=mix(trouserSurface,vec3(.012,.016,.015),belt);
      trouserSurface=mix(trouserSurface,vec3(.075,.082,.076),buckle);
      trouserSurface=mix(trouserSurface,trouserColor*.60,beltLoop);

      float flyY=smoothstep(.850,.862,vBodyPosition.y)*(1.0-smoothstep(1.042,1.052,vBodyPosition.y));
      float flyCurve=mix(.006,-.021,smoothstep(.850,1.015,vBodyPosition.y));
      float flyStitch=(1.0-smoothstep(.0012,.0032,abs(vBodyPosition.x-flyCurve)))+(1.0-smoothstep(.0012,.0032,abs(vBodyPosition.x-flyCurve+.009)));
      float frontFly=clamp(flyStitch,0.0,1.0)*flyY*frontMask;
      float handPocketY=1.040-(side-.075)*.43;
      float handPocket=(1.0-smoothstep(.0015,.0040,abs(vBodyPosition.y-handPocketY)))*smoothstep(.075,.095,side)*(1.0-smoothstep(.158,.178,side))*frontMask;

      float cargoY=smoothstep(.620,.634,vBodyPosition.y)*(1.0-smoothstep(.825,.839,vBodyPosition.y));
      float cargoZ=smoothstep(-.105,-.088,vBodyPosition.z)*(1.0-smoothstep(.088,.105,vBodyPosition.z));
      float cargoOuter=smoothstep(.132,.153,side)*cargoY*cargoZ;
      float cargoInner=smoothstep(.132,.153,side)*smoothstep(.638,.651,vBodyPosition.y)*(1.0-smoothstep(.800,.813,vBodyPosition.y))*smoothstep(-.086,-.073,vBodyPosition.z)*(1.0-smoothstep(.073,.086,vBodyPosition.z));
      float cargoEdge=clamp(cargoOuter-cargoInner,0.0,1.0);
      float cargoFlap=smoothstep(.793,.804,vBodyPosition.y)*(1.0-smoothstep(.835,.844,vBodyPosition.y))*cargoZ*smoothstep(.132,.153,side);

      float rearX=1.0-smoothstep(.045,.057,abs(side-.100));
      float rearY=smoothstep(.900,.912,vBodyPosition.y)*(1.0-smoothstep(1.010,1.022,vBodyPosition.y));
      float rearPocket=rearX*rearY*backMask;
      float rearInner=(1.0-smoothstep(.037,.047,abs(side-.100)))*smoothstep(.915,.927,vBodyPosition.y)*(1.0-smoothstep(.985,.997,vBodyPosition.y))*backMask;
      float rearEdge=clamp(rearPocket-rearInner,0.0,1.0);
      float rearFlap=rearX*smoothstep(.987,.997,vBodyPosition.y)*(1.0-smoothstep(1.020,1.030,vBodyPosition.y))*backMask;
      float garmentLines=clamp(frontFly+handPocket+cargoEdge+cargoFlap+rearEdge+rearFlap,0.0,1.0);
      trouserSurface=mix(trouserSurface,trouserColor*.78,cargoOuter*.62+rearPocket*.55);
      trouserSurface=mix(trouserSurface,trouserColor*.42,garmentLines);
      diffuseColor.rgb=mix(mix(diffuseColor.rgb,shirtColor*(1.0-.09*max(collar,cuff)),shirt),trouserSurface,trousers);
      float tattooFrame=1.0-smoothstep(.98,1.0,max(abs(vTattooUv.x-.5),abs(vTattooUv.y-.5))*2.0);
      if(tattooFrame*vTattooMask*tattooStrength>0.001){
        vec2 uv=clamp(vTattooUv,0.0,1.0);
        // Preserve the complete source artwork. Transparent pixels (cosmos)
        // and white paper (cat) remain bare skin, including antialiased edges.
        vec4 artwork=vBodyPosition.x<0.0?texture2D(tattooCat,uv):texture2D(tattooAtom,uv);
        float pigment=min(artwork.r,min(artwork.g,artwork.b));
        float red=clamp((artwork.r-max(artwork.g,artwork.b))*2.5,0.0,1.0);
        vec3 inkColor=diffuseColor.rgb*mix(vec3(.15,.19,.18),vec3(.80,.055,.035),red);
        float ink=artwork.a*(1.0-smoothstep(.40,.96,pigment))*tattooFrame*vTattooMask*tattooStrength*(1.0-shirt)*(1.0-trousers);
        diffuseColor.rgb=mix(diffuseColor.rgb,inkColor,ink);
      }
      // Pigment below intact skin: no blood, cuts, displacement or wet gloss.
      diffuseColor.rgb=miloBruisedSkin(diffuseColor.rgb,vBruiseUv,vBruiseMask,
        bruiseStrength*(1.0-shirt)*(1.0-trousers));
    `).replace('#include <normal_fragment_maps>',`vec3 smoothBodyNormal=normal;
      #include <normal_fragment_maps>
      float trouserBumpMask=(1.0-smoothstep(1.065,1.085,vBodyPosition.y))*(1.0-smoothstep(.2,.5,vArmRegion));
      normal=normalize(mix(smoothBodyNormal,normal,trouserBumpMask));
    `).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.96,trousers);');
  };
  material.customProgramCacheKey=()=> 'milo-continuous-body-tshirt-trousers-tattoos-bruise-v23';
  const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='Continuous sample-based human body';
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;body.add(mesh);
  mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
  mesh.customDepthMaterial.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBodyPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBodyPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vBodyPosition;').replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      float neckline=1.563-.020*(vBodyPosition.z+.009)/max(length(vec2(vBodyPosition.x,vBodyPosition.z+.009)),.001);
      if(vBodyPosition.y>neckline)discard;
    `);
  };
  mesh.customDepthMaterial.customProgramCacheKey=()=> 'milo-shirt-neckline-shadow-v1';
  // Split only the distal thumb influence; the palm and thumb base keep their drivers.
  const indices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
  for(const {thumb,side} of arms){
    const prefix=side<0?'L':'R',baseIndex=data.bones.findIndex(b=>b.name===prefix+'_thumb');
    const tipIndex=bones.length,bone=new THREE.Bone();bone.name=`Milo skin ${prefix}_thumbIP`;
    thumb.userData.ip.add(bone);bones.push(bone);
    const target=new THREE.Vector3(...data.bones[baseIndex].target).add(thumb.userData.ip.position);target.y+=wristLift;
    inverses.push(new THREE.Matrix4().makeTranslation(-target.x,-target.y,-target.z));
    for(let i=0;i<surface.count;i++){
      const influences=Array.from({length:4},(_,k)=>({id:indices.array[i*4+k],weight:weights.array[i*4+k]}));
      const base=influences.find(p=>p.id===baseIndex&&p.weight>0);
      if(!base)continue;
      const bend=1-smooth(data.positions[i*3+1],.823,.838);
      if(bend===0)continue;
      influences.push({id:tipIndex,weight:base.weight*bend});base.weight*=1-bend;
      influences.sort((a,b)=>b.weight-a.weight);
      for(let k=0;k<4;k++){indices.array[i*4+k]=influences[k].id;weights.array[i*4+k]=influences[k].weight;}
    }
  }
  mesh.bind(new THREE.Skeleton(bones,inverses),new THREE.Matrix4());mesh.normalizeSkinWeights();
  for(const surface of legacy)surface.visible=false;
  root.userData.updateWristTwists=()=>{for(const {driver,hand,fraction}of wrists){
    // Spread the hand's offset and proportions across the forearm-to-palm blend.
    driver.position.copy(hand.position);driver.position.z*=fraction;
    driver.scale.set(1,1,1).lerp(hand.scale,fraction);
    driver.quaternion.identity().slerp(hand.quaternion,fraction);
  }};
  root.userData.bodySkin=mesh;root.userData.bodySource=data.source;return mesh;
}
