import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import Chart from "@/components/Chart";
import {defaultChartSettings} from "@/lib/chartSettings";
const candles=Array.from({length:120},(_,i)=>({timestamp:1793700000000+i*60000,open:28000,close:28000+i%10,high:28020,low:27990,volume:100}));
function Fixture(){
  const [state,setState]=useState({width:900,height:650,multiple:true});
  (window as any).setStatusFixture=setState;
  return <div data-panel style={{width:state.width,height:state.height,position:"relative"}}>
    <Chart instrument="NQ" chartInstanceId="status-stack-audit" candles={candles} settings={defaultChartSettings} timeframe="1m"
      orderFlowHistoryReady={true} marketIsActive={false}
      indicators={[{instanceId:"classic",indicatorId:"classic-gex-profile",enabled:true,settings:{}},
        ...(state.multiple?[{instanceId:"em",indicatorId:"expected-move",enabled:true,settings:{}}]:[])]}
      classicGexError="Isolated fixture status" gammaLevelsEnabled={state.multiple} gammaLevelsLoading={state.multiple}
      gammaLevelsError={state.multiple?"Isolated fixture notice":null} />
  </div>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
