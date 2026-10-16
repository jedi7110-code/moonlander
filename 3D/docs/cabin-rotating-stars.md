# Cabin window stars

OBS window stars now counter-rotate around the cabin's longitudinal X axis at
the same physical spin rate as the external habitat: approximately 5.3004 RPM,
one turn in 11.32 seconds. `habitat-rotation.js` holds the common 200m / 1g
reference, independent of the lazy exterior model and planetary system.

The corridor, rear windows and cutaway use the same deterministic 6,000-star
full-sphere catalogue. They share `scene.userData.cabinSkySeconds`, set from the
existing simulation time before rendering. Pausing freezes them; mirrored and
XR render passes receive the same phase. The sphere turns rather than scrolling
a finite image, so there is no texture edge or discontinuity at a full turn.
Camera translation and deck changes retain the same distant constellations.

Only transforms change each frame: no star generation, buffer uploads, textures
or extra draw calls. The rotating fields submit their complete 6,000 points
instead of the stationary hemisphere slice; the existing shader still clips
stars to real windows, and opaque furnishings keep their depth occlusion.
No planet, stellar lens flare or exterior lighting is added inside the cabin.
