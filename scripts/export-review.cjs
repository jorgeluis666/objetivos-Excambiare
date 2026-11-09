const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const puppeteer=require('puppeteer-core');
const root=path.resolve(__dirname,'..');
(async()=>{
 const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data/excambiare-meta.json'),'utf8'));
 const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.statusCode=404;return res.end();}res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true});
 try{
  const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
  await page.evaluateOnNewDocument(data=>{window.EXCAMBIARE_META_DATA=data;const D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:['2026-11-09T17:00:00Z']));}static now(){return D.parse('2026-11-09T17:00:00Z');}};},snapshot);
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ExcambiareData?.brandSnapshot('mex-cream')?.months.length>0,{timeout:90000});
  await page.evaluate(()=>window.ReporteSemanal.init());
  await page.select('#week-type','advance');await page.select('#week-select','2026-11');
  await page.waitForSelector('#week-doc section');await page.evaluate(()=>document.fonts.ready);
  await page.waitForNetworkIdle({idleTime:1500,timeout:30000}).catch(()=>{});
  const proof=await page.evaluate(()=>{
   const selected=document.querySelector('#week-select').selectedOptions[0].textContent;
   if(!selected.includes('1–8'))throw Error('Corte distinto al 1-8');
   const coverage=['mex-cream','gold-fusion','sol-y-tierra'].map(key=>({key,months:['2026-08','2026-09','2026-10','2026-11'].map(k=>{const m=window.ExcambiareData.brandSnapshot(key).months.find(x=>x.key===k);return {key:k,lastDay:m?.lastDay,rows:m?.rows.filter(r=>r.d<=8).length||0};})}));
   const deck=document.querySelector('#week-doc');if(!deck||deck.innerText.length<1000)throw Error('Reporte vacio');
   const text=deck.innerText,pages=deck.querySelectorAll(':scope > section').length;
   document.body.replaceChildren(deck.cloneNode(true));return {selected,coverage,text,pages};
  });
  await page.addStyleTag({content:'@media print {body{margin:0!important;padding:0!important}.rp-deck{display:block!important}.rp-page{zoom:1!important}}'});
  const pdf=await page.pdf({printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
  const key=crypto.randomBytes(32),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const bytes=Buffer.concat([cipher.update(Buffer.from(JSON.stringify({pdf:Buffer.from(pdf).toString('base64'),proof}))),cipher.final()]);
  const wrapped=crypto.publicEncrypt({key:fs.readFileSync(path.join(root,'scripts/review-public.pem')),oaepHash:'sha256'},key);
  fs.mkdirSync(path.join(root,'review-output'),{recursive:true});fs.writeFileSync(path.join(root,'review-output/review.encrypted.json'),JSON.stringify({key:wrapped.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:bytes.toString('base64')}));
  console.log('PDF de revision generado: '+proof.pages+' paginas; corte 1-8 verificado.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
