# Exterior study: fictional S-01 system

This is an invented system in the outer region of an unnamed fictional galaxy.
Names and numbers are study settings, not additions to the manuscript canon.

## Physical model

The visible luminous star is at the coordinate origin and is the primary for
all four planetary orbits. Its mass is 0.8 solar masses, radius 556,560 km,
luminosity 0.4 solar, and illustrative temperature about 5,100 K (a warm K star).
The existing photographic glow and lens flare retain their artistic appearance;
the glow footprint is not the physical stellar diameter.

| Body | Existing surface sample | Radius km | Mass / Earth | Orbit AU | Axial period h | Orbit days |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| S-01 b | rust / rocky | 4,200 | 0.32 | 0.75 | 30 | 265.24 |
| S-01 c | current / ocean | 7,200 | 1.4 | 3.6 | 27 | 2,789.37 |
| S-01 d | ochre / gas | 58,000 | 105 | 1.35 | 11.4 | 640.43 |
| S-01 e | ice | 24,500 | 15 | 7.2 | 18 | 7,889.33 |

Orbit phase, node and inclination differ, so the bodies are not arranged in a
line. Gas and ocean exchange their orbital placements (radius, phase, node and
inclination); their own diameters, masses and surface samples stay with them.
Circular periods are calculated as `2 pi sqrt(a^3 / (mu_star + mu_planet))`.
The model uses independent circular Kepler orbits, not an N-body integration.
Inclinations are small (0 to 4 degrees); each spin axis has its own fixed tilt.
All elapsed time is measured from 2026-10-16 08:00 UTC at 1x and survives reloads.
There is no arbitrary annual revolution around the camera.

The ship orbits b at a centre distance of 13,600 km, altitude 9,400 km, with a
calculated period of about 7.7507 hours. Its physical observer position is the
sum of b's stellar orbit and this local orbit. The visual 2 m/s inspection cruise
is a separate local animation, not an interplanetary trajectory simulator.
Shared ship/camera origin resets have no effect on the ephemeris. Camera offsets
relative to the ship are converted from metres to kilometres for real parallax.

## Display

Positions stay in double precision kilometres. The sky renderer converts them
to angular proxies near the ship, avoiding enormous WebGL vertex coordinates.
Each disc obeys `sin(angular_radius) = physical_radius / observer_distance`.
The distant three planets are generally subpixel at the default field of view.
Their reflected light uses a small optical point-spread sprite, with relative
brightness from geometric albedo, Lambert phase, distance and stellar flux.
This is not an enlarged planetary disc. Fully occulted planets are hidden.
Planetary transits also attenuate the stellar glow, flare and direct ship light.
Planet surface normals and hull shadows use directions to the same central star.

The overview map uses a common linear distance scale for the orbital paths.
Its labelled body markers are explicitly symbols, not radius-scale discs.

### Optional visual emphasis study

The regular exterior study can switch between physical and enhanced apparent
sizes without resetting the observer camera. `planetScale=enhanced` persists
the study option in the URL. OBS opens the approved enhanced sizes together
with `panelLines=soft`; a standalone study without this option uses physical sizes.
The gas disc has a minimum apparent diameter of 0.5 degrees, the ocean disc
1.1 degrees, and the ice disc 0.35 degrees. Gas and ocean also exchange their
apparent sizes, making the ocean disc larger. The nearby rocky planet is unchanged.
Only render scales and unresolved-point visibility change. Orbital positions,
time, source lighting, physical transit checks and the system map retain the
same physical settings. This deliberately enlarged view is not a physical size
comparison. Direction buttons let the user inspect each disc beside the ship.

## Reference for mechanics and constants

- NASA: https://science.nasa.gov/solar-system/orbits-and-keplers-laws/
- JPL DE440 gravitational parameters and IAU astronomical unit:
  https://ssd.jpl.nasa.gov/astro_par.html

These references supply mechanics and constants, not the invented system values.
