import type { IAsset } from './asset'
import type { IBinaryFileData } from './asset-file'
import type { IAssetDataMap } from './asset-manager'
import type { IAssetPluginLocateInput } from './asset-resolver-plugin/locate'
import type { IAssetUriResolver } from './asset-uri-resolver'

export interface IAssetResolverApi extends IAssetUriResolver {
  /**
   * Dump asset data map.
   */
  dumpAssetDataMap(): Promise<IAssetDataMap>
  /**
   * Create an initial asset.
   * @param srcPath
   */
  initAsset(srcPath: string): Promise<IAssetPluginLocateInput | null>
  /**
   * Set asset to locator.
   * @param srcPathId
   * @param asset
   */
  insertAsset(asset: IAsset): Promise<void>
  /**
   *
   * @param srcPath
   */
  isRelativePath(srcPath: string): boolean
  /**
   * Load content by source file srcPath.
   * @param srcPath
   */
  loadContent(srcPath: string): Promise<IBinaryFileData | null>
  /**
   * Try to locate an resolving asset.
   * @param srcPath
   */
  locateAsset(srcPath: string): Promise<IAsset | undefined>
  /**
   * Remove asset from locator.
   * @param srcPath
   */
  removeAsset(srcPath: string): Promise<void>
  /**
   * Resolve asset guid.
   * @param srcPath
   */
  resolveGUID(srcPath: string): Promise<string>
}
