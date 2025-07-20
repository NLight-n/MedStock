'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function BackToInventoryButton() {
  const searchParams = useSearchParams();
  const referrer = searchParams?.get('referrer') || 'inventory';
  
  // Determine the back URL based on referrer
  let backHref: string;
  let buttonText: string;
  
  if (referrer === 'documents') {
    backHref = '/documents';
    buttonText = '← Back to Documents';
  } else if (referrer.includes('/')) {
    // Extract the material ID if it exists in the referrer
    const materialId = referrer.split('/')[1];
    backHref = `/inventory/${materialId}`;
    buttonText = '← Back to Material Details';
  } else {
    backHref = '/inventory';
    buttonText = '← Back to Inventory';
  }

  return (
    <div className="mb-4">
      <Link
        href={backHref}
        className="inline-block bg-gray-200 text-gray-800 px-4 py-2 rounded font-medium hover:bg-gray-300 transition"
      >
        {buttonText}
      </Link>
    </div>
  );
} 