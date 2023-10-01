import type { IBinaryFileData } from '../asset-file'
import type { IAssetPathResolver } from '../asset-path-resolver'
import type { IAssetSourceStorage } from '../asset-storage-source'

export interface IAssetPluginLocateApi {
  readonly pathResolver: IAssetPathResolver
  readonly sourceStorage: IAssetSourceStorage
  /**
   * Detect content encoding.
   * @param src
   * @param data
   */
  detectEncoding(src: string, data: IBinaryFileData): Promise<BufferEncoding | undefined>
}

export interface IAssetPluginLocateNext {
  (embryo: Readonly<IAssetPluginLocateOutput> | null): Promise<IAssetPluginLocateOutput | null>
}

export interface IAssetPluginLocateInput {
  /**
   * Relative src path.
   */
  relativePath: string
  /**
   * Asset global unique identifier.
   */
  guid: string
  /**
   * The fingerprint of the asset content.
   */
  hash: string
  /**
   * Asset content.
   */
  content: IBinaryFileData
  /**
   * The created date of the asset (ISOString).
   */
  createdAt: string
  /**
   * The last modification date of the asset (ISOString).
   */
  updatedAt: string
}

export interface IAssetPluginLocateOutput {
  /**
   * Relative src path. (*nix style).
   */
  src: string
  /**
   * Asset title.
   */
  title: string
  /**
   * Asset content.
   */
  content: IBinaryFileData
  /**
   * Source file encoding.
   */
  encoding: BufferEncoding | undefined
  /**
   * The created date of the asset (ISOString).
   */
  createdAt: string
  /**
   * The last modification date of the asset (ISOString).
   */
  updatedAt: string
}
