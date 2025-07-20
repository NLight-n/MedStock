'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface ImagePreviewProps {
  src: string;
  alt: string;
  filePath: string;
}

export default function ImagePreview({ src, alt, filePath }: ImagePreviewProps) {
  const [error, setError] = useState(false);
  const [fileSize, setFileSize] = useState<string | null>(null);

  useEffect(() => {
    // Fetch file size using HEAD request
    const fetchFileSize = async () => {
      try {
        const response = await fetch(src, { method: 'HEAD' });
        const size = response.headers.get('Content-Length');
        if (size) {
          const sizeKB = parseInt(size, 10) / 1024;
          setFileSize(sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${sizeKB.toFixed(2)} KB`);
        }
      } catch {
        setFileSize(null);
      }
    };
    if (src) fetchFileSize();
  }, [src]);

  return (
    <div>
      {fileSize && (
        <div className="text-xs text-gray-500 mb-2">File size: {fileSize}</div>
      )}
      {!error ? (
        <Image
          src={src}
          alt={alt}
          className="max-w-full h-auto rounded-lg shadow-lg"
          width={600}
          height={400}
          onError={() => setError(true)}
        />
      ) : (
        <div className="mt-4 text-gray-500">
          <p>Image could not be loaded</p>
          <p className="text-sm">File path: {filePath}</p>
        </div>
      )}
    </div>
  );
} 