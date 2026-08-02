import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<!doctype html><style>
    *{box-sizing:border-box}html,body{margin:0;width:${size}px;height:${size}px;background:transparent}
    .icon{position:relative;width:100%;height:100%;overflow:hidden;border-radius:${Math.round(size*.24)}px;background:#1f5c45}
    .ring{position:absolute;width:78%;height:78%;right:-28%;top:-32%;border:${Math.round(size*.065)}px solid rgba(217,231,165,.12);border-radius:50%}
    .stem{position:absolute;width:${Math.max(7,Math.round(size*.045))}px;height:47%;left:49%;top:34%;border-radius:99px;background:#f3f5f1;transform:rotate(4deg);transform-origin:bottom}
    .leaf{position:absolute;width:33%;height:22%;top:25%;background:#d9e7a5}
    .left{left:20%;border-radius:80% 10% 80% 10%;transform:rotate(27deg)}
    .right{right:19%;border-radius:10% 80% 10% 80%;transform:rotate(-27deg)}
    .ground{position:absolute;width:63%;height:${Math.max(8,Math.round(size*.055))}px;left:19%;bottom:20%;border-radius:50%;background:#f3f5f1;transform:rotate(-7deg)}
  </style><div class="icon"><div class="ring"></div><div class="leaf left"></div><div class="leaf right"></div><div class="stem"></div><div class="ground"></div></div>`)
  await page.screenshot({ path: `public/pwa-${size}.png`, omitBackground: true })
}

await browser.close()
