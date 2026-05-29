'use client';
import { useState, useRef } from 'react';
import Image from 'next/image';
import { useUploadItemImage } from '@/hooks/useMenu';
import { menuImage, isR2Image } from '@/lib/imageUrl';
import { useToast } from '@/components/ui/Toast';

interface Props {
  itemId: string | undefined;
  publicId: string | undefined;
  onUploaded?: (publicId: string) => void;
}

export function ImageUploader({ itemId, publicId, onUploaded }: Props) {
  const { showToast } = useToast();
  const uploadImage = useUploadItemImage();
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Only show existing image if it's a valid R2 key — ignore old Cloudinary public_ids
  const hasImage = preview || isR2Image(publicId);

  // Blob preview takes precedence during upload; after success, publicId is the
  // new unique URL (timestamp-based key) so no cache-busting tricks are needed.
  const imageSrc = preview || (isR2Image(publicId) ? menuImage(publicId!) : '');

  const handleFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      showToast({ type: 'error', title: 'File too large', message: 'Image must be under 10MB.' });
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast({ type: 'error', title: 'Invalid format', message: 'Only JPG, PNG or WebP allowed.' });
      return;
    }

    // Show local blob immediately so the user sees the new image right away
    setPreview(URL.createObjectURL(file));

    if (itemId) {
      uploadImage.mutate({ itemId, file }, {
        onSuccess: (data: unknown) => {
          const d = data as { public_id?: string };
          if (onUploaded && d?.public_id) onUploaded(d.public_id);
          // Clear blob URL — publicId now points to the new unique R2 URL
          setPreview(null);
          // Reset the file input so the same file can be re-selected if needed
          if (inputRef.current) inputRef.current.value = '';
          showToast({ type: 'success', title: 'Image uploaded' });
        },
        onError: () => {
          showToast({ type: 'error', title: 'Upload failed', message: 'Please try again.' });
          setPreview(null);
          if (inputRef.current) inputRef.current.value = '';
        },
      });
    } else {
      showToast({ type: 'warning', title: 'Save item first', message: 'Create the item before uploading an image.' });
      setPreview(null);
    }
  };

  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%', height: 140,
          border: `2px dashed ${dragOver || hovered ? 'var(--accent)' : 'var(--border2)'}`,
          borderRadius: 10,
          background: dragOver || hovered ? 'var(--accent-bg)' : 'var(--paper2)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all .18s',
          position: 'relative', overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        {uploadImage.isPending ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin .7s linear infinite' }} />
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: 'var(--ink4)' }}>Uploading…</span>
          </div>
        ) : hasImage ? (
          <>
            <Image
              key={imageSrc}          // force re-mount when src changes (blob → R2 URL)
              src={imageSrc}
              alt="Item image"
              fill
              style={{ objectFit: 'cover', borderRadius: 8 }}
              unoptimized={!!preview} // blob: URLs skip Next.js image optimisation
            />
            {hovered && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8,
              }}>
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#fff', fontWeight: 500 }}>
                  Change image
                </span>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>📷</div>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: dragOver ? 'var(--accent)' : 'var(--ink4)', margin: 0 }}>
              Drop image or click to upload
            </p>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink5)', marginTop: 4 }}>
              JPG, PNG, WebP · Max 10MB
            </p>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
    </>
  );
}
