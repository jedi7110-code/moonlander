export function cinemaMessageAccepted(event,frame,origin){
  return event.origin===origin&&event.source===frame.contentWindow&&event.data?.type==='tara-exterior';
}
export function shouldPlayExteriorOpening(search){
  const query=new URLSearchParams(search);
  return !query.has('preview')&&query.get('opening')!=='0';
}
