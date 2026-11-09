const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const brands=['mex-cream','gold-fusion','sol-y-tierra'];
const monthsNames=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const makeMonth=n=>({key:`2026-${String(n).padStart(2,'0')}`,daysInMonth:new Date(2026,n,0).getDate(),lastDay:n===11?9:31,hasData:true,rows:Array.from({length:n===11?9:31},(_,i)=>({d:i+1,spend:10,results:2,impressions:100,reach:70,clicks:3,follows:1,group:'interaccion',ad:'Pieza',campaign:'Interacción'}))});
let datasets=Object.fromEntries(brands.map(key=>[key,{months:[7,8,9,10,11].map(makeMonth)}]));
const context={window:{ExcambiareData:{brandSnapshot:key=>datasets[key],MONTHS:monthsNames,SHORT_MONTHS:monthsNames.map(n=>n.slice(0,3))}},Date:class extends Date{static now(){return Date.parse('2026-11-09T17:00:00Z');}},Intl,console};
const source=fs.readFileSync(path.join(root,'js/report-week.js'),'utf8').replace('window.ReporteSemanal = { init };','window.testReport = { periods, windowRows, followersOf, noteKey, buildReport, mode: value => { reportMode = value; } };');
vm.runInNewContext(source,context);
const api=context.window.testReport;
context.window.ExcambiareData.arteOf=()=>null;
const monthly=api.periods()[0];
assert.equal(monthly.key,'2026-10');assert.equal(monthly.to,31);assert.equal(monthly.closed,true);
api.mode('advance');const advance=api.periods()[0];assert.equal(advance.key,'2026-11');assert.equal(advance.to,8);
for(const key of ['2026-08','2026-09','2026-10','2026-11']){
 const {rows}=api.windowRows('mex-cream',key,advance);assert.equal(rows.length,8);assert.equal(rows.reduce((s,r)=>s+r.spend,0),80);
}
assert.equal(api.noteKey('2026-11',advance),'2026-11:avance:1-8');
const item={key:'2026-10',noteKey:'2026-10:avance:1-8',closed:false,to:8,status:'ok',found:['follows'],has:true,rows:[{follows:2,spend:10,group:'trafico-perfil'}]};
const ig={instagram:{months:new Map([['2026-10',{follows:100,unfollows:10,complete:true,through:'2026-10-31'}]])}};
assert.equal(api.followersOf('mex-cream',item,ig,{'2026-10':{'seg:mex-cream:nuevos':500}}).nuevos,null);
assert.equal(api.followersOf('mex-cream',item,ig,{'2026-10:avance:1-8':{'seg:mex-cream:nuevos':20}}).nuevos,20);
const report=api.buildReport(advance);assert.equal(report.keys.join(','),'2026-08,2026-09,2026-10,2026-11');
assert.equal(report.brands[0].sections[0].history.length,4);
console.log('OK: mensual completo, avance 1-8, tres meses comparables y seguidores separados por periodo');

// En el build, validar tambien la disponibilidad del barrido real sin imprimir datos ni URLs privadas.
const snapshot=path.join(root,'data/excambiare-meta.json');
if(fs.existsSync(snapshot)){
 const payload=JSON.parse(fs.readFileSync(snapshot,'utf8'));
 for(const brand of payload.brands||[]){
  const months=(brand.months||[]).filter(m=>!m.error && m.rows?.length);
  const latest=months.sort((a,b)=>(a.year*12+a.month)-(b.year*12+b.month)).at(-1);
  console.log(`[report-source] ${brand.key}: ultimo mes disponible ${latest?`${latest.year}-${String(latest.month).padStart(2,'0')}`:'sin datos'}`);
 }
}
