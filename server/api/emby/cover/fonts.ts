/**
 * 字体列表 API
 * 
 * 返回可用的中英文字体列表，用于封面生成器
 * 
 * 功能说明：
 * - 扫描 fonts 目录，只返回实际存在的字体文件
 * - 提供中文字体和英文字体的分类列表
 * - 返回默认推荐的字体ID
 * 
 * 前端调用此API获取字体选项，用户可以选择喜欢的字体用于封面标题
 * 
 * @module server/api/emby/cover/fonts
 * @author FNOS Media Dashboard
 * @version 1.0.0
 */

import { defineEventHandler } from 'h3'
import * as fs from 'fs'
import * as path from 'path'

/**
 * 字体信息接口
 */
interface FontInfo {
  /** 字体唯一标识符，用于前端选择和后端查找 */
  id: string
  /** 字体显示名称，中文显示中文名，英文显示英文名 */
  name: string
  /** 字体文件名 */
  file: string
}

export default defineEventHandler(() => {
  // 字体目录查找优先级：
  // 1. 开发环境：项目根目录下的 fonts/
  // 2. 打包后飞牛应用：server 目录的上级 public/ 目录
  // 3. 其他可能的路径
  const cwd = process.cwd()
  const possibleFontsDirs = [
    path.join(cwd, 'fonts'),           // 开发环境: 项目根目录/fonts
    path.join(cwd, '../public'),       // 打包后飞牛应用: www/server -> ../public
    path.join(cwd, 'public'),          // 备选
    path.join(cwd, '../fonts'),        // 备选
  ]
  
  let fontsDir = ''
  for (const dir of possibleFontsDirs) {
    if (fs.existsSync(dir)) {
      fontsDir = dir
      break
    }
  }
  
  if (!fontsDir) {
    console.log('[fonts API] 未找到字体目录, cwd:', cwd)
    return {
      success: false,
      zh: [],
      en: [],
      defaults: {
        zh: 'zh_lxgwwenkai',
        en: 'en_montserrat_bold'
      }
    }
  }
  
  /**
   * 中文字体列表
   * 
   * 包含适合中文标题显示的字体
   * - 霞鹜文楷：优雅的中文手写字体
   * - 得意黑：现代感的斜体中文字体
   * - 站酷快乐体：活泼可爱的中文字体
   */
  const zhFonts: FontInfo[] = [
    { id: 'zh_lxgwwenkai', name: '霞鹜文楷', file: 'LXGWWenKai-Regular.ttf' },
    { id: 'zh_smileysans', name: '得意黑', file: 'SmileySans-Oblique.ttf' },
    { id: 'zh_zcoolkuaile', name: '站酷快乐体', file: 'ZCOOLKuaiLe-Regular.ttf' }
  ]
  
  /**
   * 英文字体列表
   * 
   * 包含适合英文标题显示的字体
   * - Montserrat Bold：粗体现代风格
   * - Oswald Bold：紧凑有力的粗体
   * - Roboto Bold/Regular：Google 标准字体
   * - Open Sans Bold/Regular：清晰易读
   * - Bebas Neue：独特的窄体字体
   */
  const enFonts: FontInfo[] = [
    { id: 'en_montserrat_bold', name: 'Montserrat Bold', file: 'Montserrat-Bold.ttf' },
    { id: 'en_oswald_bold', name: 'Oswald Bold', file: 'Oswald-Bold.ttf' },
    { id: 'en_roboto_bold', name: 'Roboto Bold', file: 'Roboto-Bold.ttf' },
    { id: 'en_roboto', name: 'Roboto', file: 'Roboto-Regular.ttf' },
    { id: 'en_opensans_bold', name: 'Open Sans Bold', file: 'OpenSans-Bold.ttf' },
    { id: 'en_opensans', name: 'Open Sans', file: 'OpenSans-Regular.ttf' },
    { id: 'en_bebasneue', name: 'Bebas Neue', file: 'BebasNeue-Regular.ttf' }
  ]
  
  /**
   * 过滤出实际存在的字体文件
   * 
   * @param fonts - 字体列表
   * @returns 只包含存在文件的字体列表
   */
  const filterExisting = (fonts: FontInfo[]): FontInfo[] => {
    return fonts.filter(f => fs.existsSync(path.join(fontsDir, f.file)))
  }
  
  // 获取实际存在的字体
  const existingZh = filterExisting(zhFonts)
  const existingEn = filterExisting(enFonts)
  
  // 设置默认字体（列表中的第一个）
  const defaults = {
    zh: existingZh.length > 0 ? existingZh[0]!.id : '',
    en: existingEn.length > 0 ? existingEn[0]!.id : ''
  }
  
  return {
    success: true,
    // 中文字体列表
    zh: existingZh.map(f => ({ id: f.id, name: f.name })),
    // 英文字体列表
    en: existingEn.map(f => ({ id: f.id, name: f.name })),
    // 默认推荐的字体ID
    defaults
  }
})
