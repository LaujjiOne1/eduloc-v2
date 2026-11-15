const {chromium}=require('playwright');const {spawn}=require('child_process');
(async()=>{
  const FPS=60,DUR=15,N=FPS*DUR;
  const out=process.argv[2];
  const ff=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate',String(FPS),'-c:v','png','-i','-','-c:v','libx264','-preset','slow','-crf','14','-pix_fmt','yuv420p','-r',String(FPS),'-movflags','+faststart',out],{stdio:['pipe','inherit','inherit']});
  const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1920,height:1080}});
  await pg.goto('file://'+__dirname+'/index.html');await pg.evaluate(()=>window.ready);
  const cues=await pg.evaluate(()=>window.CUES);require('fs').writeFileSync(__dirname+'/cues.json',JSON.stringify(cues));
  for(let i=0;i<N;i++){
    await pg.evaluate(t=>window.render(t),i/FPS);
    const buf=await pg.screenshot({type:'png'});
    if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));
    if(i%60===0)console.log('frame',i,'/',N);
  }
  ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('done');
})();
