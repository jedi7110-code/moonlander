import * as THREE from 'three';

// Metres, Y up, front +Z. Landmarks reconstructed from the supplied front
// figure and checked against its side projection, not copied mesh vertices.
export const EVA_BODY={
  neck:[0,1.655,-.045],
  shoulder:[.224,1.502,-.064],elbow:[.316,1.260,-.066],wrist:[.361,1.013,.044],
  hip:[.108,1.070,-.060],knee:[.140,.591,-.021],ankle:[.155,.174,-.102],
};
export const mirrored=(point,side)=>new THREE.Vector3(point[0]*side,point[1],point[2]);

export function armFrame(side){
  const wrist=mirrored(EVA_BODY.wrist,side),elbow=mirrored(EVA_BODY.elbow,side);
  const up=elbow.clone().sub(wrist).normalize();
  const dorsal=new THREE.Vector3(side*.94,0,-.34);
  dorsal.addScaledVector(up,-dorsal.dot(up)).normalize();
  const across=up.clone().cross(dorsal).normalize();
  return {wrist,up,dorsal,quaternion:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,up,dorsal))};
}

function valueAt(profile,t,column){
  let i=0;while(i<profile.length-2&&t>profile[i+1][0])i++;
  const a=profile[i],b=profile[i+1],u=THREE.MathUtils.clamp((t-a[0])/(b[0]-a[0]),0,1);
  const before=profile[Math.max(0,i-1)],after=profile[Math.min(profile.length-1,i+2)];
  const ma=(b[column]-before[column])/(b[0]-before[0]),mb=(after[column]-a[column])/(after[0]-a[0]);
  return (2*u**3-3*u*u+1)*a[column]+(u**3-2*u*u+u)*ma*(b[0]-a[0])+(-2*u**3+3*u*u)*b[column]+(u**3-u*u)*mb*(b[0]-a[0]);
}

export function tailoredTube(parent,material,points,profile,{rows=64,columns=40,folds=[],name='Tailored pressure garment'}={}){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>p.isVector3?p:new THREE.Vector3(...p)),false,'centripetal');
  const vertices=[],uvs=[],indices=[];
  for(let row=0;row<=rows;row++){
    const t=row/rows,p=curve.getPoint(t),tangent=curve.getTangent(t);
    const across=new THREE.Vector3(1,0,0).addScaledVector(tangent,-tangent.x).normalize();
    const depth=across.clone().cross(tangent).normalize();
    for(let col=0;col<=columns;col++){
      const a=col/columns*Math.PI*2;
      let wrinkle=0;
      for(const [joint,spread,strength]of folds)wrinkle+=strength*Math.exp(-(((t-joint)/spread)**2))*Math.sin(t*145+Math.sin(a*2)*1.4);
      const width=Math.max(.001,valueAt(profile,t,1)+wrinkle),thickness=Math.max(.001,valueAt(profile,t,2)+wrinkle);
      const v=p.clone().addScaledVector(across,Math.cos(a)*width).addScaledVector(depth,Math.sin(a)*thickness);
      vertices.push(...v);uvs.push(col/columns,t);
      if(row<rows&&col<columns){const n=row*(columns+1)+col;indices.push(n,n+columns+1,n+1,n+1,n+columns+1,n+columns+2);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const holder=new THREE.Group(),mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;holder.add(mesh);parent.add(holder);return mesh;
}

export function buildTailoredBody(parent,m){
  tailoredTube(parent,m.evaCloth,[[0,1.647,-.044],[0,1.480,-.060],[0,1.275,-.052],[0,1.147,-.054]],
    [[0,.114,.091],[.16,.171,.119],[.35,.211,.139],[.62,.190,.129],[.84,.179,.117],[1,.196,.130]],{folds:[[.83,.11,.0014]]});
  for(const side of [-1,1]){
    tailoredTube(parent,m.evaCloth,[[side*.130,1.572,-.055],mirrored(EVA_BODY.shoulder,side),mirrored(EVA_BODY.elbow,side),mirrored(EVA_BODY.wrist,side)],
      [[0,.037,.047],[.26,.073,.083],[.40,.085,.091],[.64,.077,.083],[.72,.070,.076],[.85,.074,.078],[1,.060,.062]],{folds:[[.68,.085,.0023]]});
  }
  // Both upper leg rings share one curved crotch seam and one waist opening.
  const positions=[],uvs=[],indices=[],rows=64,columns=48;
  for(const side of [-1,1]){
    const offset=positions.length/3;
    const curve=new THREE.CatmullRomCurve3([mirrored(EVA_BODY.ankle,side),mirrored(EVA_BODY.knee,side),mirrored(EVA_BODY.hip,side)],false,'centripetal');
    for(let row=0;row<=rows;row++){
      const t=row/rows,p=curve.getPoint(t),hip=THREE.MathUtils.smoothstep(t,.56,1);
      const radius=valueAt([[0,.066],[.24,.089],[.46,.084],[.65,.097],[.83,.113],[1,.109]],t,1);
      for(let col=0;col<=columns;col++){
        const a=col/columns*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
        const x=Math.max(.026*(1-hip),THREE.MathUtils.lerp(Math.abs(p.x)+radius*c,.198*Math.max(0,c),hip));
        const y=THREE.MathUtils.lerp(p.y,1.158,hip)-(c<0?.254*hip*(1-Math.abs(s)**6):0);
        const gather=.0020*Math.exp(-(((t-.46)/.085)**2))*Math.sin(t*150+s*2);
        const z=THREE.MathUtils.lerp(p.z,-.054,hip)+s*(THREE.MathUtils.lerp(radius*1.09,.135,hip)+gather);
        positions.push(side*x,y,z);uvs.push(col/columns,t);
        if(row<rows&&col<columns){const n=offset+row*(columns+1)+col,b=n+1,d=n+columns+1,e=d+1;indices.push(...(side===1?[n,d,b,b,d,e]:[n,b,d,b,e,d]));}
      }
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const holder=new THREE.Group(),mesh=new THREE.Mesh(geometry,m.evaCloth);mesh.name='Tailored pressure garment';mesh.castShadow=true;mesh.receiveShadow=true;holder.add(mesh);parent.add(holder);
}
