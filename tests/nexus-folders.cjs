const fs=require('fs'),vm=require('vm'),assert=require('assert');
for (const repo of ['reader']) {
 let props={DATA_FOLDER_ID:'old',NEXUS_DATA_FOLDER_ID:'new'};
 const file=(id,time)=>({getId:()=>id,getLastUpdated:()=>new Date(time)});
 const old=file('old-oct','2026-11-10'),hist=file('sep','2026-10-01'),cur=file('new-oct','2026-11-09');
 const folders={old:[hist,old],new:[cur]};
 const c=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})},DriveApp:{getFolderById:id=>{if(!folders[id])throw Error('inaccessible');return {getFiles:()=>{let i=0;return{hasNext:()=>i<folders[id].length,next:()=>folders[id][i++]}}}}}});
 vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../scripts/google-sheets-sync.gs'),'utf8'),c);
 let it=c.dataFiles_('DATA_FOLDER_ID'),out=[];while(it.hasNext())out.push(it.next().getId());
 assert.deepEqual(out,['sep','old-oct','new-oct']);
 assert.equal(c.preferDataFile_(it,cur,old),true);assert.equal(c.preferDataFile_(it,old,cur),false);
 delete props.NEXUS_DATA_FOLDER_ID;it=c.dataFiles_('DATA_FOLDER_ID');out=[];while(it.hasNext())out.push(it.next().getId());assert.deepEqual(out,['sep','old-oct']);
 props.NEXUS_DATA_FOLDER_ID='missing';assert.throws(()=>c.dataFiles_('DATA_FOLDER_ID'),/inaccessible/);
 props.NEXUS_DATA_FOLDER_ID='old';it=c.dataFiles_('DATA_FOLDER_ID');out=[];while(it.hasNext())out.push(it.next().getId());assert.equal(out.length,2);
 console.log(repo,'OK: historical preservation, Nexus priority, fallback, failure, same-folder deduplication');
}

