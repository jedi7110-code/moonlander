// Shared physical spin: a 200m outer floor circumference produces 1g.
// Kept independent of exterior geometry so the cabin need not import it.
const circumference=200,radius=circumference/(2*Math.PI),radiansPerSecond=Math.sqrt(9.80665/radius);
export const HABITAT_ROTATION=Object.freeze({circumference,radius,radiansPerSecond,
  rpm:radiansPerSecond*30/Math.PI,periodSeconds:2*Math.PI/radiansPerSecond});
// The inertial sky turns in the opposite direction in the rotating cabin.
export const cabinSkyAngle=seconds=>-((seconds%HABITAT_ROTATION.periodSeconds)/HABITAT_ROTATION.periodSeconds)*2*Math.PI;
