export function healthDisplay(health,{lang='ja',medical=false,exam=false}={}){
  const words=(ja,en)=>lang==='ja'?ja:en,stage=health.stage,course=health.treatment;
  const states={healthy:['良好','Normal'],warning:['要手当て','Needs treatment'],urgent:['悪化','Deteriorating'],critical:['緊急','Critical'],treating:['治療中','Treating'],recovering:['回復中','Recovering']};
  const symptom=health.condition?.kind==='injury'?words('左腕の怪我','Left arm injury'):health.condition?words('発熱','Fever'):words('健康状態','Health');
  const label=stage==='treating'?words('治療','Care'):stage==='recovering'?words('回復','Recovery'):health.condition?.kind==='injury'?words('怪我','Injury'):health.condition?words('発熱','Fever'):words('健康','Health');
  const seconds=course?Math.max(0,Math.ceil(course.duration-course.elapsed)):0;
  const detail=course?words(`処置完了まで ${seconds}秒`,`Treatment completes in ${seconds}s`):exam?words('健康状態を測定中','Checking vital signs'):medical?words('医療区画へ移動中','En route to medical bay'):stage==='recovering'?words('処置済み。経過観察中','Treated. Under observation'):health.critical?words('作業中止・医療区画へ移動','Work stopped. Medical care required'):health.urgent?words('移動能力が低下','Mobility reduced'):health.condition?words('症状が続いている','Symptoms persist'):words('異常は見られない','No symptoms detected');
  const treatmentLabel=medical?(course?words('治療中','Treating'):exam?words('健診中','Checking'):words('移動中','En route')):words('医療区画へ','Medical bay');
  return {stage,label,title:`${symptom} / ${words(...states[stage])}`,detail,treatmentLabel};
}
