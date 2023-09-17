import type { IBinaryFileData } from './asset-file'
import type { IAssetResolverLocator } from './asset-resolver-locator'
import type { IAssetPluginLocateInput } from './asset-resolver-plugin/locate'
import type { IAssetUriResolver } from './asset-uri-resolver'

export interface IAssetResolverApi extends IAssetResolverLocator, IAssetUriResolver {
  /**
   * Create an initial asset.
   * @param srcPath
   */
  initAsset(srcPath: string): Promise<IAssetPluginLocateInput | null>
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
}
