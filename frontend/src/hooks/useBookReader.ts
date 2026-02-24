const CHAPTER_REG = /^(第[一二三四五六七八九十百千零\d]+[章回节]|Chapter\s*\d+|[零一二三四五六七八九十百千\d]+\s*[、．.])\s*.*$/m
const CHARS_PER_PAGE = 2200

export interface Chapter {
  title: string
  index: number
}

export function parseChapters(text: string): Chapter[] {
  const list: Chapter[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line && CHAPTER_REG.test(line)) {
      list.push({ title: line, index: i })
    }
  }
  return list
}

export function buildPageList(text: string): string[] {
  const list: string[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + CHARS_PER_PAGE, text.length)
    if (end < text.length) {
      const nextNewline = text.indexOf('\n', end)
      if (nextNewline !== -1 && nextNewline - start < CHARS_PER_PAGE * 1.5) end = nextNewline + 1
    }
    list.push(text.slice(start, end))
    start = end
  }
  return list.length ? list : ['']
}

export interface ContentBlock {
  type: 'chapter' | 'para'
  content: string
  index?: number
}

export function parseContentBlocks(text: string, chapters: Chapter[]): ContentBlock[] {
  const blocks: ContentBlock[] = []
  if (chapters.length === 0) {
    text.split(/\n\n+/).forEach((p) => {
      if (p.trim()) blocks.push({ type: 'para', content: p.replace(/\n/g, '\n') })
    })
    return blocks
  }
  const lines = text.split('\n')
  let currentBlock: string[] = []
  const flush = () => {
    if (currentBlock.length) {
      blocks.push({ type: 'para', content: currentBlock.join('\n') })
      currentBlock = []
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const isChapter = chapters.some((ch) => ch.index === i)
    if (isChapter) {
      flush()
      blocks.push({ type: 'chapter', content: trimmed, index: i })
    } else if (trimmed) {
      currentBlock.push(line)
    } else {
      flush()
    }
  }
  flush()
  return blocks
}
