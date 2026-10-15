import {callParkingTool} from '../../lib/parking-tools.js';
import {STATIONS,nearbyMessage} from '../../lib/nearby.js';
import {json,permit,validOrigin} from '../../lib/http.js';
export async function onRequestGet({request,env}){
 if(!validOrigin(request))return json({ok:false,error:'이 사이트에서 검색해주세요.'},403);
 const url=new URL(request.url);
 if(!url.searchParams.has('station'))return json({stations:STATIONS.map(({name,lines})=>({name,lines})),scope:'부산도시철도 1~4호선',sourceDate:'2021-02-26'});
 if(!permit(request,'nearby',20,100))return json({ok:false,error:'요청이 많습니다. 1분 후 다시 검색해주세요.'},429,{'Retry-After':'60'});
 try{
  const args={station:url.searchParams.get('station'),radiusMeters:Number(url.searchParams.get('radius')||1000),limit:10};
  const result=await callParkingTool('find_nearby_parking',args,env);
  return json({ok:true,result,message:nearbyMessage(result)});
 }catch(error){return json({ok:false,error:error.message==='invalid_arguments'?'역 이름과 반경(100~5000m)을 확인해주세요.':'주변 주차장 검색이 지연되고 있습니다. 잠시 후 다시 확인해주세요.'},error.message==='invalid_arguments'?400:503);}
}
