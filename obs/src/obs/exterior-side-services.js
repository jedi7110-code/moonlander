import * as THREE from 'three';

export function addExteriorSideServices(parent,{surfaces,materials,addMesh,box,chamferBox}){
  parent.updateWorldMatrix(true,false);surfaces.forEach(surface=>surface.updateWorldMatrix(true,false));
  const inverse=parent.matrixWorld.clone().invert(),modules=[],routes=[],connections=[],cartridges=[];
  const surfaceAt=(axial,angle,clearance=0)=>{
    const radial=new THREE.Vector3(0,Math.cos(angle),Math.sin(angle));
    const origin=parent.localToWorld(new THREE.Vector3(axial,radial.y*14,radial.z*14));
    const direction=radial.clone().negate().transformDirection(parent.matrixWorld);
    const hit=new THREE.Raycaster(origin,direction,0,32).intersectObjects(surfaces,false)[0];
    if(!hit)throw new Error('Exterior service has no pressure hull bearing surface');
    const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld).transformDirection(inverse);
    return {point:hit.point.clone().applyMatrix4(inverse).addScaledVector(normal,clearance),normal};
  };
  const seat=(axial,angle,name)=>{
    const {point,normal}=surfaceAt(axial,angle),side=Math.sign(Math.sin(angle));
    const horizontal=new THREE.Vector3(side,0,0).addScaledVector(normal,-side*normal.x).normalize();
    const vertical=new THREE.Vector3().crossVectors(normal,horizontal).normalize();
    const group=new THREE.Group();group.name=name;group.position.copy(point);
    group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(horizontal,vertical,normal));
    group.userData.panelDetailExclude=true;parent.add(group);return group;
  };
  const module=(axial,angle,role,width,height)=>{
    const group=seat(axial,angle,role);
    group.userData.externalService={role,side:Math.sign(Math.sin(angle)),width,height};modules.push(group);
    chamferBox(group,materials.steel,[0,0,.045],[width,height,.12],role+' bearing frame');
    chamferBox(group,materials.dark,[0,0,.105],[width-.12,height-.12,.10],role+' recessed casing');
    for(const horizontal of [-1,1])for(const vertical of [-1,1]){
      box(group,materials.pipe,[horizontal*(width/2-.09),vertical*(height/2-.09),.12],[.055,.055,.04],role+' anchor bolt');
    }
    group.updateWorldMatrix(true,false);return group;
  };
  const port=(axial,angle,name)=>{
    const group=seat(axial,angle,name);
    const geometry=new THREE.CylinderGeometry(.115,.115,.26,6);geometry.rotateX(Math.PI/2);
    addMesh(group,geometry,materials.steel,name+' bulkhead coupling',[0,0,.10]);
    connections.push(group);
    return surfaceAt(axial,angle,.18).point;
  };
  const clamp=(axial,angle,name)=>{
    const group=seat(axial,angle,name);box(group,materials.steel,[0,0,.10],[.12,.17,.22],name+' seated restraint');
  };
  const run=(name,points,radius,material,terminals)=>{
    for(let index=1;index<points.length;index++){
      const start=points[index-1],end=points[index],direction=end.clone().sub(start);
      const geometry=new THREE.CylinderGeometry(radius,radius,direction.length()+radius*2,6,1,true);
      const segment=addMesh(parent,geometry,material,name,start.clone().add(end).multiplyScalar(.5).toArray());
      segment.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
    }
    routes.push({name,points:points.map(point=>point.toArray()),radius,terminals});
  };
  const localPoint=(group,position)=>new THREE.Vector3(...position).applyMatrix4(group.matrix);
  for(const side of [-1,1]){
    for(let index=0;index<5;index++){
      const cartridge=seat(-6.5+index*.55,side*Math.atan2(3,.62),'Bearing service cartridge / '+index);
      cartridge.userData.serviceCartridge={side,index,width:.45,height:.85};cartridges.push(cartridge);
      box(cartridge,materials.dark,[0,0,.085],[.45,.85,.20],'Bearing auxiliary cartridge housing');
      box(cartridge,materials.pipe,[0,0,.205],[.18,.62,.09],'Replaceable bearing service cartridge');
    }
    const thermalAngle=side*Math.PI/4;
    const thermal=module(-8.05,thermalAngle,'Aft thermal pump service bay',1.02,.76);
    box(thermal,materials.patch,[-.23,0,.18],[.30,.49,.09],'Thermal pump removable cartridge');
    for(const height of [-.20,0,.20])box(thermal,materials.pipe,[.18,height,.18],[.31,.055,.10],'Pump controller cooling fin');
    for(const [lane,offset]of [-.14,.14].entries()){
      const angle=thermalAngle+side*offset;
      const start=port(-7.05,angle,'Aft thermal circuit / '+lane);
      const points=[start,surfaceAt(-7.35,angle,.18).point,localPoint(thermal,[side*.49,offset,.18])];
      run('Thermal supply and return / '+side+' / '+lane,points,.055,materials.pipe,['aft bulkhead union','thermal pump']);
      clamp(-7.25,angle,'Thermal circuit clamp');
    }
    const cabinet=module(1.95,side*(Math.PI/2-.08),'Airlock power and control cabinet',1.08,.86);
    box(cabinet,materials.patch,[-.17,0,.18],[.50,.57,.08],'Airlock power removable cover');
    for(const height of [-.20,0,.20])box(cabinet,materials.pipe,[.31,height,.18],[.16,.04,.07],'Airlock controller cooling slot');
    const powerAngle=side*(Math.PI/4+.20);
    const controlPoints=[localPoint(cabinet,[0,.44,.18]),surfaceAt(1.95,side*(Math.PI/2-.30),.18).point,
      surfaceAt(2.02,side*3*Math.PI/8,.23).point,surfaceAt(2.18,powerAngle,.18).point,
      surfaceAt(4.0,powerAngle,.18).point,new THREE.Vector3(4.0,1.17,side*3.22)];
    run('Airlock power and data / '+side,controlPoints,.055,materials.steel,['airlock controller','fixed airlock frame']);
    clamp(2.65,powerAngle,'Airlock upper-chine cable clamp');clamp(3.55,powerAngle,'Airlock upper-chine cable clamp');
    const manifold=module(6.65,side*3*Math.PI/4,'Forward coolant isolation manifold',.62,.64);
    for(const height of [-.17,.17]){
      const valve=new THREE.CylinderGeometry(.10,.10,.14,8);valve.rotateX(Math.PI/2);
      addMesh(manifold,valve,materials.pipe,'Coolant isolation valve',[0,height,.19]);
      box(manifold,materials.steel,[0,height,.28],[.22,.055,.045],'Coolant valve manual lever');
    }
    for(const [lane,offset]of [.27,.35].entries()){
      const angle=side*(3*Math.PI/4-offset);
      const outlet=port(8.48,angle,'Forward coolant internal crossover / '+lane);
      const points=[localPoint(manifold,[side*.31,lane===0?.16:-.16,.18]),surfaceAt(6.99,angle,.18).point,surfaceAt(7.15,angle,.18).point,
        surfaceAt(7.7,angle,.18).point,outlet];
      run('Forward coolant feed / '+side+' / '+lane,points,.05,materials.pipe,['isolation manifold','internal collar crossover']);
      clamp(7.15,angle,'Lower-chine coolant clamp');clamp(8.15,angle,'Lower-chine coolant clamp');
      const bridgeAngle=side*(3*Math.PI/4-.12-lane*.08);
      const inlet=port(9.35,bridgeAngle,'Bridge coolant internal crossover / '+lane),end=port(12.65,bridgeAngle,'Command systems coolant union / '+lane);
      const bridgePoints=[inlet,...[10.4,11.0,12.0].map(axial=>surfaceAt(axial,bridgeAngle,.18).point),end];
      run('Command coolant feed / '+side+' / '+lane,bridgePoints,.05,materials.pipe,['internal collar crossover','command systems bulkhead']);
      clamp(10.65,bridgeAngle,'Command lower-chine coolant clamp');clamp(12.1,bridgeAngle,'Command lower-chine coolant clamp');
    }
  }
  return {modules,routes,connections,cartridges};
}
