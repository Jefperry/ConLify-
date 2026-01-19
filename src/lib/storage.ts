import { supabase } from '@/integrations/supabase/client';

// Storage bucket names
export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  GROUP_PHOTOS: 'group-photos',
} as const;

// Allowed file types for images
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export interface UploadResult {
  url: string | null;
  error: string | null;
}

/**
 * Validate file before upload
 */
function validateFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.';
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return 'File is too large. Maximum size is 5MB.';
  }
  
  return null;
}

/**
 * Generate a unique file name for uploads
 */
function generateFileName(userId: string, originalName: string): string {
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  return `${userId}/${timestamp}.${extension}`;
}

/**
 * Upload a user avatar image
 */
export async function uploadAvatar(userId: string, file: File): Promise<UploadResult> {
  // Validate file
  const validationError = validateFile(file);
  if (validationError) {
    return { url: null, error: validationError };
  }

  try {
    const fileName = generateFileName(userId, file.name);
    
    // Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.AVATARS)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { url: null, error: uploadError.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKETS.AVATARS)
      .getPublicUrl(fileName);

    return { url: publicUrl, error: null };
  } catch (error) {
    console.error('Avatar upload error:', error);
    return { url: null, error: 'Failed to upload avatar' };
  }
}

/**
 * Upload a group photo
 */
export async function uploadGroupPhoto(groupId: string, file: File): Promise<UploadResult> {
  // Validate file
  const validationError = validateFile(file);
  if (validationError) {
    return { url: null, error: validationError };
  }

  try {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    const fileName = `${groupId}/${timestamp}.${extension}`;
    
    // Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.GROUP_PHOTOS)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { url: null, error: uploadError.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKETS.GROUP_PHOTOS)
      .getPublicUrl(fileName);

    return { url: publicUrl, error: null };
  } catch (error) {
    console.error('Group photo upload error:', error);
    return { url: null, error: 'Failed to upload group photo' };
  }
}

/**
 * Delete old avatar files for a user
 */
export async function deleteOldAvatars(userId: string, keepUrl?: string): Promise<void> {
  try {
    const { data: files } = await supabase.storage
      .from(STORAGE_BUCKETS.AVATARS)
      .list(userId);

    if (files && files.length > 0) {
      // Filter out the current file if keepUrl is provided
      const filesToDelete = files
        .filter(file => {
          if (!keepUrl) return true;
          const fullPath = `${userId}/${file.name}`;
          return !keepUrl.includes(fullPath);
        })
        .map(file => `${userId}/${file.name}`);

      if (filesToDelete.length > 0) {
        await supabase.storage
          .from(STORAGE_BUCKETS.AVATARS)
          .remove(filesToDelete);
      }
    }
  } catch (error) {
    console.error('Error deleting old avatars:', error);
  }
}

/**
 * Delete old group photos
 */
export async function deleteOldGroupPhotos(groupId: string, keepUrl?: string): Promise<void> {
  try {
    const { data: files } = await supabase.storage
      .from(STORAGE_BUCKETS.GROUP_PHOTOS)
      .list(groupId);

    if (files && files.length > 0) {
      const filesToDelete = files
        .filter(file => {
          if (!keepUrl) return true;
          const fullPath = `${groupId}/${file.name}`;
          return !keepUrl.includes(fullPath);
        })
        .map(file => `${groupId}/${file.name}`);

      if (filesToDelete.length > 0) {
        await supabase.storage
          .from(STORAGE_BUCKETS.GROUP_PHOTOS)
          .remove(filesToDelete);
      }
    }
  } catch (error) {
    console.error('Error deleting old group photos:', error);
  }
}
