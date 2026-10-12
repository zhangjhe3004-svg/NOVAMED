// Render every screen in pages.html to PNG and verify no JS errors / horizontal overflow.
const { chromium } = require('C:/Users/zhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path = require('path');
const { pathToFileURL } = require('url');
(async () => {
  const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 1, reducedMotion: 'reduce'});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const base = path.resolve(__dirname, '..');
  const keys = ['records','patientDetail','ai','supervise','messages','schedule','announcement','leave','departments','knowledge','slots','adminReview','users','patientAccounts','settings','aiMgmt'];
  const titles = {records:'就诊记录',patientDetail:'患者详情',ai:'AI辅助诊断',supervise:'下级审阅',messages:'消息',schedule:'排班表',announcement:'院内公告',leave:'请假审批',departments:'科室组织',knowledge:'医学知识库',slots:'号源排班',adminReview:'管理员审核',users:'用户管理',patientAccounts:'患者账号',settings:'个人设置',aiMgmt:'AI管理'};
  await page.goto(pathToFileURL(path.join(base, 'pages.html')).href);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    await page.evaluate(k => navigate(k), k);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const file = `${String(15 + i).padStart(2, '0')}-${titles[k]}.png`;
    await page.screenshot({path: path.join(base, file), fullPage: true});
    console.log(`${file}  overflow=${overflow}`);
  }
  // narrow-screen sanity check
  await page.setViewportSize({width: 390, height: 844});
  await page.evaluate(() => navigate('records'));
  console.log('mobile overflow=' + await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  await browser.close();
  console.log('errors: ' + JSON.stringify(errors));
  if (errors.length) process.exit(1);
})();
