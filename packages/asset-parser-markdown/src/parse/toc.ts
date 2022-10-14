import type {
  IAssetPluginPolishApi,
  IAssetPluginPolishInput,
  IAssetPluginPolishNext,
  IAssetPluginPolishOutput,
  IAssetPolishPlugin,
} from '@guanghechen/asset-core-plugin'
import { calcHeadingToc } from '@yozora/ast-util'
import type { IMarkdownPolishedData } from '../types'
import { isMarkdownPolishedData } from '../util/misc'

export interface IMarkdownParsePluginTocProps {
  /**
   * Specify a prefix of heading identifier.
   */
  identifierPrefix?: string
}

export class MarkdownParsePluginToc implements IAssetPolishPlugin {
  public readonly displayName: string = '@guanghechen/asset-parser-markdown/toc'
  public readonly identifierPrefix: string | undefined

  constructor(props: IMarkdownParsePluginTocProps = {}) {
    this.identifierPrefix = props.identifierPrefix
  }

  public async polish(
    input: Readonly<IAssetPluginPolishInput>,
    embryo: Readonly<IAssetPluginPolishOutput> | null,
    api: Readonly<IAssetPluginPolishApi>,
    next: IAssetPluginPolishNext,
  ): Promise<IAssetPluginPolishOutput | null> {
    if (isMarkdownPolishedData(input, embryo)) {
      const data = await embryo.data
      const toc = calcHeadingToc(data.ast, this.identifierPrefix)
      const result: IAssetPluginPolishOutput<IMarkdownPolishedData> = {
        ...embryo,
        data: {
          ...data,
          toc,
        },
      }
      return next(result)
    }
    return next(embryo)
  }
}
