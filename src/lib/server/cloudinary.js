import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const FOLDERS = {
  uploads: process.env.CLOUDINARY_UPLOAD_FOLDER || 'objet-trouver/uploads',
  branding: process.env.CLOUDINARY_UPLOAD_FOLDER
    ? `${process.env.CLOUDINARY_UPLOAD_FOLDER}/branding`
    : 'objet-trouver/branding',
  pv: process.env.CLOUDINARY_UPLOAD_FOLDER
    ? `${process.env.CLOUDINARY_UPLOAD_FOLDER}/pv`
    : 'objet-trouver/pv',
};

export function getPublicUrl(resource, options = {}) {
  if (!resource?.secure_url) return '';
  if (options.thumb) {
    const [w, h] = options.thumb.split('x');
    return cloudinary.url(resource.public_id, {
      transformation: [{ width: +w, height: +h, crop: 'fill', gravity: 'auto' }],
      secure: true,
    });
  }
  return resource.secure_url;
}

export async function uploadFile(file, folder = FOLDERS.uploads) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto', unique_filename: true },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

export async function deleteFile(publicId) {
  if (!publicId) return null;
  return cloudinary.uploader.destroy(publicId);
}

export default cloudinary;