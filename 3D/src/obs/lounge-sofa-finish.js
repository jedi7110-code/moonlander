import {BoxGeometry,BufferGeometry,CylinderGeometry,ExtrudeGeometry,Float32BufferAttribute,Group,Mesh,Path,Shape,Vector2,Vector3} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createLoungeTitanium} from './machined-metals.js';

// The approved profile is shared by the live cabin and the orbit study.
// Coordinates below are [depth, height]; +depth faces the aisle.
function extrudeProfile(shape,width,curveSegments=3){
  const bevel=.006,geometry=new ExtrudeGeometry(shape,{depth:width-bevel*2,steps:1,curveSegments,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1});
  geometry.translate(0,0,-(width-bevel*2)/2);geometry.rotateY(-Math.PI/2);
  return geometry;
}

function roundedOutline(points,radius){
  const corners=points.map(point=>new Vector2(...point)),shape=new Shape();
  for(let i=0;i<corners.length;i++){
    const corner=corners[i],previous=corners[(i+corners.length-1)%corners.length],next=corners[(i+1)%corners.length];
    const rounding=Math.min(radius,corner.distanceTo(previous)*.3,corner.distanceTo(next)*.3);
    const entry=corner.clone().add(previous.clone().sub(corner).setLength(rounding));
    const exit=corner.clone().add(next.clone().sub(corner).setLength(rounding));
    if(i===0)shape.moveTo(entry.x,entry.y);else shape.lineTo(entry.x,entry.y);
    shape.quadraticCurveTo(corner.x,corner.y,exit.x,exit.y);
  }
  shape.closePath();
  return shape;
}

function profileGeometry(points,width,radius=.012){
  return extrudeProfile(roundedOutline(points,radius),width);
}

function recessedSideGeometry(profile){
  // Pressed pockets on both faces leave a central web, like an aircraft rib.
  const pockets=[
    {
      rim:[[-.590,.415],[-.515,.352],[.055,.352],[.210,.491],[.210,.695],[-.470,.695],[-.590,.606]],
      floor:[[-.558,.433],[-.503,.391],[.044,.391],[.174,.508],[.174,.660],[-.463,.660],[-.558,.591]],
      holes:[-.405,-.165,.075]
    },
    {
      rim:[[-.455,.048],[.123,.048],[.045,.113],[.045,.198],[-.455,.198]],
      floor:[[-.424,.076],[.044,.076],[.011,.100],[.011,.170],[-.424,.170]],
      holes:[]
    }
  ];
  const frame=roundedOutline(profile,.012),webs=[],positions=[];
  const triangle=(a,b,c)=>positions.push(...a,...b,...c);
  for(const pocket of pockets){
    const rim=roundedOutline(pocket.rim,.012),floor=roundedOutline(pocket.floor,.012);
    frame.holes.push(rim);
    for(const depth of pocket.holes){
      const hole=new Path();hole.absarc(depth,.515,.054,0,Math.PI*2,true);
      floor.holes.push(hole);
    }
    webs.push(extrudeProfile(floor,.044,10));
    const outer=rim.getPoints(3),inner=floor.getPoints(3);
    // Sloped shoulders connect the outer flange to the recessed web. Both
    // sides share the same section; the holes pass through the thin web.
    for(const side of[-1,1])for(let i=0;i<outer.length-1;i++){
      const a=[side*.080,outer[i].y,outer[i].x];
      const b=[side*.080,outer[i+1].y,outer[i+1].x];
      const c=[side*.022,inner[i+1].y,inner[i+1].x];
      const d=[side*.022,inner[i].y,inner[i].x];
      if(side>0){triangle(a,c,b);triangle(a,d,c);}
      else{triangle(a,b,c);triangle(a,c,d);}
    }
  }
  const shoulders=new BufferGeometry();
  const uvs=[];for(let i=0;i<positions.length;i+=3)uvs.push(positions[i+2],positions[i+1]);
  shoulders.setAttribute('position',new Float32BufferAttribute(positions,3));
  shoulders.setAttribute('uv',new Float32BufferAttribute(uvs,2));
  shoulders.computeVertexNormals();
  const web=mergeGeometries(webs);webs.forEach(geometry=>geometry.dispose());
  return {frame:extrudeProfile(frame,.16),shoulders,web};
}

function addSideFasteners(arm,metal,slotMaterial){
  const geometry=new CylinderGeometry(.009,.009,.003,8);geometry.rotateZ(Math.PI/2);
  const slotGeometry=new BoxGeometry(.0008,.002,.011);
  // Small flush fasteners at the flange corners keep the construction legible.
  for(const side of[-1,1])for(const [depth,height]of[[-.635,.445],[.248,.526],[-.490,.220],[.154,.021]]){
    const screw=new Mesh(geometry,metal);screw.name='Study leg flush fastener';
    screw.position.set(side*.081,height,depth);arm.add(screw);
    const slot=new Mesh(slotGeometry,slotMaterial);slot.name='Study leg fastener slot';
    slot.position.set(side*.083,height,depth);slot.rotation.x=depth*3+height;
    arm.add(slot);
  }
}

function chamferedBackGeometry(){
  const bevel=.014,halfWidth=4.03/2-bevel,halfHeight=.84/2-bevel,cut=.20;
  const shape=roundedOutline([
    [-halfWidth,-halfHeight],[halfWidth,-halfHeight],
    [halfWidth,halfHeight-cut],[halfWidth-cut,halfHeight],
    [-halfWidth+cut,halfHeight],[-halfWidth,halfHeight-cut]
  ],.018);
  const depth=.36-bevel*2;
  const geometry=new ExtrudeGeometry(shape,{depth,steps:1,curveSegments:3,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2});
  geometry.translate(0,0,-depth/2);
  return geometry;
}

function returnedSeatGeometry(){
  const shape=new Shape();
  shape.moveTo(-.40,.46);shape.quadraticCurveTo(-.40,.48,-.38,.48);
  shape.lineTo(.26,.48);
  // One continuous upholstered edge: overhang, downward roll, then a short
  // return toward the recessed legs. Keep the inner opening visible in profile.
  shape.quadraticCurveTo(.34,.48,.348,.43);
  shape.quadraticCurveTo(.366,.345,.308,.278);
  shape.quadraticCurveTo(.29,.259,.261,.271);
  shape.lineTo(.225,.291);shape.quadraticCurveTo(.217,.299,.228,.311);
  shape.lineTo(.275,.351);shape.quadraticCurveTo(.281,.359,.267,.360);
  shape.lineTo(-.38,.32);shape.quadraticCurveTo(-.40,.32,-.40,.34);
  shape.closePath();
  return extrudeProfile(shape,3.98,8);
}

function armCushionGeometry(){
  // A soft saddle over the metal arm: a thin crown and two short side skirts.
  // The open underside seats around the existing plate, instead of filling it.
  const shape=new Shape();
  shape.moveTo(-.105,-.134);shape.quadraticCurveTo(-.120,-.134,-.120,-.122);
  shape.lineTo(-.120,-.080);shape.lineTo(-.122,-.012);
  shape.quadraticCurveTo(-.122,.034,-.105,.041);shape.quadraticCurveTo(-.080,.050,-.060,.050);
  shape.lineTo(.060,.050);shape.quadraticCurveTo(.080,.050,.105,.041);
  shape.quadraticCurveTo(.122,.034,.122,-.012);
  shape.lineTo(.120,-.080);shape.lineTo(.120,-.122);
  shape.quadraticCurveTo(.120,-.134,.105,-.134);shape.lineTo(.094,-.134);
  shape.quadraticCurveTo(.084,-.134,.082,-.120);shape.lineTo(.077,-.080);
  shape.lineTo(.077,-.004);shape.quadraticCurveTo(.077,.009,.059,.009);
  shape.lineTo(-.059,.009);shape.quadraticCurveTo(-.077,.009,-.077,-.004);
  shape.lineTo(-.077,-.080);shape.lineTo(-.082,-.120);
  shape.quadraticCurveTo(-.084,-.134,-.094,-.134);shape.closePath();
  const bevel=.007,depth=.64-bevel*2;
  const geometry=new ExtrudeGeometry(shape,{depth,steps:1,curveSegments:3,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2});
  geometry.translate(0,0,-depth/2);
  // Cut both lower ends of the hanging sides on a diagonal. Keep the upper
  // arm contact soft while giving the skirt the angular outline of the sketch.
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const cut=Math.max(0,-.080-positions.getY(i))*1.25;
    const z=positions.getZ(i);
    positions.setZ(i,z-Math.sign(z)*cut);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function infillCushionGeometry(points){
  const thickness=.065,bevelDepth=.010,depth=thickness-bevelDepth*2;
  const geometry=new ExtrudeGeometry(roundedOutline(points,.035),{
    depth,steps:1,curveSegments:5,bevelEnabled:true,
    bevelSize:.015,bevelThickness:bevelDepth,bevelSegments:3
  });
  geometry.translate(0,0,-depth/2);
  return geometry;
}

function addBackrestInfill(sofa,m,mainCushions,centerX){
  const add=(geometry,x)=>{
    const cushion=new Mesh(geometry,m.olive);cushion.name='Study backrest infill cushion';
    // Sit against the same backing, just below the main pads' front surface.
    cushion.position.set(x,0,-.308);cushion.castShadow=true;cushion.receiveShadow=true;
    sofa.add(cushion);
  };
  // Follow the shoulders and tapered lower edges of the neighboring hexagons.
  const upper=infillCushionGeometry([[-.24,1.13],[.24,1.13],[.12,.94],[-.12,.94]]);
  const lower=infillCushionGeometry([[-.14,.84],[.14,.84],[.255,.575],[-.255,.575]]);
  for(let i=1;i<mainCushions.length;i++){
    const x=(mainCushions[i-1].position.x+mainCushions[i].position.x)/2;
    add(upper,x);add(lower,x);
  }
  // End pads also follow the chamfered back shell; mirror around its center.
  const endUpper=[[-1.74,1.14],[-1.55,1.14],[-1.70,.98],[-1.90,.98]];
  const endLower=[[-1.90,.845],[-1.68,.845],[-1.52,.575],[-1.88,.575]];
  for(const side of[-1,1])for(const points of[endUpper,endLower]){
    add(infillCushionGeometry(points.map(([x,y])=>[x*side,y])),centerX);
  }
}

export function finishLoungeSofa(sofa,m){
  const arms=[];sofa.traverse(part=>{if(part.name==='Sofa floor-reaching arm')arms.push(part);});
  const sideProfile=[[-.70,.30],[-.70,.66],[-.50,.79],[.27,.79],[.30,.75],[.30,.45],[.10,.24],[.10,.12],[.22,.04],[.22,-.015],[-.53,-.015],[-.53,.18]];
  const sideGeometry=recessedSideGeometry(sideProfile);
  const titanium=createLoungeTitanium();
  const webMetal=titanium.clone();webMetal.name='Study sofa / recessed titanium web';
  webMetal.defines={...titanium.defines};
  webMetal.color.setHex(0x818987);webMetal.roughness=.63;
  for(const arm of arms){
    arm.geometry=sideGeometry.frame;arm.position.set(arm.position.x,0,0);
    arm.material=titanium;
    const shoulders=new Mesh(sideGeometry.shoulders,titanium);shoulders.name='Study leg pressed shoulders';
    const web=new Mesh(sideGeometry.web,webMetal);web.name='Study leg recessed web with lightening holes';
    for(const part of[shoulders,web]){part.castShadow=true;part.receiveShadow=true;arm.add(part);}
    addSideFasteners(arm,webMetal,m.dark);
  }
  // Continue the same front recess and flared foot across the black plinth.
  const base=sofa.getObjectByName('Sofa floor plinth');
  // Terminate between the side plates; overlapping their matching front faces
  // would put two materials on the same plane along the recessed step.
  base.geometry=profileGeometry([[-.70,.40],[.252,.40],[.10,.24],[.10,.12],[.22,.04],[.22,-.015],[-.53,-.015],[-.53,.18],[-.70,.30]],4.01);
  base.position.set(7.405,0,0);

  const seat=sofa.getObjectByName('Sofa seat');
  seat.geometry=returnedSeatGeometry();
  seat.name='Study seat with returned front edge';seat.position.set(7.4,0,0);
  // A slightly lighter, warmer sage separates the horizontal seat from the
  // original deep-green back. Share the upholstery maps, not its colour state.
  seat.material=m.cushion.clone();seat.material.name='Lounge sofa / sage seat upholstery';
  seat.material.color.setHex(0x58675f);

  const back=sofa.getObjectByName('Sofa backrest');
  back.geometry=chamferedBackGeometry();
  const mainCushions=sofa.children.filter(part=>part.name==='Sofa hexagonal cushion').sort((a,b)=>a.position.x-b.position.x);
  const centerShift=back.position.x-(mainCushions[0].position.x+mainCushions.at(-1).position.x)/2;
  for(const cushion of mainCushions)cushion.position.x+=centerShift;
  addBackrestInfill(sofa,m,mainCushions,back.position.x);

  const armPadding=armCushionGeometry();
  for(const arm of arms){
    const cushion=new Mesh(armPadding,m.olive);cushion.name='Study wraparound arm cushion';
    cushion.position.set(arm.position.x,.79,-.09);
    cushion.castShadow=true;cushion.receiveShadow=true;sofa.add(cushion);
  }

  // Tilt the back and its thin pads together about the lower seating contact.
  const reclined=new Group(),pivot=new Vector3(7.4,.42,-.34);
  reclined.name='Study reclining back';reclined.position.copy(pivot);
  for(const part of [...sofa.children])if(part.name==='Sofa backrest'||part.name==='Sofa hexagonal cushion'||part.name==='Study backrest infill cushion'){
    part.position.sub(pivot);reclined.add(part);
  }
  reclined.rotation.x=-Math.PI/18;sofa.add(reclined);
  return sofa;
}
