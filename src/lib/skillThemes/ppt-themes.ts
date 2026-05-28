import { SKILL_CDN_BASE } from './diagram-themes'

export type PptAudience = 'engineers' | 'execs' | 'xhs' | 'students' | 'vc' | 'internal'

export interface PptTheme {
  id: string
  name: string
  audienceTags: PptAudience[]
  cdnPath: string
  description: string
}

const T = (id: string, name: string, audienceTags: PptAudience[], description: string): PptTheme => ({
  id,
  name,
  audienceTags,
  cdnPath: `${SKILL_CDN_BASE}/themes-ppt/${id}.css`,
  description,
})

export const PPT_THEMES: PptTheme[] = [
  // 商务 / 投资人 / 路演
  T('pitch-deck-vc',    'Pitch Deck VC',    ['vc', 'execs'],          'YC 风白底 + 蓝紫渐变 + 大留白，融资路演首选'),
  T('corporate-clean',  'Corporate Clean',  ['execs', 'internal'],    '纯白 + 海军蓝 + Inter，董事会 / B2B'),
  T('swiss-grid',       'Swiss Grid',       ['execs', 'internal'],    '瑞士网格 + Helvetica 感，严肃排版'),
  T('editorial-serif',  'Editorial Serif',  ['execs', 'xhs'],         '杂志风 Playfair 衬线 + 奶油底'),
  T('minimal-white',    'Minimal White',    ['internal', 'execs', 'students'], '极简白，Inter，极低阴影'),

  // 技术 / 工程 / 分享
  T('tokyo-night',      'Tokyo Night',      ['engineers'],            'Tokyo Night 蓝夜，偏冷技术分享'),
  T('dracula',          'Dracula',          ['engineers'],            '经典 Dracula 紫红，代码密集分享'),
  T('catppuccin-mocha', 'Catppuccin Mocha', ['engineers'],            'catppuccin 深色，长时间观看友好'),
  T('catppuccin-latte', 'Catppuccin Latte', ['engineers'],            'catppuccin 浅色，开发者极客友好'),
  T('terminal-green',   'Terminal Green',   ['engineers'],            '绿屏终端 + 等宽 + 发光文字'),
  T('blueprint-ppt',    'Blueprint',        ['engineers'],            '蓝图工程 + 网格底纹 + 蒙太奇字体'),
  T('nord',             'Nord',             ['engineers'],            '北欧清冷蓝白'),
  T('gruvbox-dark',     'Gruvbox Dark',     ['engineers'],            '温暖复古深色，*nix / Terminal'),
  T('solarized-light',  'Solarized Light',  ['engineers', 'students'],'经典低眩光配色，工作坊 / 教学'),
  T('rose-pine',        'Rose Pine',        ['engineers', 'xhs'],     '玫瑰松柔和暗色，设计+开发交界'),

  // 小红书 / 卡片 / 营销
  T('xiaohongshu-white','XHS White',        ['xhs'],                  '小红书白底 + 暖红 accent + 衬线标题'),
  T('soft-pastel',      'Soft Pastel',      ['xhs', 'students'],      '柔和马卡龙三色渐变'),
  T('magazine-bold',    'Magazine Bold',    ['xhs', 'execs'],         '奶油底 + 超大 Playfair + 橙色 spot'),
  T('rainbow-gradient', 'Rainbow Gradient', ['xhs'],                  '白底 + 彩虹流动渐变 accent'),
  T('aurora',           'Aurora',           ['xhs', 'vc'],            '极光渐变 + blur + saturate'),
  T('sunset-warm',      'Sunset Warm',      ['xhs'],                  '橘 / 珊瑚 / 琥珀三色渐变'),
  T('arctic-cool',      'Arctic Cool',      ['execs', 'internal'],    '蓝 / 青 / 石板灰浅色版'),

  // 学术 / 报告 / 论文
  T('academic-paper-ppt', 'Academic Paper', ['students', 'internal'], '论文白 + 衬线正文 + 黑墨 + 蓝链接'),
  T('engineering-whiteprint', 'Engineering Whiteprint', ['engineers', 'students'], '白底 + 坐标纸网格 + 海军墨线'),
  T('news-broadcast',   'News Broadcast',   ['execs', 'internal'],    '白底 + 红色竖条 + Oswald 大写'),

  // 赛博 / 强烈 / 发布会
  T('cyberpunk-neon-ppt','Cyberpunk Neon',  ['engineers', 'vc'],      '纯黑 + 霓虹粉青黄 + 发光'),
  T('vaporwave',        'Vaporwave',        ['xhs'],                  '深紫 + 粉红青蓝渐变 + 晕染光斑'),
  T('y2k-chrome',       'Y2K Chrome',       ['xhs'],                  '银铬渐变 + 彩虹 accent + 大圆角'),
  T('neo-brutalism-ppt','Neo Brutalism',    ['vc', 'engineers'],      '厚描边 + 硬阴影 + 明黄 accent'),
  T('retro-tv',         'Retro TV',         ['xhs'],                  '暖奶油 + CRT 扫描线 + 琥珀橙'),

  // 极简 / 克制
  T('japanese-minimal', 'Japanese Minimal', ['execs', 'internal'],    '象牙白 + 朱红 accent + 极大留白'),
  T('sharp-mono',       'Sharp Mono',       ['vc', 'execs'],          '纯黑白 + Archivo Black + 硬阴影'),

  // 设计师 / 创意
  T('bauhaus',          'Bauhaus',          ['xhs', 'students'],      '几何 + 红黄蓝原色'),
  T('memphis-pop',      'Memphis Pop',      ['xhs'],                  '孟菲斯波普背景点 + 大字标题'),
  T('midcentury',       'Midcentury',       ['xhs'],                  '奶油底 + 芥末/青/焦橙 + 锐利几何'),
  T('glassmorphism-ppt','Glassmorphism',    ['execs', 'vc'],          '毛玻璃 + 多色光斑背景'),
]

export const DEFAULT_PPT_THEME: Record<PptAudience, string> = {
  engineers: 'tokyo-night',
  execs:     'corporate-clean',
  xhs:       'xiaohongshu-white',
  students:  'academic-paper-ppt',
  vc:        'pitch-deck-vc',
  internal:  'minimal-white',
}

export const PPT_AUDIENCES: { id: PptAudience; label: string; description: string }[] = [
  { id: 'engineers', label: '技术分享',    description: '工程师 / 内部技术分享 / Tech talk' },
  { id: 'execs',     label: '高管汇报',    description: '董事会 / 高管 / 季度业务回顾' },
  { id: 'xhs',       label: '小红书',      description: '社交媒体卡片 / 营销 / 生活方式' },
  { id: 'students',  label: '学术 / 教学', description: '论文 / 课件 / 工作坊' },
  { id: 'vc',        label: '投资人路演',  description: 'Pitch / 融资 / 创业大赛' },
  { id: 'internal',  label: '内部汇报',    description: '周报 / OKR / 团队对齐' },
]

export function findPptTheme(id: string): PptTheme | undefined {
  return PPT_THEMES.find((t) => t.id === id)
}

export function pptThemesForAudience(audience: PptAudience): PptTheme[] {
  return PPT_THEMES.filter((t) => t.audienceTags.includes(audience))
}
