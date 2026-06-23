const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless:'new', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERR:', e.message));
  await p.setViewport({ width:420, height:860, deviceScaleFactor:2 });
  await p.goto('http://127.0.0.1:8123/', { waitUntil:'networkidle2', timeout:30000 });
  await p.mouse.move(210, 430);
  await new Promise(r => setTimeout(r, 2600));
  await p.screenshot({ path:'_cov_portrait.png' });
  await p.setViewport({ width:1280, height:720, deviceScaleFactor:1 });
  await new Promise(r => setTimeout(r, 1500));
  await p.screenshot({ path:'_cov_landscape.png' });
  await b.close();
  console.log('shots done');
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
