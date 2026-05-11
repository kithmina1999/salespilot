export type UploadAsset = {
  uri: string;
  name?: string;
  mimeType?: string;
};

export function toFormFile(asset: UploadAsset) {
  return {
    uri: asset.uri,
    name: asset.name ?? "upload.jpg",
    type: asset.mimeType ?? "image/jpeg"
  };
}
