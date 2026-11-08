import { buildTpoProfiles } from "./engine";
import { unpackTpoBuild, type PackedTpoBuild, type TpoWorkerReply } from "./workerProtocol";
if (typeof self !== "undefined" && typeof document === "undefined") {
  self.onmessage = (event: MessageEvent<{ id: number; input: PackedTpoBuild }>) => {
    const {id,input}=event.data;
    let reply: TpoWorkerReply;
    try { reply={id,profiles:buildTpoProfiles(unpackTpoBuild(input))}; }
    catch(error){reply={id,error:error instanceof Error?error.message:'TPO calculation unavailable'};}
    self.postMessage(reply);
  };
}
