import {ExteriorCinemaUI} from './exterior-cinema-ui.js';

// Shared by the tiny entry point and the cabin. The exterior can start before
// the cabin's Three.js, character models and audio have finished loading.
export const exteriorCinema=new ExteriorCinemaUI({parent:document.getElementById('observation')});
