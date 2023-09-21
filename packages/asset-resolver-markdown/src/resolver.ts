import { AssetDataTypeEnum } from '@guanghechen/asset-types'
import type {
  IAssetLocatePlugin,
  IAssetMeta,
  IAssetParsePlugin,
  IAssetPluginLocateApi,
  IAssetPluginLocateInput,
  IAssetPluginLocateNext,
  IAssetPluginLocateOutput,
  IAssetPluginParseApi,
  IAssetPluginParseInput,
  IAssetPluginParseNext,
  IAssetPluginParseOutput,
  IAssetPluginPolishApi,
  IAssetPluginPolishInput,
  IAssetPluginPolishNext,
  IAssetPluginPolishOutput,
  IAssetPolishPlugin,
  IAssetResolverPlugin,
  IBinaryFileData,
} from '@guanghechen/asset-types'
import { isArrayOfT, isString, isTwoDimensionArrayOfT } from '@guanghechen/helper-is'
import { ParagraphType } from '@yozora/ast'
import type { Definition, FootnoteDefinition, Paragraph, Resource, Root } from '@yozora/ast'
import { collectInlineNodes, collectTexts, shallowMutateAstInPreorderAsync } from '@yozora/ast-util'
import dayjs from 'dayjs'
import yaml from 'js-yaml'
import type {
  IMarkdownPolishedData,
  IMarkdownResolvedData,
  IMarkdownResolverPlugin,
  IMarkdownResolverPluginContext,
  IParser,
} from './types'
import { MarkdownAssetType, isMarkdownAssetPolishInput } from './types'

interface IProps {
  /**
   * Markdown parser.
   */
  parser: IParser
  /**
   * Encoding of markdown files.
   * @default 'utf8'
   */
  encoding?: BufferEncoding
  /**
   * Check if the given file is in markdown format.
   * @default filename => /\.md$/.test(filename)
   */
  resolvable?(filename: string): boolean
  /**
   * Get preset definitions.
   */
  getPresetDefinitions?: () => Definition[] | undefined
  /**
   * Get preset footnote definitions.
   */
  getPresetFootnoteDefinitions?: () => FootnoteDefinition[] | undefined
}

export class AssetResolverMarkdown implements IAssetResolverPlugin {
  public readonly displayName: string = '@guanghechen/asset-resolver-markdown'
  protected readonly ctx: IMarkdownResolverPluginContext
  protected readonly encoding: BufferEncoding
  protected readonly frontmatterRegex: RegExp
  private readonly _locatePlugins: IAssetLocatePlugin[]
  private readonly _parsePlugins: IAssetParsePlugin[]
  private readonly _polishPlugins: IAssetPolishPlugin[]

  constructor(props: IProps) {
    const parser: IParser = props.parser
    const encoding: BufferEncoding = props.encoding ?? 'utf8'

    const getPresetDefinitions: IMarkdownResolverPluginContext['getPresetDefinitions'] =
      props.getPresetDefinitions ?? (() => undefined)
    const getPresetFootnoteDefinitions: IMarkdownResolverPluginContext['getPresetFootnoteDefinitions'] =
      props.getPresetFootnoteDefinitions ?? (() => undefined)
    const parseMarkdown: IMarkdownResolverPluginContext['parseMarkdown'] = content => {
      return parser.parse(content, {
        shouldReservePosition: false,
        presetDefinitions: getPresetDefinitions() ?? [],
        presetFootnoteDefinitions: getPresetFootnoteDefinitions() ?? [],
      })
    }
    const resolvable: IMarkdownResolverPluginContext['resolvable'] =
      props.resolvable ?? (filename => /\.md$/.test(filename))
    const ctx: IMarkdownResolverPluginContext = {
      getPresetDefinitions,
      getPresetFootnoteDefinitions,
      parseMarkdown,
      resolvable,
    }

    this.ctx = ctx
    this.encoding = encoding
    this.frontmatterRegex = /^\s*[-]{3,}\n\s*([\s\S]*?)[-]{3,}\n/
    this._locatePlugins = []
    this._parsePlugins = []
    this._polishPlugins = []
  }

  public use(markdownResolverPlugin: IMarkdownResolverPlugin): this {
    const plugin: IAssetResolverPlugin = markdownResolverPlugin(this.ctx)
    if (plugin.displayName) {
      if (plugin.locate) this._locatePlugins.push(plugin as IAssetLocatePlugin)
      if (plugin.parse) this._parsePlugins.push(plugin as IAssetParsePlugin)
      if (plugin.polish) this._polishPlugins.push(plugin as IAssetPolishPlugin)
    }
    return this
  }

  public async locate(
    input: Readonly<IAssetPluginLocateInput>,
    embryo: Readonly<IAssetPluginLocateOutput> | null,
    api: Readonly<IAssetPluginLocateApi>,
    next: IAssetPluginLocateNext,
  ): Promise<IAssetPluginLocateOutput | null> {
    if (this.ctx.resolvable(input.filename)) {
      const rawSrcContent: IBinaryFileData | null = await api.loadContent(input.filename)
      if (rawSrcContent) {
        const rawContent = rawSrcContent.toString(this.encoding)
        const match: string[] | null = this.frontmatterRegex.exec(rawContent) ?? ['', '']
        const frontmatter: Record<string, any> = match[1]
          ? (yaml.load(match[1]) as Record<string, any>)
          : {}
        const createdAt: string =
          frontmatter.createdAt != null
            ? dayjs(frontmatter.createdAt).toISOString()
            : input.createdAt
        const updatedAt: string =
          frontmatter.updatedAt != null
            ? dayjs(frontmatter.updatedAt).toISOString()
            : input.updatedAt
        const title: string = frontmatter.title
          ? collectTexts(this.ctx.parseMarkdown(frontmatter.title).children).join(' ') ||
            input.title
          : input.title
        const sourcetype: string = MarkdownAssetType
        const mimetype: string = 'application/json'
        const uri: string | null = await api.resolveUri(sourcetype, mimetype)
        const slug: string | null = await api.resolveSlug({
          uri,
          slug: typeof frontmatter.slug === 'string' ? frontmatter.slug : null,
          title,
        })
        const result: IAssetPluginLocateOutput = {
          sourcetype,
          mimetype,
          title,
          description: frontmatter.description || title,
          slug,
          uri,
          createdAt,
          updatedAt,
          categories: isTwoDimensionArrayOfT(frontmatter.categories, isString)
            ? frontmatter.categories
            : [],
          tags: isArrayOfT(frontmatter.tags, isString) ? frontmatter.tags : [],
        }

        const reducer: IAssetPluginLocateNext =
          this._locatePlugins.reduceRight<IAssetPluginLocateNext>(
            (internalNext, middleware) => embryo =>
              middleware.locate(input, embryo, api, internalNext),
            next,
          )
        return reducer(result)
      }
    }
    return next(embryo)
  }

  public async parse(
    input: Readonly<IAssetPluginParseInput>,
    embryo: Readonly<IAssetPluginParseOutput> | null,
    api: Readonly<IAssetPluginParseApi>,
    next: IAssetPluginParseNext,
  ): Promise<IAssetPluginParseOutput | null> {
    if (input.sourcetype === MarkdownAssetType) {
      const rawSrcContent: IBinaryFileData | null = await api.loadContent(input.filename)
      if (rawSrcContent) {
        const rawContent = rawSrcContent.toString(this.encoding)
        const match: string[] | null = this.frontmatterRegex.exec(rawContent) ?? ['', '']
        const frontmatter: Record<string, any> = match[1]
          ? (yaml.load(match[1]) as Record<string, any>)
          : {}
        const titleAst: Root = this.ctx.parseMarkdown(frontmatter.title || input.title)
        const title: Paragraph =
          titleAst.children.length === 1 && titleAst.children[0].type === ParagraphType
            ? (titleAst.children[0] as Paragraph)
            : { type: ParagraphType, children: collectInlineNodes(titleAst) }
        const ast: Root = this.ctx.parseMarkdown(rawContent.slice(match[0].length))
        const result: IAssetPluginParseOutput<IMarkdownResolvedData> = {
          data: { title, ast, frontmatter },
        }

        const reducer: IAssetPluginParseNext =
          this._parsePlugins.reduceRight<IAssetPluginParseNext>(
            (internalNext, middleware) => embryo =>
              middleware.parse(input, embryo, api, internalNext),
            next,
          )
        return reducer(result)
      }
    }
    return next(embryo)
  }

  public async polish(
    input: Readonly<IAssetPluginPolishInput>,
    embryo: Readonly<IAssetPluginPolishOutput> | null,
    api: Readonly<IAssetPluginPolishApi>,
    next: IAssetPluginPolishNext,
  ): Promise<IAssetPluginPolishOutput | null> {
    if (isMarkdownAssetPolishInput(input) && input.data) {
      const ast: Root = await shallowMutateAstInPreorderAsync(input.data.ast, null, async node => {
        const n = node as unknown as Resource
        if (n.url && /^\./.test(n.url)) {
          const refPath: string = decodeURIComponent(n.url)
          const asset: IAssetMeta | null = await api.resolveAssetMeta(refPath)
          if (asset) {
            const url: string = asset.slug || asset.uri
            return n.url === url ? node : { ...node, url }
          }
        }
        return node
      })

      const { frontmatter, title } = input.data
      const result: IAssetPluginPolishOutput<IMarkdownPolishedData> = {
        sourcetype: MarkdownAssetType,
        datatype: AssetDataTypeEnum.JSON,
        data: { title, ast, frontmatter },
        encoding: 'utf8',
      }

      const reducer: IAssetPluginPolishNext =
        this._polishPlugins.reduceRight<IAssetPluginPolishNext>(
          (internalNext, middleware) => embryo =>
            middleware.polish(input, embryo, api, internalNext),
          next,
        )
      return reducer(result)
    }
    return next(embryo)
  }
}
