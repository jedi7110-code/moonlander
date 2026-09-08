// Compact silhouettes for the cabin's two-color chess set.
const shapes={
  p:'<circle cx="32" cy="17" r="8"/><path d="M27 25h10l-2 9 5 12H24l5-12z"/>',
  r:'<path d="M18 11h7v8h5v-8h5v8h5v-8h7v16l-7 5 1 14H23l1-14-6-5z"/><path d="M24 28h16" fill="none"/>',
  n:'<path d="M21 46c0-10 8-16 16-21l-6-2-7 9-9-4 5-10 10-8 2-7 7 6 7 9c6 10 3 20-1 28z"/><path d="M36 14l2 3M18 27l6 1M40 24c4 6 3 13 0 17" fill="none"/>',
  b:'<path d="M32 6c-7 7-12 11-12 17 0 6 5 9 12 9s12-3 12-9c0-6-5-10-12-17z"/><path d="M35 13l-7 11" fill="none"/><path d="M26 32h12l-2 6 5 8H23l5-8z"/>',
  q:'<path d="M19 18l4 20h18l4-20-9 10-4-14-4 14zM24 38h16l2 8H22z"/><circle cx="18" cy="16" r="3"/><circle cx="32" cy="11" r="3"/><circle cx="46" cy="16" r="3"/>',
  k:'<path d="M32 4v13M26 9h12" fill="none" stroke-width="4"/><path d="M32 23c-3-11-16-8-16 0 0 7 7 9 9 15h14c2-6 9-8 9-15 0-8-13-11-16 0zM25 38h14l3 8H22z"/><path d="M32 23v10" fill="none"/>'
};
export function pieceSVG(type,color){
  return `<svg class="chess-piece ${color==='w'?'ivory':'carbon'}" viewBox="0 0 64 64" aria-hidden="true"><g stroke-linejoin="round" stroke-linecap="round" stroke-width="2.2">${shapes[type]}<path d="M22 46h20l3 5v5H19v-5z"/><path d="M20 51h24" fill="none"/></g></svg>`;
}
