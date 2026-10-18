const sizes=new WeakMap();
export function trimSnapshotRows(rows,maxBytes=2_000_000,maxRows=1200){
 const size=row=>{if(!sizes.has(row))sizes.set(row,JSON.stringify(row).length*2);return sizes.get(row);};
 let bytes=rows.reduce((sum,row)=>sum+size(row),0),remove=0;
 while(remove<rows.length&&(bytes>maxBytes||rows.length-remove>maxRows)){bytes-=size(rows[remove++]);}
 if(remove)rows.splice(0,remove);
 if(!rows.length)throw Error('Snapshot exceeds the retained chart-data budget.');
 return rows;
}
export class RetainedSnapshots extends Map{
 set(key,rows){trimSnapshotRows(rows);super.delete(key);super.set(key,rows);while(this.size>8)super.delete(this.keys().next().value);return this;}
}
