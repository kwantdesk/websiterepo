import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,openSync,closeSync,writeFileSync,readFileSync,appendFileSync,statSync,renameSync,unlinkSync} from 'node:fs';
import net from 'node:net';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

export function portInUse(port){return new Promise(resolveProbe=>{const socket=net.createConnection({host:'127.0.0.1',port});let done=false;const finish=value=>{if(done)return;done=true;socket.destroy();resolveProbe(value);};socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));socket.setTimeout(1000,()=>finish(false));});}
const alive=pid=>{try{process.kill(pid,0);return true;}catch(error){return error.code==='EPERM';}};
/** Supervise process exits only. CME auth/market closure is NOT a reason to restart. */
export class GatewaySupervisor{
  constructor({entry,stateDirectory,port=8793,spawnImpl=spawn,probe=portInUse,isAlive=alive,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
    this.entry=resolve(entry);this.directory=resolve(stateDirectory);this.port=port;this.spawn=spawnImpl;this.probe=probe;this.isAlive=isAlive;this.now=now;this.setTimer=setTimer;this.clearTimer=clearTimer;this.child=null;this.timer=null;this.stopping=false;this.started=[];this.failures=0;this.lock=join(this.directory,'supervisor.lock');this.stopFile=join(this.directory,'STOP');
  }
  log(name,text){try{const path=join(this.directory,name);if(existsSync(path)&&statSync(path).size>1_048_576)renameSync(path,path+'.previous');appendFileSync(path,String(text).slice(0,65536));}catch{/* Logging cannot crash market-data collection. */}}
  event(event,fields={}){this.log('supervisor.log',JSON.stringify({at:new Date(this.now()).toISOString(),event,...fields})+'\n');}
  async start(){
    mkdirSync(this.directory,{recursive:true});
    if(existsSync(this.stopFile))return false;
    if(existsSync(this.lock)){const pid=Number(readFileSync(this.lock,'utf8'));if(Number.isInteger(pid)&&pid>0&&this.isAlive(pid))return false;unlinkSync(this.lock);}
    if(await this.probe(this.port))throw Error('A gateway already owns this port; no duplicate was started.');
    const fd=openSync(this.lock,'wx');try{writeFileSync(fd,String(process.pid));}finally{closeSync(fd);}this.ownsLock=true;
    this.event('supervisor-started',{pid:process.pid});await this.launch();return true;
  }
  async launch(){
    if(this.stopping||existsSync(this.stopFile)){this.release();return;}
    if(await this.probe(this.port)){this.event('other-gateway-owns-port');this.release();return;}
    this.started=this.started.filter(time=>this.now()-time<3600000);
    if(this.started.length>=10){const delay=Math.max(1000,3600000-(this.now()-this.started[0]));this.event('restart-budget-cooldown',{delayMs:delay});this.timer=this.setTimer(()=>{this.timer=null;void this.launch();},delay);return;}
    this.started.push(this.now());const startedAt=this.now();
    const child=this.spawn(process.execPath,['--use-system-ca',this.entry],{cwd:dirname(this.entry),windowsHide:true,stdio:['ignore','pipe','pipe']});this.child=child;
    writeFileSync(join(this.directory,'gateway.pid'),String(child.pid??''));this.event('gateway-started',{pid:child.pid??null});
    child.stdout?.on('data',chunk=>this.log('gateway.stdout.log',chunk));child.stderr?.on('data',chunk=>this.log('gateway.stderr.log',chunk));
    let settled=false;const exited=(code,signal)=>{if(settled)return;settled=true;this.child=null;this.event('gateway-exited',{code,signal});
      if(this.stopping||existsSync(this.stopFile)){this.release();return;}
      this.failures=this.now()-startedAt>=60000?0:this.failures+1;const delay=Math.min(60000,5000*2**Math.min(4,this.failures));this.timer=this.setTimer(()=>{this.timer=null;void this.launch();},delay);
    };
    child.once('close',exited);child.once('error',error=>exited(null,error.code??'SPAWN_ERROR'));
  }
  stop(){this.stopping=true;if(this.timer){this.clearTimer(this.timer);this.timer=null;}if(this.child)this.child.kill('SIGTERM');else this.release();}
  release(){this.stopping=true;if(this.ownsLock){try{if(readFileSync(this.lock,'utf8')===String(process.pid))unlinkSync(this.lock);}catch{}this.ownsLock=false;}this.event('supervisor-stopped');}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const entry=process.argv[2],directory=process.argv[3],port=Number(process.env.KWANTDESK_SUPERVISOR_PORT||8793);
  if(!entry||!directory||!Number.isInteger(port)||port<1||port>65535)throw Error('Usage: supervise-background.mjs <absolute launcher path> <private state directory>');
  const supervisor=new GatewaySupervisor({entry,stateDirectory:directory,port});
  process.on('SIGINT',()=>supervisor.stop());process.on('SIGTERM',()=>supervisor.stop());
  await supervisor.start();
}
