const sessionClock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23'});
const runway={1800:600,3600:1200,5400:1800,23400:2700};

// In full-day mode, show the open and follow the actual latest observation.
// Shorter selections count their duration backwards from the padded right edge.
export function orderflowViewport({latestTime,period=23400}={}){
 if(!Number.isFinite(latestTime)||latestTime<=0||!Number.isFinite(period)||period<=0)return {};
 const parts=Object.fromEntries(sessionClock.formatToParts(new Date(latestTime)).map(part=>[part.type,part.value]));
 const midnight=Math.floor(latestTime/1000)*1000-(Number(parts.hour)*3600+Number(parts.minute)*60+Number(parts.second))*1000;
 const open=midnight+34200000,close=midnight+57600000;
 const endTime=Math.min(latestTime,close)+(runway[period]??300)*1000;
 const startTime=period===23400?open-900000:endTime-period*1000;
 return endTime>startTime?{startTime,endTime}:{};
}
