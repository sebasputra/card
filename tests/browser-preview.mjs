// Optional browser QA. Start isolated Chrome with --remote-debugging-port=9335 first.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const pages = await (await fetch('http://127.0.0.1:9335/json')).json();
const socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, {once: true}));
let id = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const msg = JSON.parse(event.data);
  if (pending.has(msg.id)) { const {resolve, reject} = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(msg.error) : resolve(msg.result); }
});
function cdp(method, params = {}) { return new Promise((resolve, reject) => { pending.set(++id, {resolve, reject}); socket.send(JSON.stringify({id, method, params})); }); }
async function evaluate(expression) {
  const r = await cdp('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}
async function until(expression) {
  for (let i = 0; i < 40; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error('Timed out: ' + expression);
}
try {
  await cdp('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  await cdp('Page.navigate', {url: (process.argv[2] || 'http://127.0.0.1:4322') + '/start/'});
  await until("document.querySelector('#example')?.contentWindow?.BioCard");
  for (const width of [320, 390, 768, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', {width, height: 1000, deviceScaleFactor: 1, mobile: width < 700});
    const size = await evaluate('({width: innerWidth, scroll: document.documentElement.scrollWidth})');
    assert.ok(size.scroll <= size.width, 'No horizontal overflow at ' + width + ': ' + JSON.stringify(size));
    await until("document.querySelector('#example').contentWindow.innerWidth === 390");
  }
  await evaluate("document.querySelector('#example').contentWindow.BioCard.go(3)");
  const contact = await evaluate(`(() => { const doc=document.querySelector('#example').contentDocument; const email=doc.querySelector('.contact .tx'); const cta=doc.querySelector('.wabtn'); return {emailHeight:email.getBoundingClientRect().height,emailLine:parseFloat(getComputedStyle(email).lineHeight),ctaHeight:cta.getBoundingClientRect().height}; })()`);
  assert.ok(contact.emailHeight <= contact.emailLine + 1, 'Stephen email fits on one line');
  assert.ok(contact.ctaHeight < 70, 'WhatsApp CTA stays on one line');
  await evaluate("Promise.all(document.querySelector('#example').contentDocument.getAnimations().filter(a => a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})))");
  await cdp('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false});
  await evaluate('window.scrollTo(0,0)');
  const desktop = await cdp('Page.captureScreenshot', {format: 'png'});
  writeFileSync(new URL('../start/preview-desktop.png', import.meta.url), Buffer.from(desktop.data, 'base64'));
  await cdp('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  await evaluate('window.scrollTo(0,0)');
  const mobile = await cdp('Page.captureScreenshot', {format: 'png'});
  writeFileSync(new URL('../start/preview-mobile.png', import.meta.url), Buffer.from(mobile.data, 'base64'));
  await evaluate(`(() => { const f = document.querySelector('form').elements; for (const [k,v] of Object.entries({name:'Ayu Test',role:'Designer',email:'ayu@example.com',wa:'081234567890',bio:'Membantu bisnis lewat desain.'})) f[k].value=v; f.name.dispatchEvent(new Event('blur')); document.querySelector('form').requestSubmit(); })()`);
  assert.equal(await evaluate("!document.querySelector('[data-step=\"1\"]').hidden"), true);
  await evaluate(`(() => { const form=document.querySelector('form'), f=form.elements; f.domainType.value='custom'; form.dispatchEvent(new Event('change')); f.customDomain.value='connect.ayu.com'; form.requestSubmit(); })()`);
  await until("document.querySelector('#draft-preview')?.contentWindow?.BioCard");
  assert.equal(await evaluate("document.querySelector('#draft-preview').contentWindow.BioCard.data().hero.name"), 'Ayu Test');
  assert.match(await evaluate("document.querySelector('#setup-note').textContent"), /biaya tambahan/);
  await evaluate("window.scrollTo({top: document.querySelector('#draft-preview').getBoundingClientRect().top + scrollY - 110, behavior:'instant'})");
  const onboarding = await cdp('Page.captureScreenshot', {format: 'png'});
  writeFileSync(new URL('../start/preview-onboarding.png', import.meta.url), Buffer.from(onboarding.data, 'base64'));
  console.log('PASS browser: no overflow at 320/390/768/1440, native form progression, custom domain setup, actual iframe renderer, three screenshots.');
} finally { socket.close(); }
