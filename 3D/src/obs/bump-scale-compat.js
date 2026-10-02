import {ShaderChunk} from 'three';

// three r158 made bumpScale independent of the texture's UV scale by
// normalising the surface derivatives (mrdoob/three.js#26899). Every cabin
// bumpScale was tuned against the earlier formula, so keep that formula: the
// look stays identical instead of re-tuning twenty materials by eye.
const r158='\t\tvec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );\n\t\tvec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );';
const r155='\t\tvec3 vSigmaX = dFdx( surf_pos.xyz );\n\t\tvec3 vSigmaY = dFdy( surf_pos.xyz );';
if(ShaderChunk.bumpmap_pars_fragment.includes(r158))ShaderChunk.bumpmap_pars_fragment=ShaderChunk.bumpmap_pars_fragment.replace(r158,r155);
else if(!ShaderChunk.bumpmap_pars_fragment.includes(r155))throw new Error('bump map shader chunk changed; review bumpScale values');
export const BUMP_SCALE_FORMULA='r155';
