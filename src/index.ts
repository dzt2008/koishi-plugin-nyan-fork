import { Context, Schema, h, Logger } from 'koishi'

export const name = 'nyan-fork'

// 日志记录器
const logger = new Logger('nyan-fork')

// 配置类型定义
export interface Config {
  noises: Array<{
    enabled: boolean
    word: string
  }>
  transformLastLineOnly: boolean
  appendIfNoTrailing: string
  trailing: Array<{
    target: string
    replacement: string
  }>
}

// 配置 Schema
export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    transformLastLineOnly: Schema.boolean()
      .default(true)
      .description('只在发送文本的最后一行进行卖萌，否则每行都进行语气词替换'),
    noises: Schema.array(Schema.object({
      enabled: Schema.boolean().default(true).description('是否启用此语气词'),
      word: Schema.string().required().description('语气词内容'),
    })).role('table').default([
      { enabled: true, word: '喵' },
      { enabled: false, word: 'nya' },
      { enabled: false, word: '汪' }
    ]).description('随机取勾选的语气词中的一个作为语句结尾'),
  }).description('基础配置'),

  Schema.object({
    appendIfNoTrailing: Schema.string()
      .default('~')
      .description('没有标点的句末后面会被加上这个'),
    trailing: Schema.array(Schema.object({
      target: Schema.string().required().description('要被替换的标点符号'),
      replacement: Schema.string().required().description('替换后的标点符号'),
    })).role('table').default([
      { target: '，', replacement: '~' },
      { target: '。', replacement: '~' },
      { target: ',', replacement: '~' },
      { target: '.', replacement: '~' }
    ]).description('替换发送消息中的标点符号，两个以上连在一起的标点不会被替换')
  }).description('标点控制'),
])


// 不处理的匹配规则
const madeNoise = /喵([^\p{L}\d\s@#]+)?( +)?$/u
const trailingURL =
  /[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{2,6}\b([-a-zA-Z0-9()@:%_+.~#?&//<>{}]*)?$/u

// 匹配句尾字符
const trailingChars =
  /(?<content>.*?)(?<trailing>[^\p{L}\d\s@#]+)?(?<trailingSpace> +)?$/u

// 模板字符串处理，带默认值
const withDefault =
  (_default: string) =>
    (template: TemplateStringsArray, ...args: (string | undefined)[]) => {
      let returnValue = ''
      template.forEach((val, index) => {
        returnValue += val
        const arg = args[index]
        if (arg !== undefined) {
          returnValue += arg
        } else {
          returnValue += _default
        }
      })
      return returnValue
    }

// 转换句尾标点符号
const _transform = (
  trailingChars: string,
  transforms: Config['trailing']
): string => {
  const last = trailingChars.slice(-1)

  // 不处理重复的标点符号，如 .. ,, 。。
  if (trailingChars.length > 1) {
    const secondLast = trailingChars.slice(-2, -1)
    if (last === secondLast) return trailingChars
  }

  // 查找并替换匹配的标点符号
  for (const item of transforms) {
    if (last !== item.target) continue
    return trailingChars.slice(0, -1) + item.replacement
  }
  return trailingChars
}

// 处理单行文本
const processSingleLine = (
  noiseMaker: () => string,
  config: Config
) => (line: string, index: number, lines: string[]): string => {
  const { trailing, appendIfNoTrailing, transformLastLineOnly } = config

  // 不处理的情况
  if (transformLastLineOnly && index < lines.length - 1) {
    return line
  }
  if (line.trim() === '') {
    return line
  }
  if (madeNoise.test(line)) {
    return line
  }
  if (trailingURL.test(line)) {
    return line
  }

  // 处理行内容
  const noise = noiseMaker()
  const match = line.match(trailingChars)
  if (!match || !match.groups) return line

  let { content, trailing: trailingPunct, trailingSpace } = match.groups

  if (!trailingPunct) {
    trailingPunct = appendIfNoTrailing
  } else if (trailing.length) {
    trailingPunct = _transform(trailingPunct, trailing)
  }

  return withDefault('')`${content}${noise}${trailingPunct}${trailingSpace}`
}

// 处理消息元素
const processElements = (
  elements: h[],
  noiseMaker: () => string,
  config: Config
): h[] => {
  const { transformLastLineOnly } = config
  if (!elements?.length) return elements

  const result: h[] = []

  // 保留消息末尾的空行
  const end: h[] = []
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i]
    if (element.type === 'text' && element.attrs.content && element.attrs.content.trim() !== '') {
      break
    }
    end.unshift(elements[i])
  }
  const mainElements = elements.slice(0, elements.length - end.length)

  // 转换消息
  for (let i = 0; i < mainElements.length; i++) {
    const element = mainElements[i]

    // 只处理文本元素
    if (element.type !== 'text') {
      result.push(element)
      continue
    }

    // 跳过最后一行之前的内容（如果配置了只转换最后一行）
    if (transformLastLineOnly && i < mainElements.length - 1) {
      result.push(element)
      continue
    }

    const content = element.attrs.content || ''
    const lines = content.split('\n')
    const processedLines = lines.map(processSingleLine(noiseMaker, config))

    result.push(h.text(processedLines.join('\n')))
  }

  return result.concat(end)
}

// 随机打乱数组
const shuffle = <T>(arr: T[]): T[] =>
  arr
    .map((value: T) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)

// 创建语气词生成器
const makeNoise = (noises: Config['noises']): (() => string) => {
  // 只使用启用的语气词
  const enabledNoises = noises
    .filter(item => item.enabled)
    .map(item => item.word)

  // 如果没有启用的语气词，返回空字符串
  if (enabledNoises.length === 0) {
    return () => ''
  }

  let randomNoise = shuffle([...enabledNoises])
  return function () {
    if (randomNoise.length === 0) {
      randomNoise = shuffle([...enabledNoises])
    }
    return randomNoise.pop()!
  }
}

// 插件主函数
export function apply(ctx: Context, config: Config) {

  const dispose = ctx.on('before-send', (session) => {
    // 手动应用过滤器
    if (!ctx.filter(session)) return

    try {
      const noiseMaker = makeNoise(config.noises)

      // 处理消息元素
      if (session.elements && Array.isArray(session.elements)) {
        session.elements = processElements(session.elements, noiseMaker, config)
      }
    } catch (error) {
      logger.error('处理消息时出错:', error)
    }
  })

  // 生命周期管理
  ctx.on('dispose', () => {
    dispose()
  })
}
