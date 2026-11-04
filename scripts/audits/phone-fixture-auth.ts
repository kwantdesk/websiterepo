// @ts-nocheck -- isolated browser auth fixture only
const user={id:"algo-isolated-fixture",email:"fixture@example.invalid",user_metadata:{username:"fixture",display_name:"Fixture"}};
const chain=new Proxy(function(){return chain},{get(_t,p){if(p==="then")return (resolve:any)=>resolve({data:null,error:null});return chain;},apply(){return chain;}});
export const createClient=()=>({auth:{getUser:async()=>({data:{user}}),getSession:async()=>({data:{session:{user}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>chain,rpc:()=>chain,channel:()=>chain,removeChannel(){},storage:{from:()=>chain}});
