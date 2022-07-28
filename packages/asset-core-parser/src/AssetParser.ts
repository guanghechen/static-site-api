import type { IAsset, IAssetDataMap, IAssetManager } from '@guanghechen/asset-core'
import { AssetManager } from '@guanghechen/asset-core'
import type { IAssetEntity } from './types/asset'
import type { IAssetParser } from './types/parser'
import type {
  IAssetParserPluginParseApi,
  IAssetParserPluginParseInput,
  IAssetParserPluginParseNext,
} from './types/plugin/parse'
import type { IAssetParserPlugin } from './types/plugin/plugin'
import type {
  IAssetParserPluginPolishApi,
  IAssetParserPluginPolishInput,
  IAssetParserPluginPolishNext,
} from './types/plugin/polish'
import type { IAssetResolver } from './types/resolver'

export interface IAssetParserProps {
  assetManager?: IAssetManager
}

export class AssetParser implements IAssetParser {
  protected readonly assetManager: IAssetManager
  protected readonly locationMap: Map<string, IAssetEntity | null> = new Map()
  protected readonly plugins: IAssetParserPlugin[] = []

  constructor(props: IAssetParserProps = {}) {
    this.assetManager = props.assetManager ?? new AssetManager()
  }

  public use(...plugins: Array<IAssetParserPlugin | IAssetParserPlugin[]>): this {
    for (const plugin of plugins.flat()) {
      if (plugin?.displayName) {
        this.plugins.push(plugin)
      }
    }
    return this
  }

  public dump(): IAssetDataMap {
    return this.assetManager.dump()
  }

  public async create(assetResolver: IAssetResolver, locations: string[]): Promise<void> {
    for (const location of locations) await this._assetResolve(assetResolver, location)
    for (const location of locations) await this._assetPolish(assetResolver, location)
  }

  public remove(assetResolver: IAssetResolver, locations: string[]): void {
    const { assetManager, locationMap } = this
    for (const location of locations) {
      const locationId = assetResolver.identifyLocation(location)
      const asset = locationMap.get(locationId)
      if (asset) {
        assetManager.remove(asset.guid)
        locationMap.delete(locationId)
      }
    }
  }

  protected async _assetResolve(assetResolver: IAssetResolver, location: string): Promise<void> {
    const { locationMap } = this
    const locationId = assetResolver.identifyLocation(location)

    if (locationMap.has(locationId)) return
    locationMap.set(locationId, null)

    const input: IAssetParserPluginParseInput | null = await assetResolver.initAsset(location)
    if (input == null) return

    const api: IAssetParserPluginParseApi = {
      loadContent: relativeSrcLocation => {
        const resolvedLocation = assetResolver.resolveLocation(location, '..', relativeSrcLocation)
        return assetResolver.loadSrcContent(resolvedLocation)
      },
      loadContentSync(relativeSrcLocation) {
        const resolvedLocation = assetResolver.resolveLocation(location, '..', relativeSrcLocation)
        return assetResolver.loadSrcContentSync(resolvedLocation)
      },
      resolveSlug: assetResolver.resolveSlug.bind(assetResolver),
    }
    const reducer: IAssetParserPluginParseNext = this.plugins
      .filter(plugin => !!plugin.parse)
      .reduceRight<IAssetParserPluginParseNext>(
        (next, middleware) => embryo => middleware.parse!(input, embryo, api, next),
        embryo => embryo,
      )

    const { guid, hash, src } = input
    const result = await reducer(null)
    if (result) {
      const { type, mimetype, title, slug, createdAt, updatedAt, categories, tags, data } = result
      const asset: IAsset = {
        guid,
        hash,
        type,
        mimetype,
        title,
        uri: assetResolver.resolveUri({ guid, type, mimetype }),
        slug,
        createdAt,
        updatedAt,
        categories,
        tags,
      }
      const assetEntity: IAssetEntity = { ...asset, src, data }
      this.assetManager.insert(asset)
      locationMap.set(locationId, assetEntity)
    }
  }

  protected async _assetPolish(assetResolver: IAssetResolver, location: string): Promise<void> {
    const { locationMap } = this
    const locationId = assetResolver.identifyLocation(location)
    const asset = locationMap.get(locationId)
    if (asset == null) return

    const api: IAssetParserPluginPolishApi = {
      loadContent: relativeSrcLocation => {
        const resolvedLocation = assetResolver.resolveLocation(location, '..', relativeSrcLocation)
        return assetResolver.loadSrcContent(resolvedLocation)
      },
      loadContentSync(relativeSrcLocation) {
        const resolvedLocation = assetResolver.resolveLocation(location, '..', relativeSrcLocation)
        return assetResolver.loadSrcContentSync(resolvedLocation)
      },
      resolveAsset: relativeLocation => {
        const resolvedLocation = assetResolver.resolveLocation(location, '..', relativeLocation)
        const locationId = assetResolver.identifyLocation(resolvedLocation)
        const asset = locationMap.get(locationId)
        return asset ? { uri: asset.uri, slug: asset.slug, title: asset.title } : null
      },
    }
    const reducer: IAssetParserPluginPolishNext = this.plugins
      .filter(plugin => !!plugin.polish)
      .reduceRight<IAssetParserPluginPolishNext>(
        (next, middleware) => embryo => middleware.polish!(input, embryo, api, next),
        embryo => embryo,
      )
    const input: IAssetParserPluginPolishInput = {
      type: asset.type,
      title: asset.title,
      data: asset.data,
    }

    const result = await reducer(null)
    if (result) {
      const { dataType, data, encoding } = result
      await assetResolver.saveAsset({ uri: asset.uri, dataType, data, encoding })
    }
  }
}
