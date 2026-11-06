// ============================================================
//  NOVA STUDIO — 内容配置 / Content config
//  替换这里的内容即可换成你自己的名字、项目与联系方式。
//  All content below is PLACEHOLDER / EXAMPLE CONTENT.
// ============================================================
export const SITE = {
  name: 'NOVA STUDIO',
  tagline: '光与运动的数字工作室',
  heroLines: ['Shaping', 'light into', 'feeling.'],
  heroSub: '我们用实时图形、交互与声音，为品牌打造让人记住的沉浸式数字体验。<br><span class="en">An independent digital studio — real-time 3D, motion & sound.</span>',
  about: {
    statement: 'We believe the web can <em>feel</em> like a place — not a page.',
    statementZh: '我们相信网页可以是一个“空间”，而不仅仅是一页内容。',
    services: [
      ['实时 3D', 'WebGL / WebGPU'],
      ['交互设计', 'Interaction & Motion'],
      ['声音设计', 'Generative Audio'],
      ['创意开发', 'Creative Engineering'],
    ],
    stats: [['12+', '年经验 Years'], ['80+', '项目 Projects'], ['24', '奖项 Awards']],
  },
  contact: {
    email: 'hello@nova.example',
    socials: [['Instagram', '#'], ['Behance', '#'], ['GitHub', '#'], ['小红书', '#']],
    city: 'Shanghai',
    timezone: 'Asia/Shanghai',
  },
};

// 项目数据：visual 可选 fluid | type | topo | halftone | glass（卡片里的程序化动态画面）；stats 为卡片右侧小数据；colors 用于程序生成封面纹理（3 个色值），可选 image 字段填入图片 URL 以使用真实封面。
export const PROJECTS = [
  { title: 'Aurora Drift', visual: 'fluid', stats: [['FPS','60'],['PARTICLES','2M'],['BPM','124']],  zh: '极光漂流', year: '2026', role: 'WebGL · Audio',   tags: ['音乐可视化', 'Realtime'],
    colors: ['#0b1340', '#3d5afe', '#5ef2ff'], desc: '一套跟随音乐实时生长的粒子极光系统，用于线上发布会直播。（示例内容）' },
  { title: 'Neon Tide', visual: 'type', stats: [['GLYPHS','4.8k'],['SCROLL','∞'],['LANG','2']],     zh: '霓虹潮汐', year: '2025', role: 'Brand · 3D Site', tags: ['品牌官网', 'Interactive'],
    colors: ['#2a0030', '#ff2d8a', '#ffb347'], desc: '为虚构潮流品牌打造的 3D 互动官网，滚动即潮汐。（示例内容）' },
  { title: 'Obsidian Hall', visual: 'topo', stats: [['ROOMS','7'],['XR','●'],['VISITS','40k']], zh: '黑曜展厅', year: '2025', role: 'WebXR Gallery',   tags: ['虚拟展览', 'XR'],
    colors: ['#050507', '#2b2f4a', '#c8f7ff'], desc: '可在浏览器与头显中漫游的数字艺术展厅。（示例内容）' },
  { title: 'Solar Bloom', visual: 'halftone', stats: [['SENSORS','16'],['LUX','900'],['DAYS','30']],   zh: '日冕花开', year: '2024', role: 'Installation',    tags: ['生成艺术', 'Generative'],
    colors: ['#2b0a00', '#ff6a00', '#ffe066'], desc: '一件对观众动作作出反应的生成式光影装置。（示例内容）' },
  { title: 'Lumen Field', visual: 'glass', stats: [['REACH','3M'],['CTR','8.4%'],['CITIES','12']],   zh: '流明原野', year: '2024', role: 'Campaign',        tags: ['互动广告', 'Campaign'],
    colors: ['#06140c', '#1fae6b', '#d4ff3a'], desc: '一次以“光田”为主题的互动营销活动。（示例内容）' },
];
